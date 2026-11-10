/**
 * ساخت صدای فارسی از متن دیالوگ، کاملاً داخل مرورگر (بدون سرور و بدون توکن):
 * موتور Piper (MIT) با onnxruntime-web؛ صداهای فارسی fa_IR «amir» و «gyro».
 * بار اول فایل صدا (حدود ۶۳ مگابایت) از Hugging Face دانلود و در حافظهٔ مرورگر (OPFS) نگه داشته می‌شود؛
 * دفعه‌های بعد بدون دانلود ساخته می‌شود.
 * هر کلیپ یک VisemeTimeline دامنه‌ای (`timing: "amplitude"`) هم دارد (piperTimeline → align.ts).
 */
import { splitDirections } from "./script-plan.ts";
import { alignLine } from "./v2/align.ts";
import type { VisemeTimeline } from "./v2/viseme-timeline.ts";

export type VoiceId = "fa_IR-amir-medium" | "fa_IR-gyro-medium";

export const VOICES: { id: VoiceId; label: string }[] = [
  { id: "fa_IR-amir-medium", label: "امیر (صدای مرد)" },
  { id: "fa_IR-gyro-medium", label: "جایرو (صدای مرد)" },
];

export type TtsProgress = { phase: "download" | "speak"; ratio: number };

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

/** First channel of a 16-bit PCM WAV as floats (Piper writes 22.05 kHz mono). Empty for anything else. */
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

/** Lip timing for an offline Piper clip: amplitude runs aligned to the script words (no STT offline). */
export function piperTimeline(text: string, wav: ArrayBuffer, voice: string): VisemeTimeline {
  const { samples, sampleRate } = wavMono(wav);
  const duration = sampleRate ? samples.length / sampleRate : wavDuration(wav);
  return alignLine(samples.length ? { text, duration, samples, sampleRate } : { text, duration }, { voice: { engine: "piper", name: voice } });
}

type Session = { predict(text: string): Promise<Blob> };
let current: { voice: VoiceId; session: Promise<Session> } | null = null;

async function session(voice: VoiceId, onProgress?: (p: TtsProgress) => void): Promise<Session> {
  if (current?.voice === voice) return current.session;
  const lib = await import("@mintplex-labs/piper-tts-web");
  // کتابخانه فقط یک جلسه نگه می‌دارد؛ برای عوض کردن صدا باید جلسهٔ قبلی کنار برود.
  (lib.TtsSession as unknown as { _instance: unknown })._instance = null;
  const s = lib.TtsSession.create({
    voiceId: voice,
    progress: (p: { url: string; loaded: number; total: number }) => {
      if (p.total > 0 && p.url.includes(".onnx") && !p.url.endsWith(".json")) {
        onProgress?.({ phase: "download", ratio: p.loaded / p.total });
      }
    },
  }) as Promise<Session>;
  current = { voice, session: s };
  s.catch(() => {
    if (current?.session === s) current = null;
  });
  return s;
}

/** صدای یک جمله؛ خروجی WAV و مدت آن. */
export async function speak(
  text: string,
  voice: VoiceId,
  onProgress?: (p: TtsProgress) => void,
): Promise<{ blob: Blob; seconds: number; timeline: VisemeTimeline }> {
  const clean = speakableText(text);
  if (!clean) throw new Error("این نما متنی برای خواندن ندارد.");
  const s = await session(voice, onProgress);
  onProgress?.({ phase: "speak", ratio: 0 });
  const blob = await s.predict(clean);
  const buf = await blob.arrayBuffer();
  const seconds = wavDuration(buf);
  const timeline = piperTimeline(clean, buf, voice);
  onProgress?.({ phase: "speak", ratio: 1 });
  return { blob, seconds, timeline };
}
