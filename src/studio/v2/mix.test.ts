import { test } from "node:test";
import assert from "node:assert/strict";
import { clipsIn, curveSlice, DEFAULT_DUCK, duckCurve, duckIntervals, emptyMix, gainAt, repairMix, validateMix, type MixClip } from "./mix.ts";

const clip = (id: string, bus: MixClip["bus"], start: number, duration: number, extra: Partial<MixClip> = {}): MixClip => ({ id, bus, src: `voice:${id}`, start, offset: 0, duration, gainDb: 0, fadeIn: 0, fadeOut: 0, ...extra });

test("dialogue intervals merge across short gaps only", () => {
  const iv = duckIntervals([clip("a", "dialogue", 1, 1), clip("b", "dialogue", 2.5, 1), clip("c", "dialogue", 5, 1), clip("m", "music", 0, 10)], 0.7);
  assert.deepEqual(iv, [[1, 3.5], [5, 6]]);
});

test("duck curve: attack before speech, hold + release after, depth −12 dB", () => {
  const c = duckCurve([[2, 3]], DEFAULT_DUCK);
  assert.equal(gainAt(c, 0), 0);
  assert.equal(gainAt(c, 1.92), 0);
  assert.equal(gainAt(c, 2), -12);
  assert.equal(gainAt(c, 3.15), -12);
  assert.ok(Math.abs(gainAt(c, 3.15 + 0.225) + 6) < 1e-9, "half-way through release");
  assert.equal(gainAt(c, 3.6), 0);
  assert.equal(gainAt(c, 20), 0);
});

test("overlapping release/attack: curve is the minimum, exact at the crossing", () => {
  const s = { ...DEFAULT_DUCK, mergeGap: 0 };
  const c = duckCurve([[1, 2], [2.5, 3]], s);
  // release of #1 runs 2.15–2.6, attack of #2 runs 2.42–2.5: the curve never climbs back to 0 between them
  for (let t = 2; t <= 2.5; t += 0.01) assert.ok(gainAt(c, t) < -1, `t=${t.toFixed(2)} ${gainAt(c, t)}`);
  assert.equal(gainAt(c, 2.5), -12);
  for (let i = 1; i < c.length; i++) assert.ok(c[i].t >= c[i - 1].t, "sorted");
});

test("curve slices for segment rendering keep values at the seam", () => {
  const c = duckCurve([[9.95, 11]], DEFAULT_DUCK);
  const a = curveSlice(c, 0, 10), b = curveSlice(c, 10, 20);
  assert.equal(a[a.length - 1].db, b[0].db);
  assert.equal(b[0].t, 0);
  assert.equal(a[a.length - 1].t, 10);
});

test("validate flags problems; repair fixes them without throwing", () => {
  const m = emptyMix(60);
  m.clips = [clip("a", "dialogue", 1, 2), clip("a", "music", 0, 70), clip("x", "sfx", 59, 3, { fadeIn: 2, fadeOut: 2 })];
  const issues = validateMix(m).map((i) => i.message);
  assert.ok(issues.includes("duplicate id") && issues.includes("runs past the end") && issues.includes("fades longer than clip"));
  const r = repairMix(m);
  assert.deepEqual(validateMix(r), []);
  assert.equal(r.clips.length, 2);
  const x = r.clips.find((c) => c.id === "x")!;
  assert.ok(Math.abs(x.duration - 1) < 1e-9 && Math.abs(x.fadeIn + x.fadeOut - 1) < 1e-9);
  assert.deepEqual(validateMix(repairMix(null)), []);
  assert.deepEqual(validateMix(repairMix({ duration: 9999, clips: [{ id: 1 }], busDb: { music: "loud" } })), []);
});

test("clipsIn finds clips overlapping a segment", () => {
  const m = emptyMix(60);
  m.clips = [clip("a", "dialogue", 1, 2), clip("b", "music", 0, 60), clip("c", "sfx", 25, 1)];
  assert.deepEqual(clipsIn(m, 20, 40).map((c) => c.id), ["b", "c"]);
});

test("clip fade envelope inside a window", async () => {
  const { clipGainPoints } = await import("./mix.ts");
  const c = clip("m", "music", 5, 10, { fadeIn: 2, fadeOut: 4, gainDb: -6 });
  const g = 10 ** (-6 / 20);
  const pts = clipGainPoints(c, 0, 10);
  assert.deepEqual(pts.map((p) => p.t), [5, 7, 10]);
  assert.equal(pts[0].g, 0);
  assert.ok(Math.abs(pts[1].g - g) < 1e-12 && Math.abs(pts[2].g - g) < 1e-12);
  assert.ok(Math.abs(clipGainPoints(c, 0, 13).at(-1)!.g - g * 0.5) < 1e-12, "half-way through the fade-out");
  const next = clipGainPoints(c, 10, 20);
  assert.ok(Math.abs(next[0].g - pts[2].g) < 1e-12, "seam value matches");
  assert.deepEqual(clipGainPoints(c, 16, 20), []);
});
