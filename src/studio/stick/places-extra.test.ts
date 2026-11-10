import { test } from "node:test";
import assert from "node:assert/strict";
import { EXTRA_PLACES, tone } from "./places-extra.ts";
import { NIGHT_FILL, type Env } from "./places.ts";
import type { Ctx } from "./figure-base.ts";

/** Minimal recording context: logs the fill colour of every filled shape and the stroke state. */
function recorder() {
  const fills: string[] = [];
  const strokes: { style: string; width: number; cap: string; join: string }[] = [];
  const texts: { baseline: string }[] = [];
  const state: Record<string, unknown> = { fillStyle: "#000", strokeStyle: "#000", lineWidth: 1, lineCap: "butt", lineJoin: "miter", textBaseline: "alphabetic" };
  const noop = () => {};
  const ctx = new Proxy(state, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === "fill" || k === "fillRect") return () => fills.push(String(t.fillStyle));
      if (k === "stroke") return () => strokes.push({ style: String(t.strokeStyle), width: Number(t.lineWidth), cap: String(t.lineCap), join: String(t.lineJoin) });
      if (k === "fillText") return () => texts.push({ baseline: String(t.textBaseline) });
      return noop;
    },
    set(t, k: string, v) { t[k] = v; return true; },
  }) as unknown as Ctx;
  return { ctx, state, fills, strokes, texts };
}
const env = (night: boolean): Env => ({ w: 1080, h: 1920, floor: 1340, seatTop: 1100, night, t: 1, fill: night ? NIGHT_FILL : "#ffffff" });
const LIGHT = new Set(["white", "#fff", "#ffffff", "#eee", "#dedede", "#ddd", "#f6f6f6"]);

test("extra places: no light day greys at night (except the moon)", () => {
  for (const p of Object.values(EXTRA_PLACES)) {
    const r = recorder();
    p.back(r.ctx, env(true));
    p.front?.(r.ctx, env(true));
    const light = r.fills.filter((f) => LIGHT.has(f));
    const outdoor = !p.interior;
    assert.ok(light.length <= (outdoor ? 1 : 0), `${p.id} night light fills: ${light.join(",")}`);
  }
});

test("extra places: day colours are untouched by the night tone map", () => {
  for (const c of ["white", "#ddd", "#eee", "#dedede", "#aaa"]) assert.equal(tone({ night: false }, c), c);
  assert.equal(tone({ night: true }, "white"), NIGHT_FILL);
});

test("extra places: output does not depend on context state left by an earlier frame", () => {
  for (const p of Object.values(EXTRA_PLACES))
    for (const night of [false, true]) {
      const fresh = recorder();
      p.back(fresh.ctx, env(night));
      const dirty = recorder();
      Object.assign(dirty.state, { strokeStyle: "#ff0000", lineWidth: 17, lineCap: "square", lineJoin: "round", textBaseline: "middle" });
      p.back(dirty.ctx, env(night));
      assert.deepEqual(dirty.strokes, fresh.strokes, `${p.id} strokes depend on leaked state`);
      assert.deepEqual(dirty.texts, fresh.texts, `${p.id} text baseline depends on leaked state`);
      assert.deepEqual(dirty.fills, fresh.fills);
    }
});
