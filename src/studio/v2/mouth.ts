/**
 * لب‌خوانی استودیو (خالص؛ در Node قابل آزمون).
 * - زمان‌بندی از «صدای نهایی» می‌آید: بازه‌های صدادار از پوش انرژی همان فایل صدا (MouthTrack) پیدا می‌شود.
 * - شکل دهان از متن دیالوگ می‌آید: حروف فارسی به ۹ شکل دهان نگاشت و روی بازه‌های صدادار پخش می‌شوند.
 *   (این هم‌ترازی تقریبی است، نه تشخیص واج؛ برای همین هر نشانه روی تایم‌لاین دستی قابل جابه‌جایی و تغییر است.)
 * - نشانه‌ها (MouthCue) در خود نما ذخیره می‌شوند تا ویرایش دستی بماند.
 */
import type { MouthTrack } from "../lipsync.ts";

export const VISEMES = {
  rest: "بسته (سکوت)",
  mbp: "م / ب / پ",
  ah: "آ",
  eh: "اَ / اِ",
  ee: "ای / س / ش",
  oh: "اُ",
  oo: "او",
  fv: "ف / و",
  l: "ل / ن / د / ت",
} as const;
export type Viseme2 = keyof typeof VISEMES;
export const VISEME_IDS = Object.keys(VISEMES) as Viseme2[];

/** یک نشانهٔ دهان: از لحظهٔ t (ثانیه از شروع نما) این شکل، تا نشانهٔ بعدی. */
export type MouthCue = { t: number; v: Viseme2 };
export type MouthEdit = {
  /** جابه‌جایی کل نشانه‌ها نسبت به صدا (ثانیه؛ مثبت = دیرتر). */
  offset: number;
  cues: MouthCue[];
  /** true یعنی کاربر دستی ویرایش کرده و ساخت خودکار نباید رویش بنویسد. */
  manual: boolean;
};

const MAP: Record<string, Viseme2> = {};
const put = (chars: string, v: Viseme2) => { for (const c of chars) MAP[c] = v; };
put("اآأإعىٰ", "ah");
put("وؤ", "oo");
put("یيئی", "ee");
put("بپم", "mbp");
put("ف", "fv");
put("لندتطر", "l");
put("سشزژصضظذثچج", "ee");
put("کگخغقحهةك", "eh");
const VOWEL = new Set<Viseme2>(["ah", "oo", "ee"]);
const PAUSE = /[،,.؟?!…؛:\n]/;

/** دنبالهٔ شکل دهان از متن فارسی؛ بین دو صامت پشت‌سرهم یک مصوّت کوتاه (eh) گذاشته می‌شود. */
export function visemesOfText(text: string): Viseme2[] {
  const out: Viseme2[] = [];
  const push = (v: Viseme2) => { if (out[out.length - 1] !== v) out.push(v); };
  for (const word of text.split(/\s+/)) {
    let prevConsonant = false;
    let any = false;
    for (const ch of word) {
      if (PAUSE.test(ch)) continue;
      const v = MAP[ch];
      if (!v) continue;
      const vowel = VOWEL.has(v);
      if (!vowel && prevConsonant) push("eh");
      push(v);
      prevConsonant = !vowel;
      any = true;
    }
    // «ه» آخر کلمه معمولاً «ـِه» خوانده می‌شود و صامت آخر یک رهاسازی کوتاه دارد.
    if (any && prevConsonant && out[out.length - 1] !== "mbp") push("eh");
    if (any && PAUSE.test(word.slice(-1))) push("rest");
  }
  while (out[out.length - 1] === "rest") out.pop();
  return out;
}

export type Voiced = { from: number; to: number };
const GATE = 0.08;

/** بازه‌های صدادار فایل صدا (ثانیه)، با پر کردن مکث‌های کوتاه‌تر از ۷۰ میلی‌ثانیه. */
export function voicedRuns(track: MouthTrack): Voiced[] {
  const runs: Voiced[] = [];
  const step = 1 / track.fps;
  let start = -1;
  for (let i = 0; i <= track.open.length; i++) {
    const on = i < track.open.length && track.open[i] >= GATE;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      const from = start * step, to = i * step;
      const last = runs[runs.length - 1];
      if (last && from - last.to < 0.07) last.to = to;
      else runs.push({ from, to });
      start = -1;
    }
  }
  return runs.filter((r) => r.to - r.from >= 0.04);
}

/** کمترین فاصلهٔ دو شکل دهان؛ تندتر از این لرزش دیده می‌شود. */
export const MIN_CUE = 0.07;

function thin(seq: Viseme2[], max: number): Viseme2[] {
  if (seq.length <= max || max < 1) return seq.slice(0, Math.max(1, max));
  // بستن لب (م/ب/پ) و ف مهم‌ترند و نگه داشته می‌شوند؛ بقیه یکنواخت کم می‌شوند.
  const keep = new Set<number>();
  seq.forEach((v, i) => { if (v === "mbp" || v === "fv") keep.add(i); });
  const stepSize = seq.length / max;
  for (let k = 0; k < max && keep.size < max; k++) keep.add(Math.min(seq.length - 1, Math.round(k * stepSize)));
  return seq.filter((_, i) => keep.has(i)).slice(0, max);
}

