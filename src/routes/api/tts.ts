import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { MAX_LINE, TTS_MODEL, VOICE_IDS } from "@/studio/stick/voice";
import { reserveDaily } from "@/lib/tts-quota";

/**
 * صدای فارسی دیالوگ با Gemini TTS (Cloud Text-to-Speech).
 * احراز هویت با حساب سرویس Cloud Run از metadata server؛ هیچ کلیدی در کد یا مرورگر نیست.
 * کلیپ‌ها در Cloud Storage کش می‌شوند تا یک جمله دو بار هزینه نداشته باشد.
 */
const body = z.object({ text: z.string().trim().min(1).max(MAX_LINE), voice: z.enum(VOICE_IDS as [string, ...string[]]), prompt: z.string().max(300) }).strict();
const ORIGINS = new Set(["capacitor://localhost", "https://localhost", "http://localhost"]);
const WINDOW = 10 * 60_000, PER_IP = Number(process.env.TTS_PER_IP ?? 120), PER_DAY = Number(process.env.TTS_PER_DAY ?? 3000);
const hits = new Map<string, number[]>();

const cors = (req: Request): Record<string, string> => {
  const origin = req.headers.get("origin");
  return origin && ORIGINS.has(origin) ? { "access-control-allow-origin": origin, "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS", vary: "origin" } : {};
};
const fail = (req: Request, status: number, message: string) => Response.json({ message }, { status, headers: { ...cors(req), "cache-control": "no-store" } });

let token: { value: string; until: number } | null = null;
async function accessToken(): Promise<string> {
  if (token && token.until > Date.now() + 60_000) return token.value;
  const r = await fetch("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", { headers: { "Metadata-Flavor": "Google" } });
  if (!r.ok) throw new Error(`metadata token ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, until: Date.now() + j.expires_in * 1000 };
  return token.value;
}

const DAILY_FULL = "سقف روزانهٔ ساخت صدا پر شده است؛ فردا دوباره امتحان کنید.";
function limited(ip: string): string | null {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (list.length >= PER_IP) return "درخواست‌ها زیاد است؛ چند دقیقه دیگر دوباره امتحان کنید.";
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return null;
}

async function sha256(s: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function handle(req: Request): Promise<Response> {
  const project = process.env.GOOGLE_CLOUD_PROJECT, bucket = process.env.TTS_BUCKET;
  if (!project) return fail(req, 503, "سرویس صدا روی این سرور فعال نیست.");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(req, 400, "درخواست صدا معتبر نیست.");
  const { text, voice, prompt } = parsed.data;
  const key = `tts/${await sha256(`${TTS_MODEL}|${voice}|${prompt}|${text}`)}.mp3`;
  const audio = (bytes: ArrayBuffer, hit: boolean) =>
    new Response(bytes, { headers: { ...cors(req), "content-type": "audio/mpeg", "cache-control": "private, max-age=31536000, immutable", "x-cache": hit ? "hit" : "miss" } });
  try {
    const auth = { authorization: `Bearer ${await accessToken()}` };
    if (bucket) {
      const cached = await fetch(`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(key)}?alt=media`, { headers: auth });
      if (cached.ok) return audio(await cached.arrayBuffer(), true);
    }
    // Cloud Run نشانی واقعی کاربر را به آخر x-forwarded-for اضافه می‌کند؛ مقدارهای قبلی را خود کاربر می‌تواند بفرستد
    const ip = req.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "local";
    const block = limited(ip);
    if (block) return fail(req, 429, block);
    if (!(await reserveDaily(auth, bucket, PER_DAY, 1))) return fail(req, 429, DAILY_FULL);
    const refund = () => reserveDaily(auth, bucket, PER_DAY, -1).catch((e) => console.error("[tts] refund", e));
    const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: { ...auth, "x-goog-user-project": project, "content-type": "application/json" },
      body: JSON.stringify({ input: { text, prompt }, voice: { languageCode: "fa-IR", name: voice, modelName: TTS_MODEL }, audioConfig: { audioEncoding: "MP3", sampleRateHertz: 24000 } }),
    }).catch(async (e: unknown) => {
      await refund();
      throw e;
    });
    if (!r.ok) {
      console.error("[tts]", r.status, (await r.text()).slice(0, 500));
      await refund();
      return fail(req, 502, "ساخت صدا انجام نشد؛ کمی بعد دوباره امتحان کنید.");
    }
    const bytes = Uint8Array.from(atob(((await r.json()) as { audioContent: string }).audioContent), (c) => c.charCodeAt(0)).buffer;
    if (bucket)
      await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(key)}`, { method: "POST", headers: { ...auth, "content-type": "audio/mpeg" }, body: bytes }).catch((e) => console.error("[tts] cache", e));
    return audio(bytes, false);
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
