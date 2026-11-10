import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { LEGACY_CACHE_MODEL, MAX_LINE, VOICE_IDS } from "@/studio/stick/voice";
import { reserveDaily } from "@/lib/tts-quota";
import { clientIp } from "@/lib/rate-limit";
import { gcpAccessToken } from "@/lib/gcp-auth.server";
import { cacheKey, modelChain, synthesizeGemini, TtsError, ttsConfig } from "@/lib/gemini-tts.server";
import { gcsGet, gcsPut } from "@/lib/gcs.server";
import { cors, DAILY_FULL, fail, RATE_MESSAGE, takeHits } from "@/lib/voice-limits.server";

/**
 * صدای فارسی دیالوگ با Gemini 3.8 TTS روی Agent Platform (generateContent؛ جزئیات در gemini-tts.server.ts).
 * زنجیرهٔ جایگزین: TTS_MODEL (Flash) ← TTS_PREVIEW_MODEL (Flash-Lite) ← خطای تمیز برای همان دیالوگ (502).
 * کلیپ‌های قدیمی MP3 (Gemini 2.5) فقط از کش خوانده می‌شوند و هیچ کلیپ تازه‌ای با 2.5 ساخته نمی‌شود.
 * احراز هویت با اعتبار پیش‌فرض Google Cloud (حساب سرویس Cloud Run یا gcloud محلی)؛ هیچ کلیدی در کد یا مرورگر نیست.
 * کلیپ‌ها در Cloud Storage کش می‌شوند تا یک جمله دو بار هزینه نداشته باشد.
 */
const body = z.object({ text: z.string().trim().min(1).max(MAX_LINE), voice: z.enum(VOICE_IDS as [string, ...string[]]), prompt: z.string().max(300), preview: z.boolean().optional(), legacyPrompt: z.string().max(300).optional() }).strict();
const PER_IP = Number(process.env.TTS_PER_IP ?? 120), PER_DAY = Number(process.env.TTS_PER_DAY ?? 3000);

async function handle(req: Request): Promise<Response> {
  const project = process.env.GOOGLE_CLOUD_PROJECT, bucket = process.env.TTS_BUCKET;
  if (!project) return fail(req, 503, "سرویس صدا روی این سرور فعال نیست.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(req, 400, "درخواست صدا معتبر نیست.");
  // legacyPrompt = دستور لحن قدیمی همان دیالوگ، فقط برای پیدا کردن MP3 کش‌شدهٔ 2.5 (به مدل فرستاده نمی‌شود)
  const { text, voice, prompt, preview, legacyPrompt } = parsed.data;
  const cfg = ttsConfig();
  const models = modelChain(cfg, preview);
  // کلید کش مدل را دارد؛ اول کلیپ‌های 3.8، بعد کلیپ قدیمی MP3 همان جمله (فقط خواندن).
  const lookups = [...(await Promise.all(models.map(async (m) => ({ key: await cacheKey(m, voice, prompt, text), model: m, type: "audio/wav" })))),
    ...(preview ? [] : [{ key: await cacheKey(LEGACY_CACHE_MODEL, voice, legacyPrompt ?? prompt, text, "mp3"), model: LEGACY_CACHE_MODEL, type: "audio/mpeg" }])];
  const audio = (bytes: ArrayBuffer | Uint8Array, hit: boolean, model: string, type: string) =>
    new Response(bytes as BodyInit, { headers: { ...cors(req), "content-type": type, "cache-control": "private, max-age=31536000, immutable", "x-cache": hit ? "hit" : "miss", "x-tts-model": model } });
  try {
    const auth = { authorization: `Bearer ${await gcpAccessToken()}` };
    if (bucket) {
      for (const l of lookups) {
        const cached = await gcsGet(bucket, l.key, auth);
        if (cached) return audio(cached.bytes, true, l.model, l.type);
      }
    }
    // پشت Cloud Run یا nginx آدرس واقعی را پراکسی می‌نویسد؛ کدام هدر قابل‌اعتماد است را TRUSTED_IP_HEADER می‌گوید.
    const { getRequestIP } = await import("@tanstack/react-start/server");
    const ip = clientIp(req.headers, getRequestIP());
    if (!takeHits(ip, 1, PER_IP)) return fail(req, 429, RATE_MESSAGE);
    const reserved = await reserveDaily(auth, bucket, PER_DAY, 1);
    if (!reserved) return fail(req, 429, DAILY_FULL);
    const refund = () => reserveDaily(auth, bucket, PER_DAY, -1, reserved).catch((e) => console.error("[tts] refund", e));
    let made: Awaited<ReturnType<typeof synthesizeGemini>>;
    try {
      made = await synthesizeGemini({ project, location: cfg.location, models, text, voice, style: prompt, headers: auth });
    } catch (e) {
      console.error("[tts]", e instanceof TtsError ? JSON.stringify(e.attempts) : e);
      await refund();
      return fail(req, 502, "ساخت صدای این دیالوگ انجام نشد؛ کمی بعد دوباره امتحان کنید.");
    }
    if (bucket) {
      const key = lookups.find((l) => l.model === made.model)?.key ?? (await cacheKey(made.model, voice, prompt, text));
      await gcsPut(bucket, key, made.bytes, "audio/wav", auth);
    }
    return audio(made.bytes, false, made.model, "audio/wav");
  } catch (e) {
    console.error("[tts]", e);
    return fail(req, 502, "ارتباط با سرویس صدا برقرار نشد.");
  }
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: ({ request }) => handle(request),
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: cors(request) }),
    },
  },
});
