import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { assemblePuppet, keyOutBackground } from "../../lib/puppet-build.server.ts";
import { jointsToPixels, solvePuppet, validateJoints, JOINT_NAMES, type PuppetRig } from "./puppet.ts";
import { POSE_IDS, poseOf } from "./pose.ts";
import { CORE_BONES, RIG_VERSION, validateRig, type BehixRig } from "./rig-format.ts";
import { fromPuppetRig, loadPuppet, migrate, toPuppetRig, worldRest } from "./rig-adapter.ts";

/** A real legacy puppet: the recorded Gemini joints + the recorded reference image (verify-out/). */
function legacyPuppet(): PuppetRig {
  const png = keyOutBackground(PNG.sync.read(readFileSync(new URL("../../../verify-out/rig-apose.png", import.meta.url))));
  const parsed = validateJoints(JSON.parse(readFileSync(new URL("../../../verify-out/rig-joints.json", import.meta.url), "utf8")));
  if ("error" in parsed) throw new Error(parsed.error);
  return assemblePuppet("sara", "سارا", "cast/sara.png", png, jointsToPixels(parsed.joints, png.width, png.height)).rig;
}
const close = (a: unknown, b: unknown, eps = 1e-6, path = "$"): void => {
  if (typeof a === "number" && typeof b === "number") { assert.ok(Math.abs(a - b) <= eps, `${path}: ${a} vs ${b}`); return; }
  if (a && b && typeof a === "object") {
    assert.deepEqual(Object.keys(a).sort(), Object.keys(b as object).sort(), path);
    for (const k of Object.keys(a)) close((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], eps, `${path}.${k}`);
    return;
  }
  assert.equal(a, b, path);
};

describe("behix.rig v1 ↔ legacy PuppetRig", () => {
  const old = legacyPuppet();
  const rig = fromPuppetRig(old);

  it("an upgraded legacy puppet is a valid behix.rig with every core bone", () => {
    const v = validateRig(JSON.parse(JSON.stringify(rig)));
    assert.ok(!("error" in v), "error" in v ? v.error : "");
    const ids = rig.views.threeQuarter.bones.map((b) => b.id);
    for (const c of CORE_BONES) assert.ok(ids.includes(c), c);
    assert.equal(rig.version, RIG_VERSION);
  });
  it("round-trips to the same PuppetRig (joints, parts, body, u, ground, near)", () => {
    close(toPuppetRig(rig), old, 1e-6);
  });
  it("round-trips through JSON (what is stored in Cloud Storage)", () => {
    const back = loadPuppet(JSON.parse(JSON.stringify(rig)));
    assert.ok(!("error" in back));
    if (!("error" in back)) close(back.puppet, old, 1e-6);
  });
  it("old cast/<id>.json still loads through migrate()", () => {
    const m = loadPuppet(JSON.parse(JSON.stringify(old)));
    assert.ok(!("error" in m), "error" in m ? m.error : "");
    if (!("error" in m)) close(m.puppet, old, 1e-6);
  });
  it("bone lengths in the rig equal the joint distances", () => {
    const w = worldRest(rig.views.threeQuarter);
    const len = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    assert.ok(Math.abs(len(w.get("forearm_l")!.start, w.get("forearm_l")!.end) - len(old.joints.elbowL, old.joints.wristL)) < 1e-6);
    assert.ok(Math.abs(len(w.get("shin_r")!.start, w.get("shin_r")!.end) - len(old.joints.kneeR, old.joints.ankleR)) < 1e-6);
  });
  it("the adapted puppet solves every v2 pose to finite joints", () => {
    const p = toPuppetRig(rig);
    for (const id of POSE_IDS) for (const turn of [0, 0.5, 1]) {
      const sk = solvePuppet(p, poseOf(id), turn);
      for (const v of [sk.pelvis, sk.chest, sk.neck, sk.head, sk.l.wrist, sk.r.wrist, sk.l.ankle, sk.r.ankle]) assert.ok(Number.isFinite(v.x) && Number.isFinite(v.y), `${id}@${turn}`);
    }
  });
  it("all 22 joints are produced", () => {
    const p = toPuppetRig(rig);
    assert.deepEqual(Object.keys(p.joints).sort(), [...JOINT_NAMES].sort());
  });
});

describe("rig validation and migration", () => {
  const rig = fromPuppetRig(legacyPuppet());
  const clone = (): BehixRig => JSON.parse(JSON.stringify(rig));
  it("rejects a newer format version", () => {
    const r = clone() as unknown as { version: number };
    r.version = RIG_VERSION + 1;
    assert.ok("error" in migrate(r));
  });
  it("rejects a missing core bone, a bone before its parent, a dangling layer and unknown viseme slots", () => {
    const a = clone(); a.views.threeQuarter.bones = a.views.threeQuarter.bones.filter((b) => b.id !== "shin_l");
    assert.ok("error" in validateRig(a));
    const b = clone(); b.views.threeQuarter.bones.reverse();
    assert.ok("error" in validateRig(b));
    const c = clone(); c.views.threeQuarter.layers[0].bone = "x_ghost";
    assert.ok("error" in validateRig(c));
    const d = clone(); (d.views.threeQuarter as unknown as { face: unknown }).face = { anchors: { mouth: { x: 1, y: 1 } }, mouth: { shout: { key: "k", rect: { x: 0, y: 0, w: 1, h: 1 } } } };
    assert.ok("error" in validateRig(d));
  });
  it("accepts a face with only some of the 11 mouth slots (others fall back)", () => {
    const e = clone();
    e.views.threeQuarter.face = { anchors: { mouth: { x: 540, y: 140 } }, mouth: { rest: { key: "k", rect: { x: 0, y: 0, w: 10, h: 5 } }, ah: { key: "k", rect: { x: 10, y: 0, w: 10, h: 5 } } } };
    assert.ok(!("error" in validateRig(e)));
  });
  it("garbage never throws", () => {
    for (const v of [null, 1, "x", [], {}, { format: "behix.rig" }, { joints: {}, parts: [], id: "a", u: 1, ground: 1 }]) assert.ok("error" in migrate(v));
  });
  it("alpha QA results survive the upgrade and the way back", () => {
    const qa = { passed: false, checks: { haloScore: 0.2, bboxOk: true } };
    const old = legacyPuppet();
    const rig = fromPuppetRig({ ...old, qa });
    assert.deepEqual(rig.source.qa, qa);
    assert.ok("rig" in validateRig(rig));
    assert.deepEqual(toPuppetRig(rig).qa, qa);
    assert.equal("qa" in toPuppetRig(fromPuppetRig(old)), false);
  });
});
