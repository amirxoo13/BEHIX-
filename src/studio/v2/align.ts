/**
 * Word timing → viseme timeline for one voiced line (pure; testable in Node).
 * Paths, best first (behix-audio SKILL §2):
 *  (a) "stt-words": DP (Needleman–Wunsch) alignment of the script words to Speech-to-Text word offsets
 *      (chirp_2 fa-IR); unmatched script words are interpolated between their matched neighbours.
 *  (b) "amplitude": no usable STT → words are spread over the voiced runs of the clip's own envelope.
 *  (c) "text": no audio at all → words spread uniformly over the line.
 * Then fa-g2p gives each word its visemes, spread inside the word; MIN_SPAN merge and the lip lead are applied.
 * All times are SECONDS. ms only exist inside the server STT adapter (see `sttOffset`).
 * Viseme ids/types come ONLY from ./viseme-timeline.ts (TEMP mirror of mouth.ts until the merge).
 */
import { scriptWords, wordVisemes, type ScriptWord } from "./fa-g2p.ts";
import {
  DEFAULT_LEAD, finalizeSpans, spansForWord,
  type TimedWord, type TimingSource, type VisemeSpan, type VisemeTimeline,
} from "./viseme-timeline.ts";

/** One recognised word from STT, seconds from the clip start. */
export type SttWord = { word: string; start: number; end: number; confidence?: number };

/** STT v2 offsets are Duration strings ("1.500s") or {seconds, nanos}; returns seconds (NaN if unreadable). */
export function sttOffset(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const m = /^(-?\d+(?:\.\d+)?)s$/.exec(v.trim());
    return m ? Number(m[1]) : NaN;
  }
  if (v && typeof v === "object") {
    const o = v as { seconds?: string | number; nanos?: number };
    return Number(o.seconds ?? 0) + Number(o.nanos ?? 0) / 1e9;
  }
  return NaN;
}

/** Comparable form: no diacritics, unified letters, alef variants folded. */
export function foldWord(w: string): string {
  return w
    .replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[أإٱآ]/g, "ا").replace(/ة/g, "ه").replace(/ؤ/g, "و")
    .replace(/[\u064B-\u0652\u0670\u0640\u200C\u200D]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** 0..1 string similarity. */
export function similarity(a: string, b: string): number {
  const x = foldWord(a), y = foldWord(b);
  if (!x || !y) return 0;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

const GAP = -0.4, MATCH_MIN = 0.5;

/**
 * Global DP alignment. Returns, for each script word, the index of its STT word or -1.
 * A pair scores 2·sim when sim ≥ 0.5, else −1 (substitution); gaps cost 0.4. Order is preserved.
 */
export function alignWords(script: readonly string[], stt: readonly string[]): number[] {
  const n = script.length, m = stt.length;
  const score = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const move = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1)); // 0 diag, 1 up (skip script), 2 left (skip stt)
  for (let i = 1; i <= n; i++) { score[i][0] = i * GAP; move[i][0] = 1; }
  for (let j = 1; j <= m; j++) { score[0][j] = j * GAP; move[0][j] = 2; }
  const sims = script.map((s) => stt.map((t) => similarity(s, t)));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = sims[i - 1][j - 1];
      const diag = score[i - 1][j - 1] + (s >= MATCH_MIN ? 2 * s : -1);
      const up = score[i - 1][j] + GAP, left = score[i][j - 1] + GAP;
      if (diag >= up && diag >= left) { score[i][j] = diag; move[i][j] = 0; }
      else if (up >= left) { score[i][j] = up; move[i][j] = 1; }
      else { score[i][j] = left; move[i][j] = 2; }
    }
  }
  const out = new Array<number>(n).fill(-1);
  for (let i = n, j = m; i > 0 || j > 0; ) {
    const mv = move[i][j];
    if (i > 0 && j > 0 && mv === 0) {
      if (sims[i - 1][j - 1] >= MATCH_MIN) out[i - 1] = j - 1;
      i--; j--;
    } else if (i > 0 && (mv === 1 || j === 0)) i--;
    else j--;
  }
  return out;
}

