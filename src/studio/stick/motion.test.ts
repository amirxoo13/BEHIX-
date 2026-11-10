import { test } from "node:test";
import assert from "node:assert/strict";
import { inkOutline, limbPoints } from "./ink.ts";
import { estimateSyllables, mouthAt, speechPulses, springEase } from "./speech.ts";
import { actorAt } from "./animate.ts";
import { directStory } from "./story-direct.ts";
import { parseStory, parseAttrs } from "./story-parse.ts";
import { reachArm, HOLD_IDS, clearGrip } from "./holds.ts";
import { joints } from "./figure.ts";
import { POSES } from "./poses.ts";

test("ink passes through joints and is independent of call history", () => {
  const a = { x: 0, y: 0 },
    m = { x: 20, y: 30 },
    b = { x: 0, y: 70 };
  const points = limbPoints(a, m, b);
  assert.deepEqual(points[8], m);
  const outline = inkOutline(points, 4.6);
  inkOutline(limbPoints(b, a, m), 3);
  assert.deepEqual(inkOutline(points, 4.6), outline);
  assert.ok(outline.every((p) => p.every(Number.isFinite)));
});
test("spring starts and settles with bounded overshoot", () => {
  assert.equal(springEase(0), 0);
  assert.equal(springEase(1), 1);
  const samples = Array.from({ length: 101 }, (_, i) => springEase(i / 100));
  assert.ok(Math.max(...samples) > 1);
  assert.ok(Math.max(...samples) < 1.2);
  assert.ok(Math.abs(springEase(0.999) - 1) < 0.001);
});
test("text-driven pulses leave real gaps and scale with dialogue duration", () => {
  assert.equal(estimateSyllables("سلام"), 2);
  const a = speechPulses("سلام، علی!", 0, 4),
    b = speechPulses("سلام، علی!", 0, 8);
  assert.equal(a.length, 4);
  a.forEach((p, i) => assert.equal(b[i].to, p.to * 2));
  assert.ok(a[2].from - a[1].to > a[1].from - a[0].to);
  assert.equal(mouthAt(a, 4), 0);
  assert.equal(mouthAt(a, -1), 0);
  assert.ok(mouthAt(a, (a[0].from + a[0].to) / 2) > 0.5);
});
test("actor seeking is deterministic and parsed dialogue includes mouth pulses", () => {
  const { timeline } = directStory(parseStory("علی: سلام، سارا!"));
  const track = timeline.scenes[0].actors[0].track;
  assert.ok(track.talk[0].pulses?.length);
  const frame = actorAt(track, 1, null);
  actorAt(track, 3, null);
  assert.deepEqual(actorAt(track, 1, null), frame);
});
test("all grip corrections preserve finite two-bone geometry", () => {
  for (const pose of Object.values(POSES))
    for (const hold of HOLD_IDS)
      for (const side of [-1, 1]) {
        const j = joints(pose),
          key = side === -1 ? "armL" : "armR";
        const arm = clearGrip(hold, j[key].end, j.headC, j.shoulder, side);
        if (!arm) continue;
        const solved = joints({ ...pose, [key]: arm })[key];
        assert.ok(
          Math.abs(Math.hypot(solved.mid.x - j.shoulder.x, solved.mid.y - j.shoulder.y) - 46) <
            1e-8,
        );
        assert.ok(
          Math.abs(Math.hypot(solved.end.x - solved.mid.x, solved.end.y - solved.mid.y) - 44) <
            1e-8,
        );
      }
  assert.ok(Number.isFinite(reachArm({ x: 0, y: 0 }, { x: 0, y: 0 }, 1).a));
});
test("new cast and props have real parser mappings", () => {
  assert.equal(parseAttrs("نوزاد").kind, "baby");
  assert.equal(parseAttrs("زن چادر").look.clothing, "chador");
  for (const [word, id] of [
    ["کنترل تلویزیون", "remote"],
    ["بشقاب", "plate"],
    ["کیسه خرید", "shopping"],
    ["چتر", "umbrella"],
    ["لپ‌تاپ", "laptop"],
  ]) {
    const beat = parseStory(`علی ${word} در دست دارد.`).scenes[0].beats[0];
    assert.equal(beat.kind !== "narration" && beat.acts[0]?.hold, id);
  }
});
test("solid props clear the face in every pose and hand; food and phone permit intentional contact", async () => {
  const { HOLD_BOUNDS } = await import("./holds.ts");
  for (const [name, pose] of Object.entries(POSES))
    for (const hold of HOLD_IDS)
      for (const side of [-1, 1]) {
        if (["none", "cookie", "phone"].includes(hold)) continue;
        let j = joints(pose);
        const key = side === -1 ? "armL" : "armR";
        const arm = clearGrip(hold, j[key].end, j.headC, j.shoulder, side);
        if (arm) j = joints({ ...pose, [key]: arm });
        const end = j[key].end,
          b = { ...HOLD_BOUNDS[hold] };
        if (hold === "umbrella") b.bottom = -82;
        const x = Math.max(end.x + b.left, Math.min(end.x + b.right, j.headC.x)),
          y = Math.max(end.y + b.top, Math.min(end.y + b.bottom, j.headC.y));
        assert.ok(
          Math.hypot(x - j.headC.x, y - j.headC.y) >= 44,
          `${name}/${hold}/${side} intersects face`,
        );
      }
});
test("jump height is not cancelled by floor anchoring and sitting support is continuous",async()=>{
  const {footDrop,hipHeight}=await import("./story-render.ts");
  const jumping=POSES.standJump,j=joints(jumping),scale=2.4,floor=1340;
  const feetY=hipHeight(jumping,scale,floor,1100)+Math.max(j.legL.end.y,j.legR.end.y)*scale;
  assert.ok(feetY<floor-50);
  assert.equal(footDrop({...POSES.stand,py:-40}),footDrop(POSES.stand));
  const before=hipHeight({...POSES.sit,thigh:0.70001},scale,floor,1100),after=hipHeight({...POSES.sit,thigh:0.69999},scale,floor,1100);
  assert.ok(Math.abs(before-after)<0.1);
});
