/**
 * FilmMix: the 3–5 min soundtrack model (pure, seconds everywhere).
 * Four buses (dialogue, music, ambience, sfx) of clips placed on the film timeline; music and ambience are ducked
 * under dialogue with an interval curve (attack/hold/release; dialogue gaps shorter than `mergeGap` stay ducked).
 * Rendering lives in mix-render.ts (browser); DSP in mix-dsp.ts. Levels follow skills/audio-mix/SKILL.md.
 */
export type MixBus = "dialogue" | "music" | "ambience" | "sfx";
export const MIX_BUSES: MixBus[] = ["dialogue", "music", "ambience", "sfx"];

export type MixClip = {
  id: string;
  bus: MixBus;
  /** IndexedDB artifact id or URL; resolved by the renderer. */
  src: string;
  /** film time (s) where the clip starts */
  start: number;
  /** offset into the source (s) */
  offset: number;
  /** played length (s) */
  duration: number;
  gainDb: number;
  fadeIn: number;
  fadeOut: number;
  loop?: boolean;
};

export type DuckSettings = { depthDb: number; attack: number; hold: number; release: number; mergeGap: number; buses: MixBus[] };
export const DEFAULT_DUCK: DuckSettings = { depthDb: -12, attack: 0.08, hold: 0.15, release: 0.45, mergeGap: 0.7, buses: ["music", "ambience"] };

/** Bus faders (dB). Dialogue is the anchor; the bed sits well under it even before ducking. */
export const DEFAULT_BUS_DB: Record<MixBus, number> = { dialogue: 0, music: -14, ambience: -20, sfx: -8 };

export type FilmMix = {
  version: 1;
  duration: number;
  sampleRate: number;
  channels: 2;
  busDb: Record<MixBus, number>;
  duck: DuckSettings;
  target: { lufs: number; ceilingDb: number };
  clips: MixClip[];
};

export const MIX_SAMPLE_RATE = 48000;
export const MAX_FILM_SECONDS = 6 * 60;

export function emptyMix(duration: number): FilmMix {
  return { version: 1, duration, sampleRate: MIX_SAMPLE_RATE, channels: 2, busDb: { ...DEFAULT_BUS_DB }, duck: { ...DEFAULT_DUCK, buses: [...DEFAULT_DUCK.buses] }, target: { lufs: -16, ceilingDb: -1 }, clips: [] };
}

export const dbToGain = (db: number) => (db <= -120 ? 0 : 10 ** (db / 20));
export const gainToDb = (g: number) => (g <= 1e-6 ? -120 : 20 * Math.log10(g));

/** Dialogue intervals [start,end] merged across gaps shorter than mergeGap, sorted. */
export function duckIntervals(clips: MixClip[], mergeGap: number, duration = Infinity): [number, number][] {
  const iv = clips
    .filter((c) => c.bus === "dialogue" && c.duration > 0)
    .map((c): [number, number] => [Math.max(0, c.start), Math.min(duration, c.start + c.duration)])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [a, b] of iv) {
    const last = out[out.length - 1];
    if (last && a - last[1] < mergeGap) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export type GainPoint = { t: number; db: number };

/** Trapezoid envelope of one interval (dB): 0 → depth over `attack` ending at a, held to b + hold, back over `release`. */
function trap(t: number, a: number, b: number, s: DuckSettings): number {
  const up = b + s.hold;
  if (t <= a - s.attack || t >= up + s.release) return 0;
  if (t < a) return (s.depthDb * (t - (a - s.attack))) / s.attack;
  if (t <= up) return s.depthDb;
  return s.depthDb * (1 - (t - up) / s.release);
}

/**
 * Piecewise-linear (in dB) gain curve for a ducked bus = the minimum of each interval's trapezoid.
 * Breakpoints are every trapezoid corner plus the crossing of a release with the next attack, so linear
 * interpolation between points is exact.
 */
export function duckCurve(intervals: [number, number][], s: DuckSettings): GainPoint[] {
  if (!intervals.length || s.depthDb === 0) return [{ t: 0, db: 0 }];
  const env = (t: number) => Math.min(0, ...intervals.map(([a, b]) => trap(t, a, b, s)));
  const ts = new Set<number>([0]);
  intervals.forEach(([a, b], i) => {
    for (const t of [a - s.attack, a, b + s.hold, b + s.hold + s.release]) if (t >= 0) ts.add(t);
    const next = intervals[i + 1];
    if (next) {
      // release_i(t) = depth*(1-(t-u)/R), attack_j(t) = depth*(t-(a2-A))/A → solve equal
      const u = b + s.hold, a2 = next[0] - s.attack;
      const t = (u / s.release + 1 + a2 / s.attack) / (1 / s.release + 1 / s.attack);
      if (t > u && t < u + s.release && t > a2 && t < next[0]) ts.add(t);
    }
  });
  const pts = [...ts].sort((x, y) => x - y).map((t) => ({ t, db: env(t) }));
  // drop collinear interior points
  return pts.filter((p, i) => i === 0 || i === pts.length - 1 || !(pts[i - 1].db === p.db && pts[i + 1].db === p.db));
}

/** Curve value at t (dB). */
export function gainAt(curve: GainPoint[], t: number): number {
  if (!curve.length) return 0;
  if (t <= curve[0].t) return curve[0].db;
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1], b = curve[i];
    if (t <= b.t) return b.t === a.t ? b.db : a.db + ((b.db - a.db) * (t - a.t)) / (b.t - a.t);
  }
  return curve[curve.length - 1].db;
}

