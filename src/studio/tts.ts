/**
 * ساخت صدای فارسی از متن دیالوگ، کاملاً داخل مرورگر (بدون سرور و بدون توکن):
 * موتور Piper (MIT) با onnxruntime-web؛ صداهای فارسی fa_IR «amir» و «gyro».
 * بار اول فایل صدا (حدود ۶۳ مگابایت) از Hugging Face دانلود و در حافظهٔ مرورگر (OPFS) نگه داشته می‌شود؛
 * دفعه‌های بعد بدون دانلود ساخته می‌شود.
 */
import { splitDirections } from "./script-plan.ts";

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
): Promise<{ blob: Blob; seconds: number }> {
  const clean = speakableText(text);
  if (!clean) throw new Error("این نما متنی برای خواندن ندارد.");
  const s = await session(voice, onProgress);
  onProgress?.({ phase: "speak", ratio: 0 });
  const blob = await s.predict(clean);
  const seconds = wavDuration(await blob.arrayBuffer());
  onProgress?.({ phase: "speak", ratio: 1 });
  return { blob, seconds };
}