/** نشانه‌های دهان از روی صدای نهایی + متن. at = لحظهٔ شروع صدا داخل نما (ثانیه). */
export function cuesFromAudio(track: MouthTrack, text: string, at = 0): MouthCue[] {
  const runs = voicedRuns(track);
  const voiced = runs.reduce((s, r) => s + (r.to - r.from), 0);
  const all = visemesOfText(text).filter((v) => v !== "rest");
  if (runs.length === 0 || voiced <= 0 || all.length === 0) return [];
  const seq = thin(all, Math.max(1, Math.floor(voiced / MIN_CUE)));
  const cues: MouthCue[] = [];
  const each = voiced / seq.length;
  let r = 0;
  let before = 0; // مجموع طول بازه‌های صدادار قبلی
  seq.forEach((v, i) => {
    const pos = i * each;
    while (r < runs.length - 1 && pos >= before + (runs[r].to - runs[r].from)) {
      before += runs[r].to - runs[r].from;
      cues.push({ t: round(at + runs[r].to), v: "rest" });
      r++;
    }
    cues.push({ t: round(at + runs[r].from + (pos - before)), v });
  });
  cues.push({ t: round(at + runs[runs.length - 1].to), v: "rest" });
  return dedupe(cues);
}

/** وقتی هنوز صدایی نیست: همان شکل‌ها با زمان‌بندی یکنواخت در بازهٔ [from, to]. */
export function cuesFromText(text: string, from: number, to: number): MouthCue[] {
  const all = visemesOfText(text);
  const span = to - from;
  if (all.length === 0 || span <= 0) return [];
  const seq = thin(all, Math.max(1, Math.floor(span / MIN_CUE)));
  const each = span / seq.length;
  const cues = seq.map((v, i) => ({ t: round(from + i * each), v }));
  cues.push({ t: round(to), v: "rest" as Viseme2 });
  return dedupe(cues);
}

const round = (t: number) => Math.round(t * 1000) / 1000;

function dedupe(cues: MouthCue[]): MouthCue[] {
  const sorted = [...cues].sort((a, b) => a.t - b.t);
  return sorted.filter((c, i) => i === 0 || c.v !== sorted[i - 1].v);
}

const OPEN: Record<Viseme2, number> = { rest: 0, mbp: 0, ah: 0.9, eh: 0.6, ee: 0.4, oh: 0.7, oo: 0.4, fv: 0.3, l: 0.5 };

/**
 * شکل دهان در لحظهٔ t نما.
 * level = بلندی صدا در همان لحظه (۰ تا ۱) اگر صدا موجود است؛ در حالت خودکار، سکوتِ واقعی دهان را می‌بندد.
 * در حالت دستی (manual) نشانه‌ها حرف آخر را می‌زنند.
 */
export function mouthAtCue(edit: MouthEdit | null | undefined, t: number, level: number | null = null): { viseme: Viseme2; open: number } {
  if (!edit || edit.cues.length === 0) return { viseme: "rest", open: 0 };
  const local = t - edit.offset;
  let cur: MouthCue | null = null;
  for (const c of edit.cues) {
    if (c.t <= local) cur = c;
    else break;
  }
  if (!cur || cur.v === "rest") return { viseme: "rest", open: 0 };
  if (!edit.manual && level !== null && level < GATE * 0.75) return { viseme: "rest", open: 0 };
  const base = OPEN[cur.v];
  const open = level === null ? base : Math.max(0.3, Math.min(1, base * (0.55 + 0.75 * level)));
  return { viseme: cur.v, open: cur.v === "mbp" ? 0 : open };
}

/** نشانه‌های معتبر و مرتب از دادهٔ خام (فایل پروژه)؛ هرگز throw نمی‌کند. */
export function repairMouth(v: unknown, duration: number): MouthEdit | undefined {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  if (!o || !Array.isArray(o.cues)) return undefined;
  const cues: MouthCue[] = [];
  for (const c of o.cues.slice(0, 600)) {
    const q = c && typeof c === "object" ? (c as Record<string, unknown>) : null;
    if (!q || typeof q.t !== "number" || !Number.isFinite(q.t) || q.t < 0 || q.t > duration + 5) continue;
    if (typeof q.v !== "string" || !(q.v in VISEMES)) continue;
    cues.push({ t: round(q.t), v: q.v as Viseme2 });
  }
  cues.sort((a, b) => a.t - b.t);
  const offset = typeof o.offset === "number" && Number.isFinite(o.offset) ? Math.max(-1, Math.min(1, o.offset)) : 0;
  return { offset, cues, manual: o.manual === true };
}