const weightOf = (w: ScriptWord) => Math.max(1, [...w.norm].length);

/** Share [from, to] between words in proportion to their letter count. */
function spread(words: readonly ScriptWord[], from: number, to: number, source: TimingSource): TimedWord[] {
  const total = words.reduce((s, w) => s + weightOf(w), 0);
  let t = from;
  return words.map((w) => {
    const d = ((to - from) * weightOf(w)) / total;
    const tw = { text: w.text, start: round(t), end: round(t + d), source };
    t += d;
    return tw;
  });
}

/**
 * Timed script words from STT. Matched words take STT times. A run of unmatched words takes the gap between
 * its matched neighbours; if that gap is too short (< 0.07 s per word), the previous matched word shares its span.
 */
export function timeWordsFromStt(script: readonly ScriptWord[], stt: readonly SttWord[], duration: number): { words: TimedWord[]; matched: number } {
  const idx = alignWords(script.map((w) => w.norm), stt.map((w) => w.word));
  const out: (TimedWord | null)[] = script.map((w, i) => {
    const s = idx[i] >= 0 ? stt[idx[i]] : null;
    return s && s.end > s.start ? { text: w.text, start: round(s.start), end: round(Math.min(duration, s.end)), ...(s.confidence !== undefined ? { confidence: s.confidence } : {}), source: "stt-words" as const } : null;
  });
  const matched = out.filter(Boolean).length;
  for (let i = 0; i < out.length; ) {
    if (out[i]) { i++; continue; }
    let j = i;
    while (j < out.length && !out[j]) j++;
    const prev = i > 0 ? out[i - 1] : null, next = j < out.length ? out[j] : null;
    let from = prev ? prev.end : 0;
    const to = next ? next.start : duration;
    let run = script.slice(i, j), at = i;
    if (to - from < 0.07 * run.length && prev) {
      // too little room: re-split the previous word's span with the run
      from = prev.start;
      run = script.slice(i - 1, j);
      at = i - 1;
    }
    spread(run, from, Math.max(from, to), "stt-words").forEach((tw, k) => { out[at + k] = { ...tw, source: k === 0 && at < i ? "stt-words" : "text" }; });
    i = j;
  }
  return { words: out as TimedWord[], matched };
}

export type Run = { from: number; to: number };

/** Voiced runs of a mono clip (seconds): 10 ms RMS windows over 12 % of the peak, gaps < 0.07 s filled, runs < 0.04 s dropped. */
export function voicedFromSamples(samples: Float32Array, sampleRate: number): Run[] {
  const win = Math.max(1, Math.round(sampleRate * 0.01));
  const rms: number[] = [];
  for (let i = 0; i < samples.length; i += win) {
    let s = 0;
    const end = Math.min(samples.length, i + win);
    for (let k = i; k < end; k++) s += samples[k] * samples[k];
    rms.push(Math.sqrt(s / (end - i)));
  }
  const peak = Math.max(1e-6, ...rms);
  const step = win / sampleRate;
  const runs: Run[] = [];
  let start = -1;
  for (let k = 0; k <= rms.length; k++) {
    const on = k < rms.length && rms[k] > peak * 0.12;
    if (on && start < 0) start = k;
    if (!on && start >= 0) {
      const from = start * step, to = Math.min(samples.length / sampleRate, k * step);
      const last = runs[runs.length - 1];
      if (last && from - last.to < 0.07) last.to = to;
      else runs.push({ from, to });
      start = -1;
    }
  }
  return runs.filter((r) => r.to - r.from >= 0.04).map((r) => ({ from: round(r.from), to: round(r.to) }));
}

