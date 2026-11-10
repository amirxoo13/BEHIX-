/**
 * صدای فارسی دیالوگ‌ها با Gemini 3.8 TTS روی Google Cloud (سرور خود BEHIX، مسیر /api/voice).
 * سرور: Gemini TTS ← Speech-to-Text v2 (chirp_2، زمان واقعی هر کلمه) ← زمان‌بندی لب (VisemeTimeline)؛ کلیپ در Cloud Storage کش می‌شود.
 * هیچ سرویس یا کلیدی بیرون از Google Cloud نیست؛ کاربر باید وارد حساب (Firebase) شده باشد چون ساخت صدا هزینه دارد.
 */
import { authFetch } from "../lib/user-auth.ts";
import { splitDirections } from "./script-plan.ts";
import type { VisemeTimeline } from "./v2/viseme-timeline.ts";

/** صداهای Gemini TTS (شناسه‌های رسمی مدل) با برچسب فارسی. */
export const VOICES = [
  { id: "Charon", label: "کارون (مرد، بم)" },
  { id: "Kore", label: "کوره (زن)" },
  { id: "Orus", label: "اوروس (مرد)" },
  { id: "Aoede", label: "آئوده (زن)" },
  { id: "Iapetus", label: "یاپتوس (مرد)" },
  { id: "Leda", label: "لدا (زن)" },
  { id: "Alnilam", label: "النیلام (مرد)" },
  { id: "Zephyr", label: "زفیر (زن)" },
  { id: "Puck", label: "پاک (مرد)" },
  { id: "Despina", label: "دسپینا (زن)" },
] as const;
export type VoiceId = (typeof VOICES)[number]["id"];

/** سقف طول یک دیالوگ در سرور (همان MAX_LINE در /api/voice). */
export const MAX_SPOKEN = 400;
const API = ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE ?? "").replace(/\/$/, "");

export type TtsProgress = { phase: "speak"; ratio: number };

/** متنی که خوانده می‌شود: بدون پرانتزهای توضیح بازیگری و بدون فاصله‌های اضافه. */
export function speakableText(dialogue: string): string {
  return splitDirections(dialogue).said.replace(/[«»"]/g, "").trim();
}

/** مدت فایل WAV (ثانیه) از روی سرآیند آن؛ برای هم‌اندازه کردن مدت نما با صدا. */
export function wavDuration(buf: ArrayBuffer): number {
  const v = new DataView(buf);
  if (buf.byteLength < 44 || v.getUint32(0, false) !== 0x52494646) return 0; // "RIFF"
  const channels = v.getUint16(22, true);
  const rate = v.getUint32(24, true);
  const bits = v.getUint16(34, true);
  // دنبال تکهٔ "data" می‌گردیم (ممکن است بعد از تکه‌های دیگر باشد).
  let p = 12;
  while (p + 8 <= buf.byteLength) {
    const id = v.getUint32(p, false);
    const size = v.getUint32(p + 4, true);
    if (id === 0x64617461) return size / (rate * channels * (bits / 8)); // "data"
    p += 8 + size;
  }
  return 0;
}

/** First channel of a 16-bit PCM WAV as floats. Empty for anything else. */
export function wavMono(buf: ArrayBuffer): { samples: Float32Array; sampleRate: number } {
  const v = new DataView(buf);
  if (buf.byteLength < 44 || v.getUint32(0, false) !== 0x52494646) return { samples: new Float32Array(0), sampleRate: 0 };
  const channels = v.getUint16(22, true), rate = v.getUint32(24, true), bits = v.getUint16(34, true);
  if (bits !== 16 || channels < 1) return { samples: new Float32Array(0), sampleRate: rate };
  let p = 12;
  while (p + 8 <= buf.byteLength) {
    const id = v.getUint32(p, false), size = v.getUint32(p + 4, true);
    if (id === 0x64617461) {
      const end = Math.min(buf.byteLength, p + 8 + size), frames = Math.floor((end - p - 8) / (2 * channels));
      const out = new Float32Array(frames);
      for (let i = 0; i < frames; i++) out[i] = v.getInt16(p + 8 + i * 2 * channels, true) / 32768;
      return { samples: out, sampleRate: rate };
    }
    p += 8 + size;
  }
  return { samples: new Float32Array(0), sampleRate: rate };
}

/** دستور لحن برای Gemini: توضیح داخل پرانتز دیالوگ (مثلاً «با عصبانیت») + لهجهٔ محاوره‌ای تهرانی. */
export function voiceStyle(dialogue: string): string {
  const d = splitDirections(dialogue).directions.trim();
  return (d ? `${d}; natural, colloquial Tehrani Persian` : "natural, colloquial Tehrani Persian").slice(0, 300);
}

type VoiceOut = { id: string; audioUrl: string; timeline: VisemeTimeline; model: string } | { id: string; error: string; fatal?: boolean };

/** صدای یک دیالوگ با Gemini؛ خروجی WAV، مدت آن و زمان‌بندی لب از روی کلمه‌های واقعی. */
export async function speak(
  text: string,
  voice: VoiceId,
  onProgress?: (p: TtsProgress) => void,
  id = "line",
): Promise<{ blob: Blob; seconds: number; timeline: VisemeTimeline; model: string }> {
  const clean = speakableText(text);
  if (!clean) throw new Error("این نما متنی برای خواندن ندارد.");
  if (clean.length > MAX_SPOKEN) throw new Error(`دیالوگ بیش از ${MAX_SPOKEN} حرف است؛ کوتاهش کنید یا در دو نما بنویسید.`);
  onProgress?.({ phase: "speak", ratio: 0 });
  const r = await authFetch(`${API}/api/voice`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lines: [{ id, text: clean, voice, style: voiceStyle(text) }] }),
  });
  const j = (await r.json().catch(() => null)) as VoiceOut[] | { message?: string } | null;
  if (!r.ok || !Array.isArray(j)) throw new Error((j && !Array.isArray(j) && j.message) || `سرور صدا خطای ${r.status} داد.`);
  const out = j[0];
  if (!out || "error" in out) throw new Error(out?.error ?? "سرور صدایی برنگرداند.");
  const a = await authFetch(/^(https?:|data:)/.test(out.audioUrl) ? out.audioUrl : `${API}${out.audioUrl}`);
  if (!a.ok) throw new Error(`دریافت فایل صدا انجام نشد (${a.status}).`);
  const buf = await a.arrayBuffer();
  onProgress?.({ phase: "speak", ratio: 1 });
  return { blob: new Blob([buf], { type: "audio/wav" }), seconds: wavDuration(buf), timeline: out.timeline, model: out.model };
}
