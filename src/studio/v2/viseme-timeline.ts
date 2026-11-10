/**
 * Viseme timeline: the stored lip-sync format for one voiced line (pure; testable in Node).
 * Locked spec: SKILL.md §2 (behix-audio) + rig-spec.md §4 (behix-characters).
 *  - 11 shared VisemeIds; all times in SECONDS (ms only inside server TTS/STT adapters).
 *  - Spans shorter than MIN_SPAN (0.07 s) are merged into a touching neighbour.
 *  - Missing art falls back sz→ee→eh→ah, wide→eh, oh→oo→ah, l→eh, fv→mbp→rest.
 * align.ts and fa-g2p.ts import viseme ids/types ONLY from this file.
 */

// ─── TEMP: mirrors v2/mouth.ts (Characters bot); switch to import from ./mouth.ts after merge ───────────────
// Source: master f8572f3 "v2/mouth: VisemeId + VisemeSpan". After the merge, replace this whole block with:
//   export { VISEME_IDS, VISEME_FALLBACK, MAX_CROSSFADE, resolveViseme, normalizeSpans, type VisemeId, type Viseme2, type VisemeSpan } from "./mouth.ts";
/** Shared mouth-shape ids (11, fixed). */
export type VisemeId = "rest" | "mbp" | "ah" | "eh" | "ee" | "oh" | "oo" | "fv" | "l" | "sz" | "wide";
/** Old name, for compatibility. */
export type Viseme2 = VisemeId;
export const VISEME_IDS: VisemeId[] = ["rest", "mbp", "ah", "eh", "ee", "oh", "oo", "fv", "l", "sz", "wide"];
/** One mouth span in seconds from the start of the shot/line; weight 0..1 (default 1). */
export type VisemeSpan = { id: VisemeId; start: number; end: number; weight?: number };
/** Longest crossfade between two mouth shapes (s). */
export const MAX_CROSSFADE = 0.06;
/** Next shape to try when a character has no art for one. ah and rest end the chain. */
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
/** Nearest shape whose art exists; rest if none. */
export function resolveViseme(id: VisemeId, has: (v: VisemeId) => boolean): VisemeId {
  let cur: VisemeId | undefined = id;
  for (let i = 0; cur && i <= VISEME_IDS.length; i++) {
    if (has(cur)) return cur;
    cur = VISEME_FALLBACK[cur];
  }
  return "rest";
}
const MIRROR_MIN_CUE = 0.07;
const round = (t: number) => Math.round(t * 1000) / 1000;
const isViseme = (v: unknown): v is VisemeId => typeof v === "string" && (VISEME_IDS as string[]).includes(v);
/** Valid, sorted, non-overlapping spans; a touching span shorter than `min` merges into prev, else next. Never throws. */
export function normalizeSpans(spans: readonly VisemeSpan[], min = MIRROR_MIN_CUE): VisemeSpan[] {
  const list = spans
    .filter((s) => s && isViseme(s.id) && Number.isFinite(s.start) && Number.isFinite(s.end) && s.end > s.start)
    .map((s) => ({ ...s }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out: VisemeSpan[] = [];
  for (const s of list) {
    const prev = out[out.length - 1];
    if (prev && s.start < prev.end) s.start = prev.end;
    if (s.end <= s.start) continue;
    if (prev && prev.id === s.id && s.start - prev.end < 1e-6) { prev.end = s.end; continue; }
    out.push(s);
  }
  const EPS = 1e-6;
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
// ─── end TEMP ─────────────────────────────────────────────────────────────────────────────────────────────

/** Shortest span kept on screen (s); shorter ones are merged (rig-spec §4). */
export const MIN_SPAN = 0.07;

export type TimingSource = "stt-words" | "amplitude" | "text";
export type TimedWord = { text: string; start: number; end: number; confidence?: number; source: TimingSource };
/** One viseme of a word before timing; `long` vowels get more time. */
export type WordViseme = { id: VisemeId; weight: number; long: boolean };

export type VisemeTimeline = {
  version: 1;
  lineId?: string;
  clipKey?: string;
  text: string;
  lang: "fa-IR";
  voice?: { engine: string; model?: string; name?: string };
  aligner?: { model?: string; location?: string; matchedWords: number; totalWords: number };
  sampleRate?: number;
  /** Clip length (s). */
  duration: number;
  timing: TimingSource;
  /** Visemes are shown this much BEFORE the audio (s), so lips lead sound slightly. Already applied to `visemes`. */
  lead: number;
  words: TimedWord[];
  visemes: VisemeSpan[];
};

/** Default lip lead (s); 0.04 s ≈ one frame at 25 fps. */
export const DEFAULT_LEAD = 0.04;

/**
 * Spread a word's visemes over [start, end]: long vowels weigh 1.6, everything else 1.
 * The word's last shape keeps its tail; gaps between words stay empty (= rest).
 */
export function spansForWord(start: number, end: number, visemes: readonly WordViseme[]): VisemeSpan[] {
  const dur = end - start;
  if (!(dur > 0) || !visemes.length) return [];
  const w = visemes.map((v) => (v.long ? 1.6 : 1));
  const total = w.reduce((a, b) => a + b, 0);
  const out: VisemeSpan[] = [];
  let t = start;
  visemes.forEach((v, i) => {
    const e = i === visemes.length - 1 ? end : t + (dur * w[i]) / total;
    out.push(v.weight === 1 ? { id: v.id, start: t, end: e } : { id: v.id, start: t, end: e, weight: v.weight });
    t = e;
  });
  return out;
}

/** Shift all spans earlier by `lead` seconds, clamp to [0, duration], then merge short spans. */
export function finalizeSpans(spans: readonly VisemeSpan[], duration: number, lead = DEFAULT_LEAD): VisemeSpan[] {
  const shifted = spans
    .map((s) => ({ ...s, start: Math.max(0, s.start - lead), end: Math.min(duration, s.end - lead) }))
    .filter((s) => s.end > s.start && s.id !== "rest");
  return normalizeSpans(shifted, MIN_SPAN);
}

/** Replace every id by the nearest shape the character has art for (rig-spec §4 fallback chain). */
export function applyFallback(spans: readonly VisemeSpan[], has: (v: VisemeId) => boolean): VisemeSpan[] {
  return normalizeSpans(
    spans.map((s) => ({ ...s, id: resolveViseme(s.id, has) })).filter((s) => s.id !== "rest"),
    MIN_SPAN,
  );
}

/** Visemes in the 6-shape legacy set (photo heads); weight kept. Mirrors TO_LEGACY_VISEME in mouth.ts (master). */
export const TO_LEGACY: Readonly<Record<VisemeId, "rest" | "ah" | "ee" | "oo" | "fv" | "shout">> = {
  rest: "rest", mbp: "rest", ah: "ah", eh: "ah", ee: "ee", oh: "oo", oo: "oo", fv: "fv", l: "ee", sz: "ee", wide: "ee",
};

const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Valid timeline from stored JSON (IndexedDB / GCS / project file). Never throws; returns undefined if unusable. */
export function repairTimeline(raw: unknown): VisemeTimeline | undefined {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!o || o.version !== 1 || typeof o.text !== "string") return undefined;
  const duration = Math.max(0, Math.min(600, num(o.duration, 0)));
  if (!duration) return undefined;
  const timing: TimingSource = o.timing === "stt-words" || o.timing === "amplitude" ? o.timing : "text";
  const words: TimedWord[] = [];
  for (const w of Array.isArray(o.words) ? o.words.slice(0, 2000) : []) {
    const q = w && typeof w === "object" ? (w as Record<string, unknown>) : null;
    if (!q || typeof q.text !== "string") continue;
    const start = num(q.start, NaN), end = num(q.end, NaN);
    if (!(start >= 0 && end > start && end <= duration + 1)) continue;
    const source: TimingSource = q.source === "stt-words" || q.source === "amplitude" ? q.source : "text";
    words.push({ text: q.text, start: round(start), end: round(end), ...(typeof q.confidence === "number" ? { confidence: q.confidence } : {}), source });
  }
  const spans: VisemeSpan[] = [];
  for (const s of Array.isArray(o.visemes) ? o.visemes.slice(0, 5000) : []) {
    const q = s && typeof s === "object" ? (s as Record<string, unknown>) : null;
    if (!q || !isViseme(q.id)) continue;
    const weight = typeof q.weight === "number" && Number.isFinite(q.weight) ? Math.max(0, Math.min(1, q.weight)) : undefined;
    spans.push({ id: q.id, start: num(q.start, NaN), end: Math.min(duration, num(q.end, NaN)), ...(weight === undefined ? {} : { weight }) });
  }
  const str = (v: unknown) => (typeof v === "string" && v.length <= 200 ? v : undefined);
  const vo = o.voice && typeof o.voice === "object" ? (o.voice as Record<string, unknown>) : null;
  const al = o.aligner && typeof o.aligner === "object" ? (o.aligner as Record<string, unknown>) : null;
  return {
    version: 1,
    ...(str(o.lineId) ? { lineId: str(o.lineId) } : {}),
    ...(str(o.clipKey) ? { clipKey: str(o.clipKey) } : {}),
    ...(vo && str(vo.engine) ? { voice: { engine: str(vo.engine)!, model: str(vo.model), name: str(vo.name) } } : {}),
    ...(al ? { aligner: { model: str(al.model), location: str(al.location), matchedWords: num(al.matchedWords, 0), totalWords: num(al.totalWords, 0) } } : {}),
    ...(typeof o.sampleRate === "number" && o.sampleRate > 0 ? { sampleRate: o.sampleRate } : {}),
    text: o.text,
    lang: "fa-IR",
    duration,
    timing,
    lead: Math.max(-0.2, Math.min(0.2, num(o.lead, DEFAULT_LEAD))),
    words: words.sort((a, b) => a.start - b.start),
    visemes: normalizeSpans(spans, MIN_SPAN),
  };
}
