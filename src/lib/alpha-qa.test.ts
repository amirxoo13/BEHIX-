import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { alphaCoverage, alphaHoles, contentBox, haloScore, runAlphaQa, type Rgba } from "./alpha-qa.ts";
import { keyOutBackground } from "./puppet-build.server.ts";

/** Synthetic figure: an opaque dark ellipse "body" on a transparent canvas. */
function figure(w = 120, h = 200, paint?: (x: number, y: number) => [number, number, number, number] | null): Rgba {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const inside = ((x - w / 2) / (w * 0.3)) ** 2 + ((y - h / 2) / (h * 0.42)) ** 2 <= 1;
    const px = paint?.(x, y) ?? (inside ? [60, 40, 30, 255] : [255, 255, 255, 0]);
    data.set(px, (y * w + x) * 4);
  }
  return { width: w, height: h, data };
}

describe("alpha QA", () => {
  it("a clean standing figure passes", () => {
    const q = runAlphaQa(figure());
    assert.equal(q.passed, true, q.reasons.join(","));
    assert.equal(q.checks.hasTransparency, true);
    assert.equal(q.checks.holes, 0);
    assert.ok(q.checks.haloScore < 0.01);
  });
  it("no transparency at all (model ignored the cut-out) fails", () => {
    const q = runAlphaQa(figure(120, 200, () => [255, 255, 255, 255]));
    assert.equal(q.passed, false);
    assert.ok(q.reasons.includes("no-transparency"));
  });
  it("white fringe around the body is detected as halo", () => {
    const base = figure();
    const w = base.width, h = base.height;
    const inside = (x: number, y: number) => ((x - w / 2) / (w * 0.3)) ** 2 + ((y - h / 2) / (h * 0.42)) ** 2 <= 1;
    const halo = figure(w, h, (x, y) => {
      if (!inside(x, y)) return [255, 255, 255, 0];
      const edge = !inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2);
      return edge ? [250, 250, 250, 255] : [60, 40, 30, 255];
    });
    assert.ok(haloScore(halo) > 0.9);
    assert.ok(runAlphaQa(halo).reasons.includes("edge-halo"));
  });
  it("a figure cut by the image edge fails bbox sanity", () => {
    const cut = figure(120, 200, (x, y) => (y > 150 || ((x - 60) / 36) ** 2 + ((y - 120) / 90) ** 2 > 1 ? [0, 0, 0, 0] : [60, 40, 30, 255]));
    const tall = figure(120, 200, (x, y) => (((x - 60) / 36) ** 2 + ((y - 100) / 110) ** 2 <= 1 ? [60, 40, 30, 255] : [0, 0, 0, 0]));
    assert.equal(runAlphaQa(tall).checks.bboxOk, false);
    assert.ok(runAlphaQa(tall).reasons.includes("cropped-at-edge"));
    assert.ok(contentBox(cut));
  });
  it("a tiny figure fails bbox sanity", () => {
    const tiny = figure(120, 200, (x, y) => (Math.abs(x - 60) < 6 && Math.abs(y - 100) < 15 ? [60, 40, 30, 255] : [0, 0, 0, 0]));
    assert.ok(runAlphaQa(tiny).reasons.includes("figure-too-small"));
  });
  it("an enclosed hole inside the body is counted; open background is not", () => {
    const holey = figure(120, 200, (x, y) => {
      const inside = ((x - 60) / 36) ** 2 + ((y - 100) / 84) ** 2 <= 1;
      if (inside && Math.abs(x - 60) < 8 && Math.abs(y - 100) < 12) return [0, 0, 0, 0];
      return inside ? [60, 40, 30, 255] : [255, 255, 255, 0];
    });
    const h = alphaHoles(holey);
    assert.equal(h.count, 1);
    assert.equal(h.largest, 15 * 23);
    assert.ok(runAlphaQa(holey).reasons.includes("hole-in-body"));
    assert.equal(alphaHoles(figure()).count, 0);
  });
  it("coverage vs expected pixels must be within 0.85..1.15", () => {
    const f = figure();
    const { opaque } = alphaCoverage(f);
    assert.equal(runAlphaQa(f, { expectedPixels: opaque }).checks.coverageRatio, 1);
    assert.ok(runAlphaQa(f, { expectedPixels: opaque * 2 }).reasons.includes("coverage-off"));
  });
  it("the recorded reference image keyed by keyOutBackground passes", () => {
    const png = keyOutBackground(PNG.sync.read(readFileSync(new URL("../../verify-out/rig-apose.png", import.meta.url))));
    const q = runAlphaQa(png);
    assert.equal(q.passed, true, `${q.reasons.join(",")} ${JSON.stringify(q.checks)}`);
  });
});
