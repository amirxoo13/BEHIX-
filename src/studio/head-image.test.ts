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