/** Curve points inside [from,to], with exact endpoints, shifted to segment-local time. */
export function curveSlice(curve: GainPoint[], from: number, to: number): GainPoint[] {
  const inner = curve.filter((p) => p.t > from && p.t < to).map((p) => ({ t: p.t - from, db: p.db }));
  return [{ t: 0, db: gainAt(curve, from) }, ...inner, { t: to - from, db: gainAt(curve, to) }];
}

export type MixIssue = { clipId?: string; message: string };

const finite = (n: unknown, d: number) => (typeof n === "number" && Number.isFinite(n) ? n : d);
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/** Validate a FilmMix; returns the list of problems (empty = ok). */
export function validateMix(m: FilmMix): MixIssue[] {
  const issues: MixIssue[] = [];
  if (!(m.duration > 0 && m.duration <= MAX_FILM_SECONDS)) issues.push({ message: `duration ${m.duration}s out of range` });
  if (m.sampleRate !== MIX_SAMPLE_RATE) issues.push({ message: `sampleRate ${m.sampleRate} ≠ ${MIX_SAMPLE_RATE}` });
  const ids = new Set<string>();
  for (const c of m.clips) {
    if (ids.has(c.id)) issues.push({ clipId: c.id, message: "duplicate id" });
    ids.add(c.id);
    if (!MIX_BUSES.includes(c.bus)) issues.push({ clipId: c.id, message: `bad bus ${c.bus}` });
    if (!c.src) issues.push({ clipId: c.id, message: "missing src" });
    if (!(c.duration > 0)) issues.push({ clipId: c.id, message: "empty clip" });
    if (c.start < 0 || c.start >= m.duration) issues.push({ clipId: c.id, message: "starts outside the film" });
    if (c.start + c.duration > m.duration + 1e-6) issues.push({ clipId: c.id, message: "runs past the end" });
    if (c.fadeIn + c.fadeOut > c.duration + 1e-6) issues.push({ clipId: c.id, message: "fades longer than clip" });
    if (c.gainDb > 12) issues.push({ clipId: c.id, message: "gain above +12 dB" });
  }
  return issues;
}

/** Repair whatever can be repaired (clamp, trim, drop empty/duplicate clips); never throws. */
export function repairMix(raw: unknown): FilmMix {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<FilmMix>;
  const duration = clamp(finite(r.duration, 1), 0.1, MAX_FILM_SECONDS);
  const base = emptyMix(duration);
  const busDb = { ...base.busDb };
  for (const b of MIX_BUSES) busDb[b] = clamp(finite(r.busDb?.[b], busDb[b]), -60, 12);
  const d = r.duck ?? base.duck;
  const duck: DuckSettings = {
    depthDb: clamp(finite(d.depthDb, base.duck.depthDb), -40, 0),
    attack: clamp(finite(d.attack, base.duck.attack), 0.005, 2),
    hold: clamp(finite(d.hold, base.duck.hold), 0, 3),
    release: clamp(finite(d.release, base.duck.release), 0.01, 5),
    mergeGap: clamp(finite(d.mergeGap, base.duck.mergeGap), 0, 5),
    buses: Array.isArray(d.buses) ? d.buses.filter((b) => MIX_BUSES.includes(b) && b !== "dialogue") : base.duck.buses,
  };
  const target = { lufs: clamp(finite(r.target?.lufs, -16), -30, -9), ceilingDb: clamp(finite(r.target?.ceilingDb, -1), -6, 0) };
  const seen = new Set<string>();
  const clips: MixClip[] = [];
  for (const c of Array.isArray(r.clips) ? r.clips : []) {
    if (!c || typeof c.id !== "string" || seen.has(c.id) || !MIX_BUSES.includes(c.bus) || typeof c.src !== "string" || !c.src) continue;
    const start = clamp(finite(c.start, 0), 0, duration);
    const len = clamp(finite(c.duration, 0), 0, duration - start);
    if (len < 0.01) continue;
    let fadeIn = clamp(finite(c.fadeIn, 0), 0, len), fadeOut = clamp(finite(c.fadeOut, 0), 0, len);
    if (fadeIn + fadeOut > len) {
      const k = len / (fadeIn + fadeOut);
      fadeIn *= k;
      fadeOut *= k;
    }
    seen.add(c.id);
    clips.push({ id: c.id, bus: c.bus, src: c.src, start, offset: Math.max(0, finite(c.offset, 0)), duration: len, gainDb: clamp(finite(c.gainDb, 0), -60, 12), fadeIn, fadeOut, ...(c.loop ? { loop: true } : {}) });
  }
  return { ...base, busDb, duck, target, clips };
}

