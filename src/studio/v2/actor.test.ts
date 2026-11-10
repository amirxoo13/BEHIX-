import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { actorAt, blendPose, drawActor, type ActorTrack } from "./actor.ts";
import { REF_BODY, poseOf, solve, type Pose } from "./pose.ts";
import { solvePuppet, type PuppetRig } from "./puppet.ts";
import { fromPuppetRig, toPuppetRig } from "./rig-adapter.ts";
import { normalizeSpans } from "./mouth.ts";

const track: ActorTrack = {
  keys: [
    { t: 0, pose: "stand", x: 100, face: 1 },
    { t: 1, pose: "explain" },
    { t: 2.5, x: 400 },
    { t: 6, pose: "point", face: -1 },
    { t: 7, pose: "sip" },
  ],
  speech: normalizeSpans([
    { id: "sz", start: 1.0, end: 1.2 }, { id: "ah", start: 1.2, end: 1.5 }, { id: "mbp", start: 1.5, end: 1.6 }, { id: "ee", start: 1.6, end: 1.9 },
  ]),
  seed: 3,
  crossfade: 0.05,
  unitsPerBody: 2,
};

const numbers = (p: Pose): number[] => [p.hipX, p.hipDrop, p.lean, p.tilt, p.shrug, p.head, p.nod, p.lHand.x, p.lHand.y, p.rHand.x, p.rHand.y, p.lFoot.x, p.lFoot.y, p.rFoot.x, p.rFoot.y, p.lAng, p.rAng];
const skNumbers = (sk: ReturnType<typeof solve>): number[] =>
  [sk.pelvis, sk.chest, sk.neck, sk.head, ...[sk.l, sk.r].flatMap((l) => [l.hip, l.knee, l.ankle, l.shoulder, l.elbow, l.wrist])].flatMap((v) => [v.x, v.y]).concat(sk.headAng, sk.spineAng);
const times = Array.from({ length: 241 }, (_, i) => i / 24);

