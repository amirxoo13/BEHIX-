import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { reserveDaily } from "@/lib/tts-quota";
import { clientIp } from "@/lib/rate-limit";
import { gcpAccessToken } from "@/lib/gcp-auth.server";
import { gcsGet, gcsPut } from "@/lib/gcs.server";
import { cors, DAILY_FULL, fail, RATE_MESSAGE, takeHits } from "@/lib/voice-limits.server";
import { generateMusic, LYRIA_MAX_SECONDS, lyriaConfig, MUSIC_MOODS, musicKey, musicPrompt, type MusicCue } from "@/lib/lyria.server";
import { skillSystem } from "@/ai/skills";
import { geminiJson } from "@/lib/gemini-text.server";
import { cuePrompt, cueSchema, cueSystem, repairCue } from "@/lib/music-cue";

/**
 * موسیقی پس‌زمینه با Lyria 3 Pro (Agent Platform Interactions، منطقهٔ global؛ جزئیات در lyria.server.ts).
 * پیش‌فرض خاموش است؛ با LYRIA_MODEL=lyria-3-pro-preview روشن می‌شود.
 * POST {mood, seconds≤184, style?, bpm?, intensity?, instruments?} → {audioUrl, model, cache, prompt, cue}
 * POST {brief, seconds≤184, mood?} → اول یک تماس متنی Gemini 3.8 Flash با مهارت music.cue فیلدهای قطعه را پر می‌کند
 *   (اگر نشد: همان mood/seconds)، بعد همان مسیر بالا. GET ?status=1 → {enabled} برای پنل.
 * GET ?clip=<sha256>.mp3 همان قطعهٔ کش‌شده را از GCS می‌دهد. هزینهٔ وزنی: MUSIC_COST (پیش‌فرض ۵ واحد سهم روزانه).
 */
const structured = z.object({
  mood: z.enum(MUSIC_MOODS),
  seconds: z.number().min(5).max(LYRIA_MAX_SECONDS),
  style: z.string().max(120).optional(),
  bpm: z.number().int().min(40).max(200).optional(),
  intensity: z.enum(["low", "medium", "high"]).optional(),
  instruments: z.string().max(120).optional(),
}).strict();
const briefed = z.object({ brief: z.string().trim().min(2).max(600), seconds: z.number().min(5).max(LYRIA_MAX_SECONDS), mood: z.enum(MUSIC_MOODS).optional() }).strict();
const body = z.union([structured, briefed]);
const CLIP = /^[0-9a-f]{64}\.mp3$/;
const PER_IP = Number(process.env.TTS_PER_IP ?? 120), PER_DAY = Number(process.env.TTS_PER_DAY ?? 3000);

async function post(req: Request): Promise<Response> {
  const project = process.env.GOOGLE_CLOUD_PROJECT, bucket = process.env.TTS_BUCKET;
  const cfg = lyriaConfig();
  if (!project || !cfg.enabled) return fail(req, 503, "ساخت موسیقی روی این سرور فعال نیست.");
  if (!bucket) return fail(req, 503, "برای موسیقی فضای ذخیره (TTS_BUCKET) لازم است.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(req, 400, "درخواست موسیقی معتبر نیست.");
  let auth: Record<string, string>, ip: string;
  try {
    auth = { authorization: `Bearer ${await gcpAccessToken()}` };
    const { getRequestIP } = await import("@tanstack/react-start/server");
    ip = clientIp(req.headers, getRequestIP());
  } catch (e) {
    console.error("[music]", e);
    return fail(req, 502, "ارتباط با سرویس موسیقی برقرار نشد.");
  }
  let cue: MusicCue;
  if ("brief" in parsed.data) {
    const fallback: MusicCue = { mood: parsed.data.mood ?? "calm", seconds: parsed.data.seconds };
    // the cue text call is paid too: 1 unit, refunded if it fails (the cue then falls back to mood/seconds)
    if (!takeHits(ip, 1, PER_IP)) return fail(req, 429, RATE_MESSAGE);
    const day = await reserveDaily(auth, bucket, PER_DAY, 1).catch(() => null);
    if (!day) return fail(req, 429, DAILY_FULL);
    try {
      // music.cue: skill text in the TEXT call's systemInstruction only; the Lyria prompt itself is built by musicPrompt
      const { value } = await geminiJson({ project, system: cueSystem(skillSystem("music.cue")), prompt: cuePrompt(parsed.data.brief, parsed.data.seconds, parsed.data.mood), schema: cueSchema(), headers: auth, maxOutputTokens: 512 });
      cue = repairCue(value, fallback);
    } catch (e) {
      console.error("[music] cue", e);
      await reserveDaily(auth, bucket, PER_DAY, -1, day).catch(() => undefined);
      cue = repairCue(null, fallback);
    }
  } else cue = parsed.data;
  const prompt = musicPrompt(cue);
  const key = await musicKey(cfg.model, prompt);
  const url = `/api/music?clip=${key.slice("music/".length)}`;
  const ok = (cache: "hit" | "miss") => Response.json({ audioUrl: url, model: cfg.model, cache, prompt, cue }, { headers: { ...cors(req), "cache-control": "no-store" } });
  try {
    if (await gcsGet(bucket, key, auth)) return ok("hit");
    const cost = Math.max(1, Math.round(Number(process.env.MUSIC_COST ?? 5)));
    if (!takeHits(ip, cost, PER_IP)) return fail(req, 429, RATE_MESSAGE);
    const day = await reserveDaily(auth, bucket, PER_DAY, cost);
    if (!day) return fail(req, 429, DAILY_FULL);
    try {
      // one English, instrumental, ≤184 s prompt → one MP3
      const made = await generateMusic({ project, model: cfg.model, prompt, headers: auth });
      await gcsPut(bucket, key, made.mp3, "audio/mpeg", auth);
      return ok("miss");
    } catch (e) {
      console.error("[music]", e);
      await reserveDaily(auth, bucket, PER_DAY, -cost, day).catch((err) => console.error("[music] refund", err));
      return fail(req, 502, "ساخت موسیقی انجام نشد؛ کمی بعد دوباره امتحان کنید.");
    }
  } catch (e) {
    console.error("[music]", e);
    return fail(req, 502, "ارتباط با سرویس موسیقی برقرار نشد.");
  }
}

async function get(req: Request): Promise<Response> {
  const bucket = process.env.TTS_BUCKET;
  if (new URL(req.url).searchParams.has("status")) {
    const enabled = Boolean(process.env.GOOGLE_CLOUD_PROJECT && bucket && lyriaConfig().enabled);
    return Response.json({ enabled, maxSeconds: LYRIA_MAX_SECONDS }, { headers: { ...cors(req), "cache-control": "no-store" } });
  }
  const clip = new URL(req.url).searchParams.get("clip") ?? "";
  if (!bucket || !CLIP.test(clip)) return fail(req, 404, "قطعه پیدا نشد.");
  try {
    const got = await gcsGet(bucket, `music/${clip}`, { authorization: `Bearer ${await gcpAccessToken()}` });
    if (!got) return fail(req, 404, "قطعه پیدا نشد.");
    return new Response(got.bytes, { headers: { ...cors(req), "content-type": "audio/mpeg", "cache-control": "private, max-age=31536000, immutable" } });
  } catch (e) {
    console.error("[music] clip", e);
    return fail(req, 502, "ارتباط با سرویس موسیقی برقرار نشد.");
  }
}

export const Route = createFileRoute("/api/music")({
  server: {
    handlers: {
      POST: ({ request }) => post(request),
      GET: ({ request }) => get(request),
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: cors(request) }),
    },
  },
});
