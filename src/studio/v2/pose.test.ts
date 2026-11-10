import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { POSE_IDS, REF_BODY, REST, WALK, WALK_DIST, alive, ik, poseAt, poseOf, solve, transition, walkPlan, walkPose, type Pose, type Vec } from "./pose.ts";

const d = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const flat = (p: Pose) => [p.hipX, p.hipDrop, p.lean, p.tilt, p.shrug, p.head, p.nod, p.lHand.x, p.lHand.y, p.rHand.x, p.rHand.y, p.lFoot.x, p.lFoot.y, p.rFoot.x, p.rFoot.y, p.lAng, p.rAng];
const maxJump = (a: Pose, b: Pose) => Math.max(...flat(a).map((v, i) => Math.abs(v - flat(b)[i])));

describe("v2 pose engine", () => {
  it("solve is finite and keeps limb lengths for every pose × turn", () => {
    const body = REF_BODY;
    for (const id of POSE_IDS) for (const turn of [0, 0.35, 0.7, 1]) {
      const sk = solve(body, poseOf(id), turn);
      const pts = [sk.pelvis, sk.chest, sk.neck, sk.head, ...[sk.l, sk.r].flatMap((l) => [l.hip, l.knee, l.ankle, l.shoulder, l.elbow, l.wrist])];
      for (const p of pts) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), `${id}@${turn}`);
      for (const l of [sk.l, sk.r]) {
        assert.ok(Math.abs(d(l.hip, l.knee) - body.leg * 0.51) < 1e-6);
        assert.ok(Math.abs(d(l.knee, l.ankle) - body.leg * 0.49) < 1e-6);
        assert.ok(Math.abs(d(l.shoulder, l.elbow) - body.arm * 0.52) < 1e-6);
        assert.ok(Math.abs(d(l.elbow, l.wrist) - body.arm * 0.48) < 1e-6);
        assert.ok(l.knee.x - (l.hip.x + l.ankle.x) / 2 >= -1e-6 || turn === 0, `knee bends forward ${id}@${turn}`);
      }
      // planted feet stay on the ground
      if (poseOf(id).lFoot.y === 0) assert.ok(Math.abs(sk.l.ankle.y + (body.ankle ?? 7)) < 0.05, `${id} left foot planted`);
    }
  });
  it("ik keeps segment lengths for reachable, too-far and degenerate targets", () => {
    for (const target of [{ x: 30, y: 40 }, { x: 500, y: 0 }, { x: 0, y: 0 }, { x: 0.001, y: 0 }]) {
      const r = ik({ x: 0, y: 0 }, target, 40, 35, { x: 0, y: 1 });
      assert.ok(Math.abs(d({ x: 0, y: 0 }, r.mid) - 40) < 1e-6);
      assert.ok(Math.abs(d(r.mid, r.end) - 35) < 1e-6);
    }
    assert.ok(ik({ x: 0, y: 0 }, { x: 50, y: 0 }, 40, 35, { x: 0, y: 1 }).mid.y > 0, "bends toward the hint");
  });
  it("transition hits its endpoints and poseAt is continuous across keys", () => {
    assert.ok(maxJump(transition(REST, poseOf("point"), 1), poseOf("point")) < 1e-9);
    assert.ok(maxJump(transition(REST, poseOf("point"), 0), REST) < 1e-9);
    const keys = [{ t: 0, pose: "stand" as const }, { t: 1, pose: "point" as const }, { t: 1.3, pose: "shock" as const }, { t: 3, pose: "sad" as const }, { t: 3.08, pose: "cheer" as const }];
    const dt = 1 / 240;
    for (let t = 0; t < 4; t += dt) assert.ok(maxJump(poseAt(keys, t).pose, poseAt(keys, t + dt).pose) < 1.2, `jump at ${t.toFixed(3)}`);
    assert.equal(poseAt(keys, 0.5).moving, false);
    assert.equal(poseAt(keys, 1.1).moving, true);
    assert.equal(poseAt([], 1).id, "stand");
  });
  it("walkPlan covers exactly dist, k ramps from 0, and feet are planted at rest", () => {
    for (const dist of [0, 5, WALK_DIST, 300]) {
      const p = walkPlan(dist);
      assert.equal(p.at(p.duration + 1).s, Math.abs(dist));
      assert.equal(p.at(0).k, 0);
      let prev = 0;
      for (let t = 0; t <= p.duration; t += 0.01) { const s = p.at(t).s; assert.ok(s >= prev - 1e-9 && s <= Math.abs(dist) + 1e-9); prev = s; }
    }
    const w0 = walkPose(0.3, 0);
    for (const v of [w0.lFoot.x, w0.lFoot.y, w0.rFoot.x, w0.rFoot.y]) assert.ok(Math.abs(v) < 1e-12);
    // the stance foot moves backwards at body speed (no slip): foot x speed ≈ −stride*2/stance per cycle
    const a = walkPose(0.1, 1).lFoot.x, b = walkPose(0.2, 1).lFoot.x;
    assert.ok(Math.abs((a - b) / 0.1 - WALK_DIST) < 1e-6);
    assert.ok(WALK.stride > 0);
  });
  it("alive is deterministic and small", () => {
    const p = poseOf("explain");
    assert.deepEqual(alive(p, 2.3, 1, 0.5, "explain"), alive(p, 2.3, 1, 0.5, "explain"));
    assert.ok(maxJump(alive(p, 2.3, 1, 0, "explain"), p) < 3);
  });
});
