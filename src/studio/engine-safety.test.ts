import { test } from "node:test";
import assert from "node:assert/strict";
import { solve2, visemeFromText } from "./rig.ts";
import { filmTime } from "./playback-time.ts";
import { normalize, exportBackup, importBackup } from "./persist.ts";
import { DEFAULT_SHOTS } from "./project.ts";
import { actorPlacement } from "./placement.ts";
test("coincident IK target preserves both bone lengths and finite endpoints", () => {
  const p = solve2(20, 30, 20, 30, 38, 32, x => x);
  assert.ok(Math.abs(Math.hypot(p.x - 20, p.y - 30) - 38) < 1e-6);
  assert.ok(Math.abs(Math.hypot(p.x - p.ex, p.y - p.ey) - 32) < 1e-6);
});
test("mouth closes outside dialogue and clock phase is independent of playback start", () => {
  for (const t of [-1, 2, Infinity, NaN]) assert.equal(visemeFromText("سلام", t, 2).open, 0);
  assert.equal(filmTime(2000, 500), filmTime(102000, 100500));
});
test("photo import repairs invalid motions and pitch; placement roundtrips with legacy defaults", () => {
  const sh = structuredClone(DEFAULT_SHOTS[0]);
  const bad = normalize({ ...sh, pitch: -2, actorA: { ...sh.actorA, action: "invalid", emotion: "invalid", x: 5, scale: Infinity } } as unknown as typeof sh);
  assert.equal(bad.actorA.action, "idle"); assert.equal(bad.actorA.emotion, "neutral");
  assert.equal(bad.pitch, 0.8); assert.equal(bad.actorA.x, 0.88); assert.equal(bad.actorA.scale, 1);
  assert.deepEqual(actorPlacement({}, 0.3), { x: 0.3, scale: 1 });
  const p = { shots: [{...sh, actorA: {...sh.actorA, x: 0.42, scale: 0.8}}], aspect: "wide" as const, showRig: false, title: "آزمون", logline: "", genre: "" };
  const back = importBackup(exportBackup(p));
  assert.ok(back.ok); assert.equal(back.data.shots[0].actorA.x, 0.42); assert.equal(back.data.shots[0].actorA.scale, 0.8);
});

test("tear particles are seek-order independent and bounded with no retained simulation", async () => {
  const { tearsAt } = await import("./tears.ts");
  const at = tearsAt(2.3, true, "actor");
  tearsAt(999, true, "actor"); tearsAt(0.1, false, "actor");
  assert.deepEqual(tearsAt(2.3, true, "actor"), at);
  assert.ok(at.length > 0 && at.length <= 5);
  assert.ok(at.every(d => d.life > 0 && d.life <= 1 && d.y < 40));
  assert.deepEqual(tearsAt(2.3, false, "actor"), []);
});
