import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cameraAt } from "../stick/story-render.ts";
import { EASES, apply, blurFor, cameraAt2, clampCamera, easeValue, fromLegacyKeys, invert, layerMatrix, mul, shakeAt, shotCameraAt, shotCameraSchema, visibleRect, type CamState } from "./camera.ts";

const base: CamState = { cx: 540, cy: 1000, zoom: 1, dolly: 0, truck: 0, roll: 0, focus: 1 };
const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≉ ${b}`);

describe("easing", () => {
  it("every ease starts at 0 and ends at 1 and is clamped", () => {
    for (const e of EASES) {
      close(easeValue(e, 0), 0);
      close(easeValue(e, 1), 1);
      close(easeValue(e, -3), easeValue(e, 0));
      close(easeValue(e, 7), easeValue(e, 1));
    }
    assert.ok(easeValue("outBack", 0.8) > 1, "outBack overshoots");
    assert.equal(easeValue("hold", 0.99), 0);
  });
});

describe("cameraAt2", () => {
  it("reproduces the legacy story camera exactly (cubic ease over the last 0.6 s)", () => {
    const legacy = [{ t: 0, zoom: 1, cx: 540, cy: 1000 }, { t: 2, zoom: 1.4, cx: 400, cy: 980 }, { t: 2.3, zoom: 1.2, cx: 700, cy: 1080 }, { t: 5, zoom: 1, cx: 540, cy: 1000 }];
    const keys = fromLegacyKeys(legacy);
    for (let t = -0.5; t <= 6; t += 0.05) {
      const a = cameraAt(legacy, t), b = cameraAt2(keys, t);
      close(b.zoom, a.zoom);
      close(b.cx, a.cx);
      close(b.cy, a.cy);
    }
  });
  it("interpolates dolly/truck/roll/focus with the key's ease over the whole gap by default", () => {
    const keys = shotCameraSchema.parse({ keys: [{ t: 0, cx: 540, cy: 1000, zoom: 1, ease: "linear" }, { t: 4, cx: 540, cy: 1000, zoom: 1, dolly: 0.2, truck: 80, roll: 2, focus: 0.5, ease: "linear" }] }).keys;
    const m = cameraAt2(keys, 2);
    close(m.dolly, 0.1); close(m.truck, 40); close(m.roll, 1); close(m.focus, 0.75);
  });
  it("is deterministic", () => {
    const keys = fromLegacyKeys([{ t: 0, zoom: 1, cx: 540, cy: 1000 }, { t: 3, zoom: 1.3, cx: 300, cy: 900 }]);
    assert.deepEqual(cameraAt2(keys, 2.71), cameraAt2(keys, 2.71));
  });
});

describe("per-layer parallax transform", () => {
  it("p = 1 equals the legacy camera transform translate(c)·scale(z)·translate(−c)", () => {
    const cam = { ...base, cx: 400, cy: 900, zoom: 1.5, sx: 3 };
    const m = layerMatrix(cam, 1);
    for (const [x, y] of [[0, 0], [400, 900], [1080, 1920], [123, 456]]) {
      const [X, Y] = apply(m, x, y);
      close(X, 400 + 3 + (x - 400) * 1.5, 1e-9);
      close(Y, 900 + (y - 900) * 1.5, 1e-9);
    }
  });
  it("far layers pan less than near layers; p = 0 only zooms about the centre", () => {
    const cam = { ...base, cx: 300, zoom: 1.5 };
    const shift = (p: number) => visibleRect(cam, p).x - visibleRect({ ...cam, cx: 540 }, p).x;
    assert.ok(Math.abs(shift(0.2)) < Math.abs(shift(1)));
    assert.ok(Math.abs(shift(1.3)) > Math.abs(shift(1)));
    close(shift(0), 0, 1e-9);
  });
  it("dolly magnifies near layers more than far ones; truck slides by parallax", () => {
    const cam = { ...base, dolly: 0.3 };
    assert.ok(visibleRect(cam, 1).w < visibleRect(cam, 0.3).w);
    const t = { ...base, truck: 100 };
    close(apply(layerMatrix(t, 0.5), 540, 960)[0] - 540, -50, 1e-9);
    close(apply(layerMatrix(t, 1), 540, 960)[0] - 540, -100, 1e-9);
  });
  it("invert/mul are consistent", () => {
    const m = layerMatrix({ ...base, cx: 333, zoom: 1.7, roll: 3, dolly: 0.2 }, 0.6);
    const id = mul(m, invert(m));
    [1, 0, 0, 1, 0, 0].forEach((v, i) => close(id[i], v, 1e-9));
  });
});

describe("overscan clamp", () => {
  const layers = [{ parallax: 0.35, rect: { x: -135, y: 0, w: 1350, h: 1920 } }, { parallax: 1, rect: { x: 0, y: 0, w: 1080, h: 1920 } }];
  it("leaves a camera that stays inside alone", () => {
    const r = clampCamera({ ...base, zoom: 1.3, cx: 560 }, layers);
    assert.equal(r.clamped, false);
  });
  it("pulls an over-panned camera back so no layer shows its edge", () => {
    const r = clampCamera({ ...base, zoom: 1, truck: 300 }, layers);
    assert.equal(r.clamped, true);
    for (const l of layers) {
      const v = visibleRect(r.cam, l.parallax);
      assert.ok(v.x >= l.rect.x - 1e-6 && v.x + v.w <= l.rect.x + l.rect.w + 1e-6, JSON.stringify(v));
    }
    assert.ok(r.cam.truck < 300 && r.cam.truck > 0);
  });
});

describe("blur and shake", () => {
  it("blur grows with distance from focus and snaps to 0.5 px", () => {
    assert.equal(blurFor(undefined, 0.3, 1), 0);
    assert.equal(blurFor(6, 1, 1), 0);
    assert.ok(blurFor(6, 0.3, 1) > blurFor(6, 0.8, 1));
    assert.equal(blurFor(6, 0.3, 1) % 0.5, 0);
  });
  it("seeded shake is deterministic, bounded and seed-dependent", () => {
    const s = { amp: 6, freq: 2, seed: 42 };
    assert.deepEqual(shakeAt(s, 1.234), shakeAt(s, 1.234));
    assert.notDeepEqual(shakeAt(s, 1.234), shakeAt({ ...s, seed: 43 }, 1.234));
    for (let t = 0; t < 10; t += 0.1) assert.ok(Math.abs(shakeAt(s, t).x) <= 6 + 1e-9);
    assert.deepEqual(shakeAt(undefined, 3), { x: 0, y: 0, roll: 0 });
    const cam = shotCameraAt({ keys: [{ t: 0, cx: 540, cy: 1000, zoom: 1, ease: "linear" }], shake: s }, 1);
    assert.equal(cam.cx, 540);
    assert.ok(cam.sx !== undefined);
  });
});
