import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { skillSystem } from "@/ai/skills";
import { MAX_LINE, VOICE_IDS } from "@/studio/stick/voice";
import { reserveDaily } from "@/lib/tts-quota";
import { clientIp } from "@/lib/rate-limit";
import { gcpAccessToken } from "@/lib/gcp-auth.server";
import { geminiJson } from "@/lib/gemini-text.server";
import { cors, fail, takeHits } from "@/lib/voice-limits.server";
import { directionPrompt, directionSchema, directionSystem, fallbackDirection, MAX_DIRECTION_LINES, repairDirection, type DirectionIn } from "@/lib/voice-direction";

/**
 * کارگردانی صدا: یک تماس متنی Gemini 3.8 Flash (مهارت tts.line در systemInstruction) برای هر شخصیت صدا و برای هر دیالوگ
 * لحن کوتاه انگلیسی پیشنهاد می‌دهد. اگر سرور GCP ندارد، سقف پر است یا مدل خطا داد، همان انتخاب فعلی برمی‌گردد
 * (source: "fallback") تا صداگذاری هرگز به این تماس وابسته نباشد. متن مهارت هرگز به TTS نمی‌رود.
 * POST {cast:[{id,name?,kind,voice}], lines:[{id,speaker,text,mood?,style}]} → DirectionOut
 */
const voice = z.enum(VOICE_IDS as [string, ...string[]]);
const body = z.object({
  cast: z.array(z.object({ id: z.string().min(1).max(100), name: z.string().max(80).optional(), kind: z.string().max(20), voice }).strict()).min(1).max(8),
  lines: z.array(z.object({ id: z.string().min(1).max(80), speaker: z.string().min(1).max(100), text: z.string().min(1).max(MAX_LINE), mood: z.string().max(20).optional(), style: z.string().max(300) }).strict()).min(1).max(MAX_DIRECTION_LINES),
}).strict();
const PER_IP = Number(process.env.TTS_PER_IP ?? 120), PER_DAY = Number(process.env.TTS_PER_DAY ?? 3000);

async function post(req: Request): Promise<Response> {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(req, 400, "درخواست کارگردانی صدا معتبر نیست.");
  const input = parsed.data as DirectionIn;
  const reply = (o: unknown) => Response.json(o, { headers: { ...cors(req), "cache-control": "no-store" } });
  const project = process.env.GOOGLE_CLOUD_PROJECT, bucket = process.env.TTS_BUCKET;
  if (!project) return reply(fallbackDirection(input, "کارگردانی هوشمند روی این سرور فعال نیست؛ انتخاب فعلی ماند."));
  try {
    const auth = { authorization: `Bearer ${await gcpAccessToken()}` };
    const { getRequestIP } = await import("@tanstack/react-start/server");
    if (!takeHits(clientIp(req.headers, getRequestIP()), 1, PER_IP)) return reply(fallbackDirection(input, "درخواست‌ها زیاد است؛ انتخاب فعلی ماند."));
    const day = await reserveDaily(auth, bucket, PER_DAY, 1);
    if (!day) return reply(fallbackDirection(input, "سقف روزانه پر است؛ انتخاب فعلی ماند."));
    try {
      const { value, model } = await geminiJson({ project, system: directionSystem(skillSystem("tts.line")), prompt: directionPrompt(input), schema: directionSchema(), headers: auth });
      return reply(repairDirection(value, input, model));
    } catch (e) {
      console.error("[voice-direction]", e);
      await reserveDaily(auth, bucket, PER_DAY, -1, day).catch(() => undefined);
      return reply(fallbackDirection(input, "مدل جواب نداد؛ انتخاب فعلی ماند."));
    }
  } catch (e) {
    console.error("[voice-direction]", e);
    return reply(fallbackDirection(input, "ارتباط با سرور برقرار نشد؛ انتخاب فعلی ماند."));
  }
}

export const Route = createFileRoute("/api/voice-direction")({
  server: {
    handlers: {
      POST: ({ request }) => post(request),
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: cors(request) }),
    },
  },
});
