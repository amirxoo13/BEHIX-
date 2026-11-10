/**
 * لب‌خوانی استودیو (خالص؛ در Node قابل آزمون).
 * - زمان‌بندی از «صدای نهایی» می‌آید: بازه‌های صدادار از پوش انرژی همان فایل صدا (MouthTrack) پیدا می‌شود.
 * - شکل دهان از متن دیالوگ می‌آید: حروف فارسی به ۱۱ شکل دهان (VisemeId) نگاشت و روی بازه‌های صدادار پخش می‌شوند.
 *   (این هم‌ترازی تقریبی است، نه تشخیص واج؛ برای همین هر نشانه روی تایم‌لاین دستی قابل جابه‌جایی و تغییر است.)
 * - نشانه‌ها (MouthCue) در خود نما ذخیره می‌شوند تا ویرایش دستی بماند.
 */
import type { MouthTrack } from "../lipsync.ts";
import type { Viseme as LegacyViseme } from "../types.ts";

export const VISEMES = {
  rest: "بسته (سکوت)",
  mbp: "م / ب / پ",
  ah: "آ",
  eh: "اَ / اِ",
  ee: "ای",
  oh: "اُ",
  oo: "او",
  fv: "ف / و",
  l: "ل / ن / د / ت",
  sz: "س / ز / ش / ژ / چ / ج",
  wide: "لب کشیده (لبخند)",
} as const;
/**
 * شناسهٔ مشترک شکل دهان (۱۱ تا، ثابت). همهٔ بخش‌ها (صدا، عروسک، شخصیت ساختهٔ هوش مصنوعی) همین شناسه‌ها را
 * به کار می‌برند؛ هنرِ هر شکل برای هر شخصیت جداست و اگر نبود، VISEME_FALLBACK جایگزین می‌دهد.
 */
export type VisemeId = keyof typeof VISEMES;
/** نام قبلی، برای سازگاری. */
export type Viseme2 = VisemeId;
export const VISEME_IDS = Object.keys(VISEMES) as VisemeId[];

/**
 * یک بازهٔ شکل دهان، بر حسب ثانیه از شروع نما (میلی‌ثانیه فقط در مرز سرویس صدا).
 * weight (۰ تا ۱، پیش‌فرض ۱) شدت شکل است و در هم‌آمیزی کوتاه با شکل قبلی به کار می‌رود.
 */
export type VisemeSpan = { id: VisemeId; start: number; end: number; weight?: number };

/** بیشترین طول هم‌آمیزی دو شکل دهان (ثانیه). پیش‌فرض بدون هم‌آمیزی (تعویض مستقیم تصویر). */
export const MAX_CROSSFADE = 0.06;

/**
 * اگر هنرِ یک شکل برای شخصیتی نبود، شکل بعدی این زنجیره:
 * sz→ee→eh→ah، wide→eh، oh→oo→ah، l→eh، fv→mbp→rest. ah و rest پایان زنجیره‌اند.
 */
export const VISEME_FALLBACK: Readonly<Partial<Record<VisemeId, VisemeId>>> = {
  sz: "ee",
  ee: "eh",
  eh: "ah",
  wide: "eh",
  oh: "oo",
  oo: "ah",
  l: "eh",
  fv: "mbp",
  mbp: "rest",
};

/** نزدیک‌ترین شکلی که هنرش موجود است (has)؛ اگر هیچ‌کدام نبود، rest. */
export function resolveViseme(id: VisemeId, has: (v: VisemeId) => boolean): VisemeId {
  let cur: VisemeId | undefined = id;
  for (let i = 0; cur && i <= VISEME_IDS.length; i++) {
    if (has(cur)) return cur;
    cur = VISEME_FALLBACK[cur];
  }
  return "rest";
}

/** نگاشت شش شکل قدیمی (سر عکسی، types.ts) به شناسه‌های جدید؛ shout = ah با شدت کامل. */
export const LEGACY_VISEME: Readonly<Record<LegacyViseme, { id: VisemeId; weight: number }>> = {
  rest: { id: "rest", weight: 1 },
  ah: { id: "ah", weight: 0.9 },
  ee: { id: "ee", weight: 1 },
  oo: { id: "oo", weight: 1 },
  fv: { id: "fv", weight: 1 },
  shout: { id: "ah", weight: 1 },
};

/** برعکس: شکل جدید برای سر عکسی که فقط شش شکل قدیمی را دارد. */
export const TO_LEGACY_VISEME: Readonly<Record<VisemeId, LegacyViseme>> = {
  rest: "rest",
  mbp: "rest",
  ah: "ah",
  eh: "ah",
  ee: "ee",
  oh: "oo",
  oo: "oo",
  fv: "fv",
  l: "ee",
  sz: "ee",
  wide: "ee",
};

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
put("سزصضظذثشژچج", "sz"); // s z ʃ ʒ tʃ dʒ (قرارداد قفل‌شده با بخش صدا)
put("\u064F", "oh"); // ضمه
put("کگخغقحهةك", "eh");
const VOWEL = new Set<Viseme2>(["ah", "oo", "ee", "oh"]);
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

const OPEN: Record<Viseme2, number> = { rest: 0, mbp: 0, ah: 0.9, eh: 0.6, ee: 0.4, oh: 0.7, oo: 0.4, fv: 0.3, l: 0.5, sz: 0.25, wide: 0.45 };

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

