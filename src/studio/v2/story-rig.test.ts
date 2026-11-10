import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { assemblePuppet, keyOutBackground } from "../../lib/puppet-build.server.ts";
import { compileProject, importProject, newProject, projectJson } from "../stick/project.ts";
import { actorAt as stickActorAt } from "../stick/animate.ts";
import { POSES as STICK_POSES } from "../stick/poses.ts";
import { characterKind, characterRefSchema } from "./character-ref.ts";
import { POSE_IDS } from "./pose.ts";
import { jointsToPixels, validateJoints, type PuppetRig } from "./puppet.ts";
import { STICK_TO_RIG_POSE, clearRigs, drawRigCharacter, getRig, registerRig, registerRigJson, rigCharactersEnabled, rigFrame, setRigCharactersFlag } from "./story-rig.ts";

function realRig(): PuppetRig {
  const png = keyOutBackground(PNG.sync.read(readFileSync(new URL("../../../verify-out/rig-apose.png", import.meta.url))));
  const v = validateJoints(JSON.parse(readFileSync(new URL("../../../verify-out/rig-joints.json", import.meta.url), "utf8")));
  if ("error" in v) throw new Error(v.error);
  return assemblePuppet("ali", "علی", "cast/x.png", png, jointsToPixels(v.joints, png.width, png.height)).rig;
}

function recorder() {
  const calls: string[] = [];
  const ctx = new Proxy({}, {
    get: (_t, k) => (k === "globalAlpha" ? 1 : () => void calls.push(String(k))),
    set: (_t, k) => { calls.push(`${String(k)}=`); return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const TEXT = "صحنه: پذیرایی خانه، روز\nعلی (مرد) وارد می‌شود.\nعلی: سلام!\nعلی دست تکان می‌دهد.";

afterEach(() => { setRigCharactersFlag(undefined); clearRigs(); });

describe("character kind (stick | photo | rig)", () => {
  it("missing kind means stick; the schema accepts the three kinds and rejects junk", () => {
    assert.equal(characterKind(undefined), "stick");
    assert.equal(characterKind({ kind: "rig", rigKey: "cast/a/b/c.json" }), "rig");
    for (const ok of [{ kind: "stick" }, { kind: "photo", charId: "x" }, { kind: "rig", rigKey: "k", view: "side" }]) assert.ok(characterRefSchema.safeParse(ok).success);
    for (const bad of [{ kind: "rig" }, { kind: "video" }, { kind: "rig", rigKey: "k", extra: 1 }, { kind: "photo", charId: "" }]) assert.equal(characterRefSchema.safeParse(bad).success, false);
  });
  it("old projects load unchanged; a saved character kind roundtrips and reaches the timeline cast", () => {
    const p = newProject(TEXT);
    const plain = compileProject(p);
    assert.ok(plain.timeline.cast.length > 0);
    assert.ok(plain.timeline.cast.every((c) => !("character" in c)));
    const id = plain.timeline.cast[0].id;
    const withRig = importProject(projectJson({ ...p, cast: [{ id, name: "علی", look: plain.timeline.cast[0].look, character: { kind: "rig", rigKey: "cast/o/p/1.json" } }] }));
    assert.deepEqual(compileProject(withRig).timeline.cast.find((c) => c.id === id)?.character, { kind: "rig", rigKey: "cast/o/p/1.json" });
    assert.throws(() => importProject(projectJson({ ...p, cast: [{ id, name: "x", look: { kind: "man" }, character: { kind: "rig" } as never }] })));
  });
});

describe("rig characters in /story (feature flag, default OFF)", () => {
  it("is off by default (no env flag in tests)", () => {
    assert.equal(rigCharactersEnabled(), false);
  });
  it("flag off / not a rig / rig not loaded → draws nothing and returns false", () => {
    registerRig("k", { rig: realRig(), img: {} as CanvasImageSource });
    const d = compileProject(newProject(TEXT)).timeline;
    const a = d.scenes[0].actors[0];
    const f = stickActorAt(a.track, 1, null);
    const o = { t: 1, x: 500, floorY: 1340, scale: 2.4, width: 1080 };
    for (const [flag, member] of [[false, { character: { kind: "rig" as const, rigKey: "k" } }], [true, {}], [true, { character: { kind: "stick" as const } }], [true, { character: { kind: "rig" as const, rigKey: "missing" } }]] as const) {
      setRigCharactersFlag(flag);
      const { ctx, calls } = recorder();
      assert.equal(drawRigCharacter(ctx, member, a.track, f, o), false);
      assert.deepEqual(calls, []);
    }
  });
  it("flag on + registered rig → draws the puppet at the stick's height, every frame finite", () => {
    setRigCharactersFlag(true);
    const rig = realRig();
    assert.ok("ok" in registerRigJson("k", rig, {} as CanvasImageSource));
    assert.ok(getRig("k"));
    const d = compileProject(newProject(TEXT)).timeline;
    const a = d.scenes[0].actors[0];
    for (let t = 0; t < d.scenes[0].end - d.scenes[0].start; t += 0.1) {
      const f = stickActorAt(a.track, t, null);
      const o = { t, x: 1080 * f.x, floorY: 1340, scale: 2.4, width: 1080 };
      const { frame, height } = rigFrame(getRig("k")!.rig, a.track, f, o);
      assert.ok(height > 300 && height < 1000);
      for (const v of [frame.turn, frame.walk, frame.open, frame.pose.hipX, frame.pose.lFoot.x, frame.pose.rHand.y]) assert.ok(Number.isFinite(v));
      const { ctx, calls } = recorder();
      assert.equal(drawRigCharacter(ctx, { character: { kind: "rig", rigKey: "k" } }, a.track, f, o), true);
      assert.ok(calls.filter((c) => c === "drawImage").length >= 14);
    }
  });
  it("every stick pose maps to a v2 pose", () => {
    for (const id of Object.keys(STICK_POSES) as (keyof typeof STICK_POSES)[]) assert.ok(POSE_IDS.includes(STICK_TO_RIG_POSE[id]), id);
  });
});
