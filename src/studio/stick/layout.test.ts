import { test } from "node:test";
import assert from "node:assert/strict";
import { DESIGN, FORMATS, frameFor, stageFor, type Format } from "./layout.ts";

test("portrait stage is the identity (portrait output unchanged)", () => {
  assert.deepEqual(stageFor("portrait"), { k: 1, ox: 0, oy: 0 });
  assert.equal(frameFor("portrait").scale, 2.4);
  assert.equal(frameFor().floor, 1340);
});

test("every format maps the design space uniformly, floor-anchored and centred", () => {
  for (const format of Object.keys(FORMATS) as Format[]) {
    const { k, ox, oy } = stageFor(format), f = frameFor(format);
    assert.ok(k > 0 && k <= 1, `${format} k=${k}`);
    // the design floor lands on the frame floor where figures stand
    assert.ok(Math.abs(oy + DESIGN.floor * k - f.floor) < 1e-9, format);
    // the whole design width is visible and centred (no stretching, no side crop)
    assert.ok(DESIGN.w * k <= f.w + 1e-9, format);
    assert.ok(Math.abs(ox - (f.w - DESIGN.w * k) / 2) < 1e-9, format);
    // figures use the same scale as the place art
    assert.ok(Math.abs(f.scale - 2.4 * k) < 1e-9, format);
    // the region above the floor shows at least head room for a standing figure (≈820 design px + hair/bubble)
    assert.ok(Math.max(0, -oy / k) <= DESIGN.floor - 900, `${format} top of view ${-oy / k}`);
  }
});

test("square and landscape share one scale (characters keep their size across wide formats)", () => {
  assert.equal(stageFor("square").k, stageFor("landscape").k);
});
