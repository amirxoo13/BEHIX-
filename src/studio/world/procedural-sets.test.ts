import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLACES, PLACE_IDS } from "../stick/places.ts";
import { SEAT_TOP } from "../stick/story-render.ts";
import { getSet, proceduralSet, registerSet, resolveSet } from "./procedural-sets.ts";
import { drawSet, parallaxCorrection, setReady } from "./draw-set.ts";
import { setDefSchema } from "./set-types.ts";
import type { Ctx } from "../stick/figure-base.ts";

describe("procedural sets (PlaceDef → SetDef)", () => {
  it("every place adapts to a valid set with parallax-1 procedural layers", () => {
    for (const id of PLACE_IDS) {
      const s = proceduralSet(id);
      assert.equal(setDefSchema.safeParse(s).success, true, id);
      assert.ok(s.layers.every((l) => l.parallax === 1 && l.procedural?.place === id), id);
      assert.equal(s.layers.some((l) => l.procedural?.part === "front"), !!PLACES[id].front, id);
      assert.deepEqual(s.seats, PLACES[id].seats);
      assert.equal(s.anchors.filter((a) => a.kind === "seat").length, PLACES[id].seats.length);
      for (const a of s.anchors.filter((a) => a.kind === "seat")) assert.equal(a.y, SEAT_TOP);
      assert.equal(s.fallback.place, id);
      assert.equal(proceduralSet(id), s, "cached");
    }
  });
  it("set hashes are stable and distinct per place", () => {
    const hashes = PLACE_IDS.map((id) => proceduralSet(id).hash);
    assert.equal(new Set(hashes).size, hashes.length);
  });
  it("registry: registered id wins, unknown id falls back to the place", () => {
    const raw = JSON.parse(readFileSync(new URL("./fixtures/living.wide.night.a.json", import.meta.url), "utf8"));
    const s = registerSet(raw);
    assert.equal(getSet("living.wide.night.a"), s);
    assert.equal(resolveSet("living.wide.night.a", "park"), s);
    assert.equal(resolveSet("nope", "park").id, "park.wide.procedural");
    assert.equal(resolveSet(undefined, "car").id, "car.wide.procedural");
  });
});

/** Records the order of drawing calls without a browser canvas. */
function recorder() {
  const calls: string[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k.startsWith("create")) return () => { calls.push(k); return { addColorStop() {} }; };
      if (k === "measureText") return () => ({ width: 10 });
      return (...args: unknown[]) => { calls.push(k === "drawImage" ? `drawImage:${String((args[0] as { id?: string })?.id ?? "?")}` : k); };
    },
    set(t, k: string, v) { t[k] = v; return true; },
  }) as unknown as Ctx;
  return { ctx, calls };
}
const env = { w: 1080, h: 1920, floor: 1340, seatTop: SEAT_TOP, night: true, t: 0, fill: "#c3c7d3" };
const stage = { k: 1, ox: 0, oy: 0 };

describe("drawSet", () => {
  it("procedural portrait passes call place.back / place.front directly (same calls as before)", () => {
    for (const id of ["living", "car", "street"] as const) {
      const direct = recorder();
      direct.ctx.save(); PLACES[id].back(direct.ctx, env); direct.ctx.restore();
      const viaSet = recorder();
      drawSet(viaSet.ctx, proceduralSet(id), "back", { stage, w: 1080, h: 1920, env });
      assert.deepEqual(viaSet.calls, direct.calls, id);
      const front = recorder();
      drawSet(front.ctx, proceduralSet(id), "front", { stage, w: 1080, h: 1920, env });
      assert.equal(front.calls.length > 0, !!PLACES[id].front, id);
      const overlay = recorder();
      drawSet(overlay.ctx, proceduralSet(id), "overlay", { stage, w: 1080, h: 1920, env });
      assert.deepEqual(overlay.calls, []);
    }
  });
  it("a set whose bitmaps are not loaded falls back to its procedural place", () => {
    const raw = JSON.parse(readFileSync(new URL("./fixtures/living.wide.night.a.json", import.meta.url), "utf8"));
    const set = setDefSchema.parse(raw);
    assert.equal(setReady(set, true, undefined), false);
    const a = recorder(), b = recorder();
    drawSet(a.ctx, set, "back", { stage, w: 1080, h: 1920, env });
    drawSet(b.ctx, proceduralSet("living"), "back", { stage, w: 1080, h: 1920, env });
    assert.deepEqual(a.calls, b.calls);
  });
  it("with bitmaps, layers draw in z order per pass", () => {
    const raw = JSON.parse(readFileSync(new URL("./fixtures/living.wide.night.a.json", import.meta.url), "utf8"));
    const set = setDefSchema.parse(raw);
    const assets = (key: string) => ({ id: key.split("/")[2].split(".")[0] }) as unknown as CanvasImageSource;
    const cam = { cx: 400, cy: 1000, zoom: 1.2, dolly: 0, truck: 0, roll: 0, focus: 1 };
    const pass = (p: "back" | "front" | "overlay") => {
      const r = recorder();
      drawSet(r.ctx, set, p, { stage, w: 1080, h: 1920, env, cam, assets });
      return r.calls.filter((c) => c.startsWith("drawImage")).map((c) => c.slice(10));
    };
    assert.deepEqual(pass("back"), ["sky", "far", "mid"]);
    assert.deepEqual(pass("front"), ["near"]);
    assert.deepEqual(pass("overlay"), ["overlay"]);
  });
  it("parallax correction is identity for p = 1 and without a camera", () => {
    assert.deepEqual(parallaxCorrection(undefined, 0.3, stage), [1, 0, 0, 1, 0, 0]);
    assert.deepEqual(parallaxCorrection({ cx: 300, cy: 900, zoom: 1.4, dolly: 0, truck: 0, roll: 0, focus: 1 }, 1, stage), [1, 0, 0, 1, 0, 0]);
  });
});
