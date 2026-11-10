import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyFallback, finalizeSpans, MIN_SPAN, normalizeSpans, repairTimeline, resolveViseme, spansForWord, TO_LEGACY, VISEME_FALLBACK, VISEME_IDS, type VisemeId,
} from "./viseme-timeline.ts";

describe("viseme ids (locked rig-spec §4)", () => {
  it("has exactly the 11 shared ids", () => {
    assert.deepEqual(VISEME_IDS, ["rest", "mbp", "ah", "eh", "ee", "oh", "oo", "fv", "l", "sz", "wide"]);
  });
  it("fallback chain: sz→ee→eh→ah, wide→eh, oh→oo→ah, l→eh, fv→mbp→rest", () => {
    const only = (...have: VisemeId[]) => (v: VisemeId) => have.includes(v);
    assert.equal(resolveViseme("sz", only("ah")), "ah");
    assert.equal(resolveViseme("sz", only("eh", "ah")), "eh");
    assert.equal(resolveViseme("wide", only("eh")), "eh");
    assert.equal(resolveViseme("oh", only("oo")), "oo");
    assert.equal(resolveViseme("l", only("ah")), "ah");
    assert.equal(resolveViseme("fv", only("mbp")), "mbp");
    assert.equal(resolveViseme("fv", only()), "rest");
    assert.equal(VISEME_FALLBACK.ah, undefined);
    // every id resolves (no cycles)
    for (const id of VISEME_IDS) assert.ok(VISEME_IDS.includes(resolveViseme(id, () => false)));
  });
  it("legacy 6-set mapping covers every id", () => {
    for (const id of VISEME_IDS) assert.ok(["rest", "ah", "ee", "oo", "fv", "shout"].includes(TO_LEGACY[id]));
  });
});

describe("spans in seconds", () => {
  it("merges spans shorter than 0.07 s into the touching neighbour", () => {
    const out = normalizeSpans([
      { id: "ah", start: 0, end: 0.2 },
      { id: "l", start: 0.2, end: 0.24 },
      { id: "ee", start: 0.24, end: 0.5 },
    ]);
    assert.deepEqual(out, [{ id: "ah", start: 0, end: 0.24 }, { id: "ee", start: 0.24, end: 0.5 }]);
    assert.ok(out.every((s) => s.end - s.start >= MIN_SPAN - 1e-9));
  });
  it("drops invalid spans and fixes overlaps", () => {
    const out = normalizeSpans([
      { id: "ah", start: 0, end: 0.3 },
      { id: "bogus" as VisemeId, start: 0.3, end: 0.5 },
      { id: "oo", start: 0.25, end: 0.6 },
      { id: "ee", start: NaN, end: 1 },
    ]);
    assert.deepEqual(out, [{ id: "ah", start: 0, end: 0.3 }, { id: "oo", start: 0.3, end: 0.6 }]);
  });
  it("spreads a word with long vowels weighted 1.6", () => {
    const s = spansForWord(1, 1.36, [{ id: "sz", weight: 1, long: false }, { id: "ah", weight: 1, long: true }, { id: "mbp", weight: 1, long: false }]);
    assert.equal(s.length, 3);
    assert.equal(s[0].start, 1);
    assert.equal(s[2].end, 1.36);
    assert.ok(Math.abs(s[1].end - s[1].start - 0.16) < 1e-9);
  });
  it("finalize applies the lip lead, clamps and removes rest", () => {
    const out = finalizeSpans([{ id: "rest", start: 0, end: 0.1 }, { id: "ah", start: 0.1, end: 0.5 }, { id: "oo", start: 0.5, end: 1.2 }], 1, 0.04);
    assert.deepEqual(out, [{ id: "ah", start: 0.06, end: 0.46 }, { id: "oo", start: 0.46, end: 1 }]);
  });
  it("applyFallback maps to available art and re-merges", () => {
    const has = (v: VisemeId) => ["rest", "ah", "ee", "oo", "fv", "mbp"].includes(v);
    const out = applyFallback([{ id: "sz", start: 0, end: 0.1 }, { id: "ee", start: 0.1, end: 0.2 }, { id: "l", start: 0.2, end: 0.3 }, { id: "wide", start: 0.3, end: 0.4, weight: 1 }], has);
    assert.deepEqual(out.map((s) => s.id), ["ee", "ah"]);
    assert.equal(out[0].end, 0.2);
  });
});

