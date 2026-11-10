import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alignLine, alignWords, foldWord, similarity, sttOffset, timeWordsFromRuns, timeWordsFromStt, voicedFromSamples } from "./align.ts";
import { scriptWords } from "./fa-g2p.ts";
import { MIN_SPAN, VISEME_IDS } from "./viseme-timeline.ts";

const RATE = 24000;
/** Tone bursts at the given [from, to] seconds, silence elsewhere. */
function bursts(duration: number, on: [number, number][]): Float32Array {
  const x = new Float32Array(Math.round(duration * RATE));
  for (const [a, b] of on) for (let i = Math.round(a * RATE); i < Math.round(b * RATE); i++) x[i] = 0.5 * Math.sin((2 * Math.PI * 200 * i) / RATE);
  return x;
}

describe("STT helpers", () => {
  it("parses STT v2 Duration offsets into seconds", () => {
    assert.equal(sttOffset("1.500s"), 1.5);
    assert.equal(sttOffset("0s"), 0);
    assert.equal(sttOffset({ seconds: "2", nanos: 250_000_000 }), 2.25);
    assert.equal(sttOffset(0.3), 0.3);
    assert.ok(Number.isNaN(sttOffset("abc")));
  });
  it("folds Persian spelling variants before comparing", () => {
    assert.equal(foldWord("كتابي"), foldWord("کتابی"));
    assert.equal(foldWord("آماده‌ای"), "امادهای");
    assert.equal(similarity("امروز", "امروز"), 1);
    assert.ok(similarity("آماده‌ای", "آمادهای") === 1);
    assert.ok(similarity("سلام", "کتاب") < 0.5);
  });
});

describe("DP word alignment", () => {
  it("matches in order, skipping inserted and deleted words", () => {
    assert.deepEqual(alignWords(["سلام", "امروز", "آماده‌ای"], ["سلام", "امروز", "آمادهای"]), [0, 1, 2]);
    // STT inserted a filler and dropped a word
    assert.deepEqual(alignWords(["سلام", "دوست", "من", "خوبی"], ["سلام", "اوم", "دوست", "خوبی"]), [0, 2, -1, 3]);
    assert.deepEqual(alignWords(["الف"], []), [-1]);
    assert.deepEqual(alignWords([], ["x"]), []);
  });
  it("tolerates small recognition errors (similarity ≥ 0.5)", () => {
    assert.deepEqual(alignWords(["میخواهم", "بروم"], ["می‌خوام", "برم"]), [0, 1]);
  });
  it("interpolates unmatched words between matched neighbours", () => {
    const script = scriptWords("سلام دوست من خوبی");
    const stt = [
      { word: "سلام", start: 0.1, end: 0.5 },
      { word: "دوست", start: 0.6, end: 0.9 },
      { word: "خوبی", start: 1.3, end: 1.7 },
    ];
    const { words, matched } = timeWordsFromStt(script, stt, 2);
    assert.equal(matched, 3);
    assert.deepEqual(words.map((w) => [w.start, w.end]), [[0.1, 0.5], [0.6, 0.9], [0.9, 1.3], [1.3, 1.7]]);
    assert.equal(words[2].source, "text");
    assert.equal(words[0].source, "stt-words");
  });
  it("shares the previous word's span when the gap is too short", () => {
    const script = scriptWords("سلام من خوبی");
    const { words } = timeWordsFromStt(script, [{ word: "سلام", start: 0, end: 0.6 }, { word: "خوبی", start: 0.6, end: 1 }], 1);
    assert.ok(words[1].end - words[1].start > 0.07);
    assert.equal(words[0].start, 0);
    assert.equal(words[1].end, 0.6);
  });
});

describe("amplitude fallback", () => {
  it("finds voiced runs and fills short gaps", () => {
    const runs = voicedFromSamples(bursts(1.5, [[0.1, 0.5], [0.53, 0.7], [1.0, 1.4]]), RATE);
    assert.equal(runs.length, 2);
    assert.ok(Math.abs(runs[0].from - 0.1) < 0.011 && Math.abs(runs[0].to - 0.7) < 0.011);
    assert.ok(Math.abs(runs[1].from - 1.0) < 0.011);
    assert.deepEqual(voicedFromSamples(new Float32Array(2400), RATE), []);
  });
  it("lays words over voiced time only, never inside the silence", () => {
    const words = timeWordsFromRuns(scriptWords("سلام کتاب"), [{ from: 0.1, to: 0.5 }, { from: 1, to: 1.4 }]);
    assert.deepEqual(words.map((w) => [w.start, w.end]), [[0.1, 0.5], [1, 1.4]]);
    assert.ok(words.every((w) => w.source === "amplitude"));
  });
});

describe("alignLine", () => {
  const text = "سلام، امروز آماده‌ای؟";
  it("uses STT when enough words match; spans are valid seconds with the lip lead", () => {
    const t = alignLine({
      text, duration: 1.83, sampleRate: RATE,
      stt: [{ word: "سلام", start: 0.12, end: 0.61, confidence: 0.93 }, { word: "امروز", start: 0.82, end: 1.24 }, { word: "آمادهای", start: 1.26, end: 1.76 }],
    }, { lineId: "b12", voice: { engine: "gemini-tts", model: "gemini-3.8-flash-tts", name: "Charon" } });
    assert.equal(t.timing, "stt-words");
    assert.deepEqual(t.aligner, { matchedWords: 3, totalWords: 3 });
    assert.equal(t.words[0].confidence, 0.93);
    assert.equal(t.visemes[0].id, "sz");
    assert.equal(t.visemes[0].start, 0.08, "0.12 s minus 0.04 s lead");
    assert.ok(t.visemes.every((s) => VISEME_IDS.includes(s.id) && s.end > s.start && s.end - s.start >= MIN_SPAN - 1e-9 && s.end <= 1.83));
    for (let i = 1; i < t.visemes.length; i++) assert.ok(t.visemes[i].start >= t.visemes[i - 1].end - 1e-9);
    // silence between words stays closed (gap 0.61→0.82)
    assert.ok(!t.visemes.some((s) => s.start < 0.7 && s.end > 0.75));
  });
  it("falls back to amplitude when STT disagrees, then to text without audio", () => {
    const samples = bursts(1.8, [[0.1, 0.6], [0.8, 1.7]]);
    const amp = alignLine({ text, duration: 1.8, samples, sampleRate: RATE, stt: [{ word: "hello", start: 0, end: 1 }] });
    assert.equal(amp.timing, "amplitude");
    assert.equal(amp.aligner, undefined);
    const plain = alignLine({ text, duration: 1.8 });
    assert.equal(plain.timing, "text");
    assert.ok(plain.visemes.length > 3);
    assert.deepEqual(alignLine({ text: "", duration: 1 }).visemes, []);
  });
  it("emotion makes open vowels wide", () => {
    const t = alignLine({ text: "آره!", duration: 0.6 });
    assert.ok(t.visemes.some((s) => s.id === "wide"));
    assert.ok(alignLine({ text: "سلام", duration: 0.6, emotion: true }).visemes.some((s) => s.id === "wide"));
  });
});
