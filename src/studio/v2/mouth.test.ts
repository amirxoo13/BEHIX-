import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  VISEMES, VISEME_IDS, VISEME_FALLBACK, LEGACY_VISEME, TO_LEGACY_VISEME, MAX_CROSSFADE, MIN_CUE,
  resolveViseme, visemesOfText, normalizeSpans, spansToCues, cuesToSpans, visemeAt, repairMouth,
  type VisemeId, type VisemeSpan,
} from "./mouth.ts";

describe("v2/mouth VisemeId set", () => {
  it("has exactly the 11 locked ids in order", () => {
    assert.deepEqual(VISEME_IDS, ["rest", "mbp", "ah", "eh", "ee", "oh", "oo", "fv", "l", "sz", "wide"]);
    assert.equal(Object.keys(VISEMES).length, 11);
  });
  it("fallback chains end in ah or rest and never loop", () => {
    for (const id of VISEME_IDS) {
      const seen = new Set<VisemeId>();
      let cur: VisemeId | undefined = id;
      while (cur) { assert.ok(!seen.has(cur), `loop at ${id}`); seen.add(cur); cur = VISEME_FALLBACK[cur]; }
      const last = [...seen].pop();
      assert.ok(last === "ah" || last === "rest", `${id} ends at ${last}`);
    }
  });
  it("resolveViseme follows sz→ee→eh→ah, wide→eh, oh→oo→ah, l→eh, fv→mbp→rest", () => {
    const only = (...have: VisemeId[]) => (v: VisemeId) => have.includes(v);
    assert.equal(resolveViseme("sz", only("ah")), "ah");
    assert.equal(resolveViseme("sz", only("eh", "ah")), "eh");
    assert.equal(resolveViseme("sz", only("ee", "ah")), "ee");
    assert.equal(resolveViseme("wide", only("eh")), "eh");
    assert.equal(resolveViseme("oh", only("oo")), "oo");
    assert.equal(resolveViseme("oh", only("ah")), "ah");
    assert.equal(resolveViseme("l", only("eh")), "eh");
    assert.equal(resolveViseme("fv", only("mbp")), "mbp");
    assert.equal(resolveViseme("fv", only()), "rest");
    assert.equal(resolveViseme("ah", only("ah")), "ah");
  });
  it("legacy 6-set maps both ways; shout → ah at weight 1", () => {
    assert.deepEqual(LEGACY_VISEME.shout, { id: "ah", weight: 1 });
    for (const id of VISEME_IDS) assert.ok(TO_LEGACY_VISEME[id]);
  });
});

describe("v2/mouth text map", () => {
  it("S/Z letters give sz, not ee", () => {
    for (const ch of ["س", "ز", "ص", "ض", "ظ", "ذ", "ث"]) assert.ok(visemesOfText(`ا${ch}ا`).includes("sz"), ch);
    assert.ok(visemesOfText("شا").includes("ee"));
  });
  it("damma produces oh", () => {
    assert.ok(visemesOfText("بُ").includes("oh"));
  });
});

describe("v2/mouth spans", () => {
  it("merges spans shorter than MIN_CUE into a touching neighbour", () => {
    const s: VisemeSpan[] = [
      { id: "ah", start: 0, end: 0.2 },
      { id: "sz", start: 0.2, end: 0.23 },
      { id: "oo", start: 0.23, end: 0.5 },
    ];
    const n = normalizeSpans(s);
    assert.deepEqual(n.map((x) => x.id), ["ah", "oo"]);
    assert.equal(n[0].end, 0.23);
    for (const x of n) assert.ok(x.end - x.start >= MIN_CUE - 1e-9);
  });
  it("drops invalid spans and resolves overlaps without throwing", () => {
    const n = normalizeSpans([
      { id: "ah", start: 0.5, end: 0.2 },
      { id: "nope" as VisemeId, start: 0, end: 1 },
      { id: "ee", start: 0, end: 0.3 },
      { id: "oo", start: 0.2, end: 0.6 },
    ]);
    assert.deepEqual(n, [{ id: "ee", start: 0, end: 0.3 }, { id: "oo", start: 0.3, end: 0.6 }]);
  });
  it("spans ↔ cues round-trip", () => {
    const spans: VisemeSpan[] = [{ id: "ah", start: 0.1, end: 0.3 }, { id: "mbp", start: 0.3, end: 0.4 }, { id: "ee", start: 0.6, end: 0.8 }];
    const cues = spansToCues(spans);
    assert.deepEqual(cues.map((c) => c.v), ["ah", "mbp", "rest", "ee", "rest"]);
    assert.deepEqual(cuesToSpans(cues, 1), spans);
    // cues made by spansToCues survive repairMouth (project file path)
    assert.equal(repairMouth({ cues }, 1)?.cues.length, cues.length);
  });
  it("visemeAt swaps by default and crossfades at most MAX_CROSSFADE", () => {
    const spans = normalizeSpans([{ id: "ah", start: 0, end: 0.2 }, { id: "oo", start: 0.2, end: 0.4, weight: 0.5 }]);
    assert.deepEqual(visemeAt(spans, 0.21), { id: "oo", weight: 0.5, from: null, fromWeight: 0 });
    const mid = visemeAt(spans, 0.2 + MAX_CROSSFADE / 2, 1);
    assert.equal(mid.id, "oo");
    assert.equal(mid.from, "ah");
    assert.ok(Math.abs(mid.weight - 0.25) < 1e-9 && Math.abs(mid.fromWeight - 0.5) < 1e-9);
    assert.equal(visemeAt(spans, 0.2 + MAX_CROSSFADE + 0.001, 1).from, null);
    assert.equal(visemeAt(spans, 0.5).id, "rest");
    assert.equal(visemeAt([], 1).id, "rest");
  });
  it("visemeAt is deterministic regardless of sample order", () => {
    const spans = normalizeSpans([{ id: "ah", start: 0, end: 0.3 }, { id: "fv", start: 0.3, end: 0.5 }]);
    const ts = [0, 0.05, 0.31, 0.33, 0.49, 0.52];
    const a = ts.map((t) => visemeAt(spans, t, 0.04));
    const b = [...ts].reverse().map((t) => visemeAt(spans, t, 0.04)).reverse();
    assert.deepEqual(a, b);
  });
});
