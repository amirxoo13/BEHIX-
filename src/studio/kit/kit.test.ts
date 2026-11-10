import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blobs, keyGreen, limbJoints, peelSkin, removeThin, trim, type Rgba } from "./process.ts";
import { checkBodyParts } from "./build.ts";
import { ik } from "./draw.ts";
import { kitMouthFor } from "./kit.ts";
import { repairCharacter } from "../persist.ts";

const canvas = (w: number, h: number, fill: [number, number, number]): Rgba => {
  const d = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) d.set([...fill, 255], i * 4);
  return { width: w, height: h, data: d };
};
const paint = (img: Rgba, inside: (x: number, y: number) => boolean, c: [number, number, number]) => {
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (inside(x, y)) img.data.set([...c, 255], (y * img.width + x) * 4);
};

describe("character kit (Gemini parts → engine skeleton)", () => {
  it("UT-KIT-01 green screen becomes transparent and parts are found as separate blobs", () => {
    const img = canvas(200, 100, [0, 255, 0]);
    paint(img, (x, y) => x > 10 && x < 60 && y > 10 && y < 90, [30, 40, 120]);
    paint(img, (x, y) => (x - 140) ** 2 + (y - 50) ** 2 < 30 ** 2, [200, 150, 120]);
    const k = keyGreen(img);
    assert.equal(k.data[3], 0, "green pixel is transparent");
    const { blobs: b } = blobs(k, 50);
    assert.equal(b.length, 2);
  });
  it("UT-KIT-02 limb joints sit inside the rounded caps (half a width from the ends)", () => {
    const img = canvas(40, 200, [0, 255, 0]);
    paint(img, (x, y) => { const cy = Math.min(Math.max(y, 20), 180); return (x - 20) ** 2 + (y - cy) ** 2 < 20 ** 2; }, [30, 40, 120]);
    const j = limbJoints(keyGreen(img));
    assert.ok(Math.abs(j.top.x - 20) < 1.5 && Math.abs(j.top.y - 20) < 3, JSON.stringify(j));
    assert.ok(Math.abs(j.bottom.y - 180) < 3, JSON.stringify(j));
  });
  it("UT-KIT-03 skin square around the lips is peeled, lips stay", () => {
    const img = canvas(100, 60, [235, 180, 150]);
    paint(img, (x, y) => ((x - 50) / 30) ** 2 + ((y - 30) / 10) ** 2 < 1, [190, 90, 90]);
    const out = trim(peelSkin(img, 30)).img;
    assert.ok(out.width <= 64 && out.width >= 58, `trimmed to the lips: ${out.width}`);
  });
  it("UT-KIT-04 two-bone IK reaches the target with the drawing's own lengths", () => {
    const r = ik({ x: 0, y: 0 }, { x: 10, y: 60 }, 40, 35, 1);
    const end = { x: r.mid.x + Math.cos(r.a2) * 35, y: r.mid.y + Math.sin(r.a2) * 35 };
    assert.ok(Math.hypot(end.x - 10, end.y - 60) < 1e-6);
    assert.ok(Math.abs(Math.hypot(r.mid.x, r.mid.y) - 40) < 1e-9);
    const far = ik({ x: 0, y: 0 }, { x: 0, y: 500 }, 40, 35, 1);
    assert.ok(Math.abs(far.mid.x) < 0.5, "out of reach → straight limb");
  });
  it("UT-KIT-05 engine visemes map onto the nine Gemini mouths", () => {
    assert.equal(kitMouthFor("wide"), "ah");
    assert.equal(kitMouthFor("sz"), "ee");
    assert.equal(kitMouthFor("rest"), "rest");
    assert.equal(kitMouthFor("mbp"), "mbp");
  });
  it("UT-KIT-06 saved projects keep only kits served by this site", () => {
    const p = (n: number) => ({ src: `/api/kit?f=abcdefghijkl%2F${n}.png`, w: 10, h: 10, a: { x: 1, y: 1 }, b: { x: 1, y: 9 } });
    const mouths = Object.fromEntries(["rest", "mbp", "ah", "eh", "ee", "oh", "oo", "fv", "l"].map((m, i) => [m, p(20 + i)]));
    const kit = { version: 1, name: "x", torso: { ...p(0), neck: { x: 1, y: 1 }, shoulder: { x: 1, y: 1 }, hip: { x: 1, y: 1 } }, upperArm: p(1), forearm: p(2), hand: p(3), thigh: p(4), shin: p(5), foot: p(6), head: { ...p(7), neck: { x: 1, y: 1 }, mouth: { x: 1, y: 1, w: 3 }, eyes: [] }, mouths, skin: "#c38055" };
    assert.ok(repairCharacter({ id: "u-abc123", name: "پرویز", kit })?.kit);
    const evil = { ...kit, hand: { ...p(3), src: "https://evil.example/x.png" } };
    assert.equal(repairCharacter({ id: "u-abc123", name: "پرویز", kit: evil })?.kit, undefined);
  });
  it("UT-KIT-07 thin leftover box lines are removed, solid parts stay; a torso drawn with arms is rejected", () => {
    const img = canvas(200, 100, [0, 255, 0]);
    paint(img, (x, y) => x > 20 && x < 80 && y > 20 && y < 80, [30, 40, 120]);
    paint(img, (x, y) => (y === 5 || y === 6) && x > 2 && x < 195, [20, 20, 20]);
    const out = removeThin(keyGreen(img), 3);
    assert.equal(out.data[(5 * 200 + 150) * 4 + 3], 0, "line gone");
    assert.equal(out.data[(50 * 200 + 50) * 4 + 3], 255, "part kept");
    const box = (w: number, h: number) => ({ width: w, height: h, data: new Uint8Array(w * h * 4) });
    const ok = { torso: box(350, 600), upperArm: box(120, 330), forearm: box(130, 420), hand: box(180, 250), thigh: box(150, 580), shin: box(120, 360), foot: box(210, 190) };
    assert.equal(checkBodyParts(ok), null);
    assert.ok(checkBodyParts({ ...ok, torso: box(800, 600) }));
    assert.ok(checkBodyParts({ ...ok, forearm: box(280, 300) }));
  });
});