/** Clips overlapping [from,to) (film seconds). */
export const clipsIn = (m: FilmMix, from: number, to: number) => m.clips.filter((c) => c.start < to && c.start + c.duration > from);

/**
 * Gain points (linear) of one clip's fade envelope × clip gain inside the window [from,to] (film s),
 * returned in window-local time with exact values at both window edges (for Web Audio automation).
 */
export function clipGainPoints(c: MixClip, from: number, to: number): { t: number; g: number }[] {
  const g = dbToGain(c.gainDb), a = c.start, b = c.start + c.duration;
  const env = (t: number) => {
    if (t < a || t > b) return 0;
    let v = 1;
    if (c.fadeIn > 0 && t < a + c.fadeIn) v = Math.min(v, (t - a) / c.fadeIn);
    if (c.fadeOut > 0 && t > b - c.fadeOut) v = Math.min(v, (b - t) / c.fadeOut);
    return v * g;
  };
  const lo = Math.max(from, a), hi = Math.min(to, b);
  if (hi <= lo) return [];
  const ts = [lo, a + c.fadeIn, b - c.fadeOut, hi].filter((t) => t >= lo && t <= hi).sort((x, y) => x - y);
  return ts.filter((t, i) => i === 0 || t > ts[i - 1]).map((t) => ({ t: t - from, g: env(t) }));
}

/** A music cue placed on the film (persisted in the story project as settings.music). */
export type MusicPlacement = { id: string; src: string; start: number; duration: number; sourceSeconds: number; gainDb: number; fadeIn: number; fadeOut: number; loop?: boolean; prompt?: string };

/** Default placement of a freshly generated cue: at `at` s, as long as the cue (or to film end), 1 s in / 2 s out. */
export function musicPlacement(id: string, src: string, sourceSeconds: number, at: number, filmDuration: number, prompt?: string): MusicPlacement {
  const start = Math.max(0, Math.min(at, Math.max(0, filmDuration - 0.5)));
  const duration = Math.max(0.1, Math.min(sourceSeconds, filmDuration - start));
  const fadeIn = Math.min(1, duration / 4), fadeOut = Math.min(2, duration / 3);
  return { id, src, start, duration, sourceSeconds, gainDb: 0, fadeIn, fadeOut, ...(prompt ? { prompt: prompt.slice(0, 600) } : {}) };
}

export const musicClip = (m: MusicPlacement): MixClip => ({ id: m.id, bus: "music", src: m.src, start: m.start, offset: 0, duration: m.duration, gainDb: m.gainDb, fadeIn: m.fadeIn, fadeOut: m.fadeOut, ...(m.loop ? { loop: true } : {}) });

/** FilmMix for a story film: placed dialogue (src = `voice:<key>`) + music cues, repaired to a valid mix. */
export function buildFilmMix(duration: number, voices: { beatId: string; src: string; start: number; duration: number }[], music: MusicPlacement[] = []): FilmMix {
  const m = emptyMix(duration);
  m.clips = [
    ...voices.map((v): MixClip => ({ id: `line:${v.beatId}`, bus: "dialogue", src: v.src, start: v.start, offset: 0, duration: v.duration, gainDb: 0, fadeIn: 0, fadeOut: 0 })),
    ...music.map(musicClip),
  ];
  return repairMix(m);
}
