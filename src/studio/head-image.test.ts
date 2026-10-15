import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contentBox, fitSize, hasTransparency, removeFlatBackground, sampleSkin, type Pixels } from "./head-image.ts";

/** تصویر آزمایشی: پس‌زمینهٔ سفید، یک «صورت» نارنجی ۶×۶ در وسط که وسطش یک پیکسل سفید دارد. */
function face(): Pixels {
  const w = 10;
  const h = 10;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inside = x >= 2 && x <= 7 && y >= 2 && y <= 7;
      const [r, g, b] = inside ? [224, 176, 122] : [250, 250, 250];
      data.set([r, g, b, 255], i);
    }
  }
  data.set([250, 250, 250, 255], (5 * w + 5) * 4); // سفیدیِ چشم داخل صورت
  return { data, width: w, height: h };
}

describe("head image processing", () => {
  it("UT-HD-01 flat background is removed only where it touches the border", () => {
    const img = face();
    assert.equal(hasTransparency(img), false);
    const out = removeFlatBackground(img);
    assert.equal(out.data[3], 0, "corner is transparent");
    assert.equal(out.data[(2 * 10 + 2) * 4 + 3], 255, "face pixel stays");
    assert.equal(out.data[(5 * 10 + 5) * 4 + 3], 255, "white inside the face is not background");
    assert.equal(hasTransparency(out), true);
    assert.equal(img.data[3], 255, "the input is not modified");
  });
  it("UT-HD-02 content box crops to the visible head", () => {
    assert.deepEqual(contentBox(removeFlatBackground(face())), { x: 2, y: 2, w: 6, h: 6 });
    const empty = { data: new Uint8ClampedArray(16), width: 2, height: 2 };
    assert.equal(contentBox(empty), null);
  });
  it("UT-HD-03 skin colour comes from the cheeks, ignoring transparent pixels", () => {
    const out = removeFlatBackground(face());
    assert.equal(sampleSkin(out, { x: 0.5, y: 0.6 }), "#e0b07a");
    const none = { data: new Uint8ClampedArray(16), width: 2, height: 2 };
    assert.equal(sampleSkin(none, { x: 0.5, y: 0.5 }), "#e0b07a", "fallback skin");
  });
  it("UT-HD-04 fitSize only shrinks and keeps the aspect ratio", () => {
    assert.deepEqual(fitSize(1000, 500, 320), { w: 320, h: 160 });
    assert.deepEqual(fitSize(100, 50, 320), { w: 100, h: 50 });
  });
});

describe("automatic face points", () => {
  it("UT-HD-05 mouth = middle of the lips, eyes = iris centres sorted left to right, mapped into the head box", async () => {
    const { faceFromLandmarks } = await import("./head-image.ts");
    const pts = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
    pts[13] = { x: 0.5, y: 0.7 };
    pts[14] = { x: 0.5, y: 0.8 };
    pts[468] = { x: 0.65, y: 0.4 }; // چشم راستِ آدم = سمت راستِ تصویر نیست؛ ترتیب باید از روی x باشد
    pts[473] = { x: 0.35, y: 0.42 };
    const f = faceFromLandmarks(pts, { x: 0.1, y: 0.1, w: 0.8, h: 0.8 })!;
    assert.deepEqual(f.mouth, { x: 0.5, y: (0.75 - 0.1) / 0.8 });
    assert.ok(f.eyes.l.x < f.eyes.r.x);
    assert.equal(Math.round(f.eyes.l.x * 1000), Math.round(((0.35 - 0.1) / 0.8) * 1000));
  });
  it("UT-HD-06 without iris points the eye corners are used; too few points = no face", async () => {
    const { faceFromLandmarks } = await import("./head-image.ts");
    const pts = Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5 }));
    pts[33] = { x: 0.2, y: 0.4 };
    pts[133] = { x: 0.4, y: 0.4 };
    pts[362] = { x: 0.6, y: 0.4 };
    pts[263] = { x: 0.8, y: 0.4 };
    const f = faceFromLandmarks(pts)!;
    assert.equal(Math.round(f.eyes.l.x * 100), 30);
    assert.equal(Math.round(f.eyes.r.x * 100), 70);
    assert.equal(faceFromLandmarks(pts.slice(0, 100)), null);
  });
});

describe("background check", () => {
  it("UT-HD-07 only a near single-colour border counts as removable background", async () => {
    const { isFlatBorder } = await import("./head-image.ts");
    assert.equal(isFlatBorder(face()), true);
    const busy = face();
    for (let x = 0; x < 10; x++) busy.data.set([20, 120, 30, 255], x * 4); // لبهٔ بالا سبز
    for (let y = 0; y < 10; y++) busy.data.set([200, 30, 30, 255], (y * 10) * 4); // لبهٔ چپ قرمز
    assert.equal(isFlatBorder(busy), false);
  });
});
