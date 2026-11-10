// T11: لب‌زدن از روی صدای واقعی — تحلیل داخلی بدون وابستگی (بلندی RMS + نرخ عبور از صفر).
// خالص و بدون DOM تا در Node قابل تست باشد و در رندر آفلاین برای هر فریم قطعی باشد.
import type { Viseme } from "./types.ts";

export type Mouth = { viseme: Viseme; open: number };
export type MouthTrack = { fps: number; open: Float32Array; zcr: Float32Array };

const REST: Mouth = { viseme: "rest", open: 0 };

/** بلندی (۰..۱) و «تیزی» (نرخ عبور از صفر، ۰..۱) را به شکل دهان تبدیل می‌کند. */
export function mouthFromLevel(open: number, zcr: number): Mouth {
  if (!(open >= 0.08)) return REST;
  let viseme: Viseme;
  if (open > 0.85) viseme = "shout";
  else if (zcr > 0.28) viseme = open > 0.3 ? "ee" : "fv"; // صامت‌های سایشی/ای
  else if (zcr < 0.06 && open < 0.55) viseme = "oo";
  else viseme = "ah";
  return { viseme, open: Math.min(1, open) };
}

/**
 * یک مسیر بلندی/تیزی با گام fps از نمونه‌های تک‌کاناله می‌سازد.
 * - نرمال‌سازی با صدک ۹۵ بلندی، تا صدای ضبط‌شدهٔ آرام هم دهان را باز کند.
 * - attack سریع و release آرام تا دهان لرزش نداشته باشد.
 */
export function buildMouthTrack(samples: Float32Array, sampleRate: number, fps = 30): MouthTrack {
  const hop = Math.max(1, Math.round(sampleRate / fps));
  const win = hop * 2;
  const n = Math.max(0, Math.ceil(samples.length / hop));
  const rms = new Float32Array(n);
  const zcr = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    const a = Math.max(0, f * hop - Math.floor((win - hop) / 2));
    const b = Math.min(samples.length, a + win);
    let sum = 0;
    let cross = 0;
    for (let i = a; i < b; i++) {
      const v = samples[i];
      sum += v * v;
      if (i > a && v >= 0 !== samples[i - 1] >= 0) cross++;
    }
    const len = Math.max(1, b - a);
    rms[f] = Math.sqrt(sum / len);
    zcr[f] = cross / len;
  }
  const sorted = Array.from(rms).sort((x, y) => x - y);
  const ref = Math.max(sorted[Math.floor(sorted.length * 0.95)] ?? 0, 1e-4);
  const gate = 0.12; // زیر ۱۲٪ مرجع = سکوت/نویز
  const open = new Float32Array(n);
  let prev = 0;
  for (let f = 0; f < n; f++) {
    const lvl = Math.max(0, Math.min(1, (rms[f] / ref - gate) / (1 - gate)));
    const k = lvl > prev ? 0.7 : 0.35;
    prev = prev + (lvl - prev) * k;
    open[f] = prev;
  }
  return { fps, open, zcr };
}

/** شکل دهان در زمان t (ثانیه از شروع فایل صدا). بیرون از محدوده = بسته. */
export function mouthAt(track: MouthTrack | null | undefined, t: number): Mouth | null {
  if (!track) return null;
  const f = Math.floor(t * track.fps);
  if (!(f >= 0) || f >= track.open.length) return REST;
  return mouthFromLevel(track.open[f], track.zcr[f]);
}

/** میانگین کانال‌ها برای AudioBuffer (یا هر شیء مشابه). */
export function monoOf(buf: { numberOfChannels: number; length: number; getChannelData(c: number): Float32Array }): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const out = new Float32Array(buf.length);
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += d[i] / buf.numberOfChannels;
  }
  return out;
}