/* ---------- بازه‌ها (VisemeSpan) ---------- */

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * بازه‌های معتبر، مرتب و بی‌هم‌پوشانی؛ بازهٔ کوتاه‌تر از MIN_CUE در همسایهٔ چسبیده ادغام می‌شود
 * (اول قبلی، بعد بعدی) تا دهان نلرزد. هرگز throw نمی‌کند.
 */
export function normalizeSpans(spans: readonly VisemeSpan[], min = MIN_CUE): VisemeSpan[] {
  const list = spans
    .filter((s) => s && s.id in VISEMES && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .map((s) => ({ ...s }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out: VisemeSpan[] = [];
  for (const s of list) {
    const prev = out[out.length - 1];
    if (prev && s.start < prev.end) s.start = prev.end; // هم‌پوشانی: بعدی از پایان قبلی شروع می‌شود
    if (s.end <= s.start) continue;
    if (prev && prev.id === s.id && s.start - prev.end < 1e-6) { prev.end = s.end; continue; }
    out.push(s);
  }
  const EPS = 1e-6;
  // هر بار یک ادغام، تا وقتی بازهٔ کوتاهِ چسبیده‌ای نماند (بازهٔ کوتاهِ تنها همان‌طور می‌ماند)
  for (let merged = true; merged && out.length > 1; ) {
    merged = false;
    for (let i = 0; i < out.length && !merged; i++) {
      const s = out[i];
      if (s.end - s.start >= min - EPS) continue;
      const prev = out[i - 1], next = out[i + 1];
      if (prev && s.start - prev.end < EPS) { prev.end = s.end; out.splice(i, 1); merged = true; }
      else if (next && next.start - s.end < EPS) { next.start = s.start; out.splice(i, 1); merged = true; }
    }
  }
  return out.map((s) => ({ ...s, start: round(s.start), end: round(s.end) }));
}

/** بازه‌ها → نشانه‌های تایم‌لاین (MouthCue)؛ فاصلهٔ بین بازه‌ها rest است. */
export function spansToCues(spans: readonly VisemeSpan[]): MouthCue[] {
  const cues: MouthCue[] = [];
  const list = normalizeSpans(spans);
  list.forEach((s, i) => {
    cues.push({ t: s.start, v: s.id });
    const next = list[i + 1];
    if (!next || next.start - s.end > 1e-6) cues.push({ t: s.end, v: "rest" });
  });
  return dedupe(cues);
}

/** نشانه‌ها → بازه‌ها؛ آخرین نشانه تا end ادامه دارد. rest بازه نمی‌سازد. */
export function cuesToSpans(cues: readonly MouthCue[], end: number): VisemeSpan[] {
  const sorted = [...cues].filter((c) => Number.isFinite(c.t) && c.v in VISEMES).sort((a, b) => a.t - b.t);
  const out: VisemeSpan[] = [];
  sorted.forEach((c, i) => {
    const stop = i + 1 < sorted.length ? sorted[i + 1].t : end;
    if (c.v !== "rest" && stop > c.t) out.push({ id: c.v, start: c.t, end: stop });
  });
  return normalizeSpans(out, 0);
}

export type VisemeSample = {
  /** شکلی که اکنون نشان داده می‌شود. */
  id: VisemeId;
  /** شدت شکل کنونی (۰ تا ۱). */
  weight: number;
  /** در هم‌آمیزی: شکل قبلی و سهم آن (۰ = هیچ). */
  from: VisemeId | null;
  fromWeight: number;
};

/**
 * شکل دهان در لحظهٔ t از بازه‌های مرتب (خروجی normalizeSpans).
 * crossfade = طول هم‌آمیزی با شکل قبلیِ چسبیده (ثانیه، حداکثر MAX_CROSSFADE؛ ۰ = تعویض مستقیم).
 * تابع خالص و قطعی است (بدون حالت)، پس پرش روی تایم‌لاین و خروجی فریم‌به‌فریم یکسان‌اند.
 */
export function visemeAt(spans: readonly VisemeSpan[], t: number, crossfade = 0): VisemeSample {
  const fade = Math.max(0, Math.min(MAX_CROSSFADE, crossfade));
  let lo = 0, hi = spans.length - 1, idx = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (spans[mid].start <= t) { idx = mid; lo = mid + 1; } else hi = mid - 1;
  }
  const cur = idx >= 0 && t < spans[idx].end ? spans[idx] : null;
  const prevOf = (i: number) => (i >= 0 ? spans[i] : null);
  if (!cur) {
    // سکوت بعد از یک بازه: شکل قبلی در طول fade به rest می‌رسد
    const p = prevOf(idx);
    if (p && fade > 0 && t - p.end < fade) {
      const k = clamp01((t - p.end) / fade);
      return { id: "rest", weight: k, from: p.id, fromWeight: (1 - k) * clamp01(p.weight ?? 1) };
    }
    return { id: "rest", weight: 1, from: null, fromWeight: 0 };
  }
  const w = clamp01(cur.weight ?? 1);
  if (fade > 0 && t - cur.start < fade) {
    const p = prevOf(idx - 1);
    const adjacent = p && cur.start - p.end < 1e-6;
    const k = clamp01((t - cur.start) / fade);
    return { id: cur.id, weight: w * k, from: adjacent ? p.id : "rest", fromWeight: (1 - k) * (adjacent ? clamp01(p.weight ?? 1) : 1) };
  }
  return { id: cur.id, weight: w, from: null, fromWeight: 0 };
}