describe("repairTimeline", () => {
  it("keeps a valid stored timeline and normalises it", () => {
    const t = repairTimeline({
      version: 1, text: "سلام", lang: "fa-IR", duration: 1, timing: "stt-words", lead: 0.04, junk: { x: 1 },
      voice: { engine: "gemini-tts", model: "gemini-3.8-flash-tts", name: "Charon" },
      words: [{ text: "سلام", start: 0.1, end: 0.6, source: "stt-words" }, { text: "bad", start: 2, end: 1 }],
      visemes: [{ id: "sz", start: 0.06, end: 0.16 }, { id: "ah", start: 0.16, end: 0.4, weight: 3 }, { id: "nope", start: 0, end: 1 }],
    });
    assert.ok(t);
    assert.equal(t.timing, "stt-words");
    assert.equal(t.words.length, 1);
    assert.deepEqual(t.visemes, [{ id: "sz", start: 0.06, end: 0.16 }, { id: "ah", start: 0.16, end: 0.4, weight: 1 }]);
    assert.equal("junk" in t, false);
    assert.equal(t.voice?.model, "gemini-3.8-flash-tts");
  });
  it("rejects garbage without throwing", () => {
    for (const v of [null, 1, "x", {}, { version: 2, text: "a", duration: 1 }, { version: 1, text: "a", duration: 0 }]) assert.equal(repairTimeline(v), undefined);
  });
});

it("mouthAt: hard cuts match visemeAt; crossfade blends into each span and back to rest", async () => {
  const { mouthAt } = await import("./viseme-timeline.ts");
  const { visemeAt } = await import("./mouth.ts");
  const spans = [{ id: "mbp" as const, start: 0.1, end: 0.2 }, { id: "ah" as const, start: 0.2, end: 0.5, weight: 0.8 }, { id: "sz" as const, start: 0.7, end: 0.9 }];
  for (const t of [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.55, 0.75, 0.95]) assert.equal(mouthAt(spans, t).id, visemeAt(spans, t).id, `t=${t}`);
  assert.deepEqual(mouthAt(spans, 0.3), { id: "ah", nextId: "ah", mix: 0, weight: 0.8 });
  const a = mouthAt({ visemes: spans }, 0.23, { crossfade: 0.06 });
  assert.equal(a.id, "mbp"); assert.equal(a.nextId, "ah"); assert.ok(Math.abs(a.mix - 0.5) < 1e-9);
  const gap = mouthAt(spans, 0.71, { crossfade: 0.06 });
  assert.equal(gap.id, "rest"); assert.equal(gap.nextId, "sz"); // not adjacent → from rest
  const after = mouthAt(spans, 0.93, { crossfade: 0.06 });
  assert.equal(after.id, "sz"); assert.equal(after.nextId, "rest"); assert.ok(Math.abs(after.mix - 0.5) < 1e-9);
  assert.deepEqual(mouthAt(spans, 2, { crossfade: 0.06 }), { id: "rest", nextId: "rest", mix: 0, weight: 1 });
  assert.equal(mouthAt(spans, 0.3, { crossfade: 1 }).mix, 0, "crossfade capped at MAX_CROSSFADE (0.06 s)");
  // rig without sz art: falls back sz → ee → eh
  const has = (v: string) => ["rest", "mbp", "ah", "eh"].includes(v);
  assert.equal(mouthAt(spans, 0.8, { has }).id, "eh");
});

it("placedSpans moves a line's spans to film time", async () => {
  const { placedSpans } = await import("./viseme-timeline.ts");
  assert.deepEqual(placedSpans({ visemes: [{ id: "ah", start: 0.1, end: 0.3, weight: 0.5 }] }, 12.5), [{ id: "ah", start: 12.6, end: 12.8, weight: 0.5 }]);
});