describe("rig actor", () => {
  it("is deterministic and independent of sample order", () => {
    const forward = times.map((t) => JSON.stringify(actorAt(track, t)));
    const shuffled = [...times].reverse().map((t) => JSON.stringify(actorAt({ ...track, keys: [...track.keys] }, t))).reverse();
    assert.deepEqual(shuffled, forward);
    const keysShuffled = { ...track, keys: [track.keys[3], track.keys[0], track.keys[4], track.keys[2], track.keys[1]] };
    assert.deepEqual(times.map((t) => JSON.stringify(actorAt(keysShuffled, t))), forward);
  });
  it("every frame solves to a finite skeleton", () => {
    for (const t of times) {
      const f = actorAt(track, t);
      for (const v of [...numbers(f.pose), f.x, f.turn, f.open, ...skNumbers(solve(REF_BODY, f.pose, f.turn))]) assert.ok(Number.isFinite(v), `t=${t}`);
    }
  });
  it("walks from 100 to 400 without sliding past the target, facing the destination", () => {
    assert.equal(actorAt(track, 2.4).x, 100);
    assert.equal(actorAt(track, 2.4).walk, 0);
    const mid = actorAt(track, 3.5);
    assert.ok(mid.x > 100 && mid.x < 400 && mid.walk > 0.5);
    assert.equal(mid.facing, 1);
    assert.equal(actorAt(track, 5.9).x, 400);
    assert.equal(actorAt(track, 5.9).walk, 0);
    assert.equal(actorAt(track, 6.1).facing, -1);
    let prev = -Infinity;
    for (let t = 2.5; t < 6; t += 0.01) { const x = actorAt(track, t).x; assert.ok(x >= prev - 1e-9 && x <= 400 + 1e-9); prev = x; }
  });
  it("has no snap at walk start or end (pose changes smoothly frame to frame)", () => {
    const dt = 1 / 120;
    for (const edge of [2.5, 2.5 + 0.0001]) {
      const a = numbers(actorAt(track, edge - dt).pose), b = numbers(actorAt(track, edge + dt).pose);
      const jump = Math.max(...a.map((v, i) => Math.abs(v - b[i])));
      assert.ok(jump < 1.5, `jump ${jump} at walk start`);
    }
    let end = 2.5;
    while (actorAt(track, end).walk > 0 || end < 3) end += 0.01;
    const a = numbers(actorAt(track, end - dt).pose), b = numbers(actorAt(track, end + dt).pose);
    assert.ok(Math.max(...a.map((v, i) => Math.abs(v - b[i]))) < 1.5);
  });
  it("speech opens the mouth and crossfades; silence is rest", () => {
    assert.equal(actorAt(track, 0.5).mouth.id, "rest");
    assert.equal(actorAt(track, 0.5).open, 0);
    assert.equal(actorAt(track, 1.3).mouth.id, "ah");
    assert.ok(actorAt(track, 1.3).open > 0.8);
    assert.equal(actorAt(track, 1.55).open, 0);
    const fade = actorAt(track, 1.21);
    assert.equal(fade.mouth.from, "sz");
    assert.ok(fade.mouth.fromWeight > 0 && fade.mouth.fromWeight < 1);
  });
  it("blendPose(k=0) is the base pose and a held prop stays in hand while walking", () => {
    assert.deepEqual(blendPose(poseOf("point"), poseOf("cheer"), 0), poseOf("point"));
    const carry: ActorTrack = { keys: [{ t: 0, pose: "cup", x: 0 }, { t: 1, x: 300 }] };
    const f = actorAt(carry, 2);
    assert.ok(f.walk > 0.5);
    assert.equal(f.pose.rShape, "hold");
  });
  it("draws through drawPuppet with a procedural mouth fallback (recording context)", () => {
    const calls: string[] = [];
    const ctx = new Proxy({}, {
      get: (_t, k) => (k === "globalAlpha" ? 1 : (...args: unknown[]) => { calls.push(String(k)); void args; }),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    const rig = toPuppetRig(fromPuppetRig(minimalRig()));
    drawActor(ctx, rig, {} as CanvasImageSource, actorAt(track, 1.3), { groundY: 500, height: 300, originX: 10, xScale: 1 });
    assert.ok(calls.includes("ellipse"), "open mouth drawn as ellipse");
    assert.ok(calls.filter((c) => c === "drawImage").length >= 14, "every part drawn");
    void solvePuppet;
  });
});

/** A synthetic legacy puppet built from plausible joints (no image needed). */
function minimalRig(): PuppetRig {
  const j = (x: number, y: number) => ({ x, y });
  const joints = {
    headTop: j(200, 40), headCenter: j(200, 80), chin: j(200, 115), neck: j(200, 130), chest: j(200, 190), pelvis: j(200, 300),
    shoulderL: j(240, 145), elbowL: j(250, 220), wristL: j(255, 290), handL: j(256, 310),
    shoulderR: j(160, 145), elbowR: j(150, 220), wristR: j(145, 290), handR: j(144, 310),
    hipL: j(225, 305), kneeL: j(228, 420), ankleL: j(230, 530), toeL: j(250, 545),
    hipR: j(175, 305), kneeR: j(172, 420), ankleR: j(170, 530), toeR: j(150, 545),
  };
  const parts = (["torso", "head", "armFarUpper", "armFarFore", "handFar", "armNearUpper", "armNearFore", "handNear", "legFarThigh", "legFarShin", "footFar", "legNearThigh", "legNearShin", "footNear"] as const)
    .map((name, i) => ({ name, src: { x: i * 10, y: 0, w: 10, h: 10 }, off: { x: 190, y: 100 }, a: j(200, 100), b: j(200, 200) }));
  return {
    id: "t", name: "t", image: "cast/x.png", w: 400, h: 560, joints, parts: parts as PuppetRig["parts"],
    body: { ...REF_BODY }, u: 2, ground: 550, near: "L",
  };
}
