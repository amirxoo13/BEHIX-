import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ease, joints, mixPose } from "./figure.ts";
import { POSES } from "./poses.ts";

describe("stick figure rig", () => {
  it("UT-ST-01 blending starts and ends exactly on the two poses", () => {
    assert.deepEqual(mixPose(POSES.stand, POSES.sit, 0), POSES.stand);
    assert.deepEqual(mixPose(POSES.stand, POSES.sit, 1), POSES.sit);
    assert.equal(ease(0), 0);
    assert.equal(ease(1), 1);
    assert.equal(ease(0.5), 0.5);
  });
  it("UT-ST-02 sitting brings the feet closer to the hips than standing", () => {
    const drop = (p: typeof POSES.stand) => Math.max(joints(p).legL.end.y, joints(p).legR.end.y);
    assert.ok(drop(POSES.sit) < drop(POSES.stand) * 0.8);
  });
  it("UT-ST-03 arms are mirrored: left hand left of the body, right hand right", () => {
    const j = joints(POSES.standReachR);
    assert.ok(j.armR.end.x > j.shoulder.x + 60, "reaching right arm goes far right");
    assert.ok(j.armL.end.x < j.shoulder.x);
  });
});