/** Amplitude fallback: words laid end to end over the voiced time only (silences stay closed). */
export function timeWordsFromRuns(script: readonly ScriptWord[], runs: readonly Run[]): TimedWord[] {
  const voiced = runs.reduce((s, r) => s + (r.to - r.from), 0);
  if (!script.length || voiced <= 0) return [];
  const total = script.reduce((s, w) => s + weightOf(w), 0);
  // map a position on the "voiced clock" to clip time
  // strict: a start exactly on a run boundary belongs to the NEXT run; an end belongs to the current one
  const at = (pos: number, strict = false) => {
    let before = 0;
    for (const r of runs) {
      const len = r.to - r.from;
      if (strict ? pos < before + len - 1e-9 : pos <= before + len + 1e-9) return r.from + (pos - before);
      before += len;
    }
    return runs[runs.length - 1].to;
  };
  // a word never straddles a silence: its end is clamped to the run its start is in
  const runEnd = (t: number) => runs.find((r) => t >= r.from - 1e-9 && t <= r.to + 1e-9)?.to ?? t;
  let pos = 0;
  return script.map((w) => {
    const d = (voiced * weightOf(w)) / total;
    const start = at(pos, true);
    const end = Math.min(at(pos + d), Math.max(start, runEnd(start)));
    pos += d;
    return { text: w.text, start: round(start), end: round(Math.max(start, end)), source: "amplitude" as const };
  });
}

/** Viseme spans for timed words; an emphasised word ("!", or the whole line with an emotion tag) opens to `wide`. */
export function spansFromWords(script: readonly ScriptWord[], words: readonly TimedWord[], emotion = false): VisemeSpan[] {
  return words.flatMap((tw, i) => spansForWord(tw.start, tw.end, wordVisemes(script[i]?.norm ?? tw.text, { emphasis: emotion || script[i]?.emphasis })));
}

export type AlignInput = {
  text: string;
  /** Clip length (s). */
  duration: number;
  stt?: readonly SttWord[];
  samples?: Float32Array;
  sampleRate?: number;
  /** Strong emotion tag on the line (shouting, laughing) → open vowels become `wide`. */
  emotion?: boolean;
  lead?: number;
  /** Minimum share of script words STT must match to be trusted (default 0.5). */
  minMatch?: number;
};

/** Full timeline for one line; picks the best timing path available. Never throws. */
export function alignLine(input: AlignInput, meta: Partial<Pick<VisemeTimeline, "lineId" | "clipKey" | "voice" | "aligner">> = {}): VisemeTimeline {
  const duration = Math.max(0, input.duration);
  const lead = input.lead ?? DEFAULT_LEAD;
  const script = scriptWords(input.text);
  let words: TimedWord[] = [];
  let timing: TimingSource = "text";
  let matched = 0;
  if (input.stt?.length && script.length) {
    const r = timeWordsFromStt(script, input.stt, duration);
    if (r.matched / script.length >= (input.minMatch ?? 0.5)) {
      words = r.words;
      matched = r.matched;
      timing = "stt-words";
    }
  }
  if (timing === "text" && input.samples && input.sampleRate) {
    const runs = voicedFromSamples(input.samples, input.sampleRate);
    const w = timeWordsFromRuns(script, runs);
    if (w.length) {
      words = w;
      timing = "amplitude";
    }
  }
  if (timing === "text" && script.length && duration > 0) words = spread(script, Math.min(0.1, duration * 0.05), duration * 0.95, "text");
  const visemes = finalizeSpans(spansFromWords(script, words, input.emotion), duration, lead);
  return {
    version: 1,
    ...meta,
    ...(timing === "stt-words" ? { aligner: { ...(meta.aligner ?? {}), matchedWords: matched, totalWords: script.length } } : {}),
    text: input.text,
    lang: "fa-IR",
    ...(input.sampleRate ? { sampleRate: input.sampleRate } : {}),
    duration: round(duration),
    timing,
    lead,
    words,
    visemes,
  };
}

const round = (t: number) => Math.round(t * 1000) / 1000;
