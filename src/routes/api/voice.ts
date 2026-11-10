import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MAX_LINE, VOICE_IDS } from "@/studio/stick/voice";
import { reserveDaily } from "@/lib/tts-quota";
import { clientIp } from "@/lib/rate-limit";
import { gcpAccessToken } from "@/lib/gcp-auth.server";
import { synthesizeGemini, TtsError, ttsConfig } from "@/lib/gemini-tts.server";
import { recognizeWords, sttConfig } from "@/lib/gcp-stt.server";
import { gcsGet, gcsPut } from "@/lib/gcs.server";
import { cors, DAILY_FULL, fail, RATE_MESSAGE, takeHits } from "@/lib/voice-limits.server";
import { voiceLine, type VoiceDeps, type VoiceLineOut } from "@/lib/voice-line.server";

/**
 * صدا + زمان‌بندی لب برای چند دیالوگ در یک درخواست.
 * POST {lines:[{id,text,voice,style,preview?}]} → [{id, audioUrl, timeline, model, cache} | {id, error, fatal?}]
 * هر دیالوگ: Gemini 3.8 TTS ← Speech-to-Text v2 (chirp_2، fa-IR، زمان کلمه‌ها) ← align.ts ← VisemeTimeline.
 * اگر STT نشد، زمان‌بندی از دامنهٔ صدا (amplitude) یا متن ساخته می‌شود. صدا و `.viseme.json` با یک کلید در GCS کش می‌شوند.
 * GET ?clip=<sha256>.wav همان کلیپ کش‌شده را از GCS می‌دهد (audioUrl). /api/tts برای سازگاری می‌ماند.
 * هزینهٔ وزنی: TTS = ۱، STT = VOICE_STT_COST (پیش‌فرض ۱)؛ سهم روزانه و سقف IP مشترک با /api/tts.
 */
const MAX_LINES = 8;
const line = z.object({ id: z.string().min(1).max(80), text: z.string().trim().min(1).max(MAX_LINE), voice: z.enum(VOICE_IDS as [string, ...string[]]), style: z.string().max(300), preview: z.boolean().optional() }).strict();
const body = z.object({ lines: z.array(line).min(1).max(MAX_LINES) }).strict();
const CLIP = /^[0-9a-f]{64}\.wav$/;
const PER_IP = Number(process.env.TTS_PER_IP ?? 120), PER_DAY = Number(process.env.TTS_PER_DAY ?? 3000);

const b64 = (u: Uint8Array) => Buffer.from(u.buffer, u.byteOffset, u.byteLength).toString("base64");

async function post(req: Request): Promise<Response> {
  const project = process.env.GOOGLE_CLOUD_PROJECT, bucket = process.env.TTS_BUCKET;
  if (!project) return fail(req, 503, "سرویس صدا روی این سرور فعال نیست.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(req, 400, "درخواست صدا معتبر نیست.");
  try {
    const auth = { authorization: `Bearer ${await gcpAccessToken()}` };
    const { getRequestIP } = await import("@tanstack/react-start/server");
    const ip = clientIp(req.headers, getRequestIP());
    const tts = ttsConfig(), stt = sttConfig();
    const sttCost = Math.max(0, Math.round(Number(process.env.VOICE_STT_COST ?? 1)));
    // VoiceDeps counts 1 unit per STT call; VOICE_STT_COST scales that unit for the IP limit and daily quota.
    const weigh = (cost: number, sttUnits: number) => cost - sttUnits + sttUnits * sttCost;
    const deps: VoiceDeps = {
      tts,
      stt,
      get: async (name) => (bucket ? gcsGet(bucket, name, auth).then((r) => (r ? new Uint8Array(r.bytes) : null)) : null),
      put: async (name, b, type) => (bucket ? gcsPut(bucket, name, b, type, auth) : false),
      synth: async (models, text, voice, style) => {
        try {
          return await synthesizeGemini({ project, location: tts.location, models, text, voice, style, headers: auth });
        } catch (e) {
          throw e instanceof TtsError ? new Error(JSON.stringify(e.attempts)) : e;
        }
      },
      recognize: (wav, seconds) => recognizeWords({ project, wav, seconds, headers: auth, config: stt }),
      reserve: async (cost) => {
        const sttUnits = stt.enabled ? 1 : 0;
        const w = weigh(cost, Math.min(cost, sttUnits));
        if (w <= 0) return { refund: async () => {} };
        if (!takeHits(ip, w, PER_IP)) return { refused: RATE_MESSAGE };
        const day = await reserveDaily(auth, bucket, PER_DAY, w);
        if (!day) return { refused: DAILY_FULL };
        return {
          // refunds are either the STT unit or everything left
          refund: async (n) => {
            const back = n === cost ? w : weigh(n, Math.min(n, sttUnits));
            if (back > 0) await reserveDaily(auth, bucket, PER_DAY, -back, day);
          },
        };
      },
      audioUrl: (name, wav) => (bucket ? `/api/voice?clip=${name.slice("tts/".length)}` : `data:audio/wav;base64,${b64(wav)}`),
    };
    const out: VoiceLineOut[] = [];
    let stop: string | null = null;
    for (const l of parsed.data.lines) {
      if (stop) {
        out.push({ id: l.id, error: stop, fatal: true });
        continue;
      }
      const r = await voiceLine(l, deps);
      if ("error" in r && r.fatal) stop = r.error;
      out.push(r);
    }
    return Response.json(out, { headers: { ...cors(req), "cache-control": "no-store" } });
  } catch (e) {
    console.error("[voice]", e);
    return fail(req, 502, "ارتباط با سرویس صدا برقرار نشد.");
  }
}

async function get(req: Request): Promise<Response> {
  const bucket = process.env.TTS_BUCKET;
  const clip = new URL(req.url).searchParams.get("clip") ?? "";
  if (!bucket || !CLIP.test(clip)) return fail(req, 404, "کلیپ پیدا نشد.");
  try {
    const got = await gcsGet(bucket, `tts/${clip}`, { authorization: `Bearer ${await gcpAccessToken()}` });
    if (!got) return fail(req, 404, "کلیپ پیدا نشد.");
    return new Response(got.bytes, { headers: { ...cors(req), "content-type": "audio/wav", "cache-control": "private, max-age=31536000, immutable" } });
  } catch (e) {
    console.error("[voice] clip", e);
    return fail(req, 502, "ارتباط با سرویس صدا برقرار نشد.");
  }
}

export const Route = createFileRoute("/api/voice")({
  server: {
    handlers: {
      POST: ({ request }) => post(request),
      GET: ({ request }) => get(request),
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: cors(request) }),
    },
  },
});
