import { test } from "node:test";
import assert from "node:assert/strict";
import { compileProject, newProject, setEdit, importProject, projectJson, changeText } from "./project.ts";
import { lineDuration } from "./story-direct.ts";
import { parseStory } from "./story-parse.ts";
test("long Persian speech remains readable and punctuation has an explicit time cost", () => {
  assert.ok(lineDuration("سلام ".repeat(100)) > 40);
  assert.ok(lineDuration("سلام، حال شما؟") > lineDuration("سلام حال شما"));
  const d = compileProject(newProject(`علی: ${"سلام ".repeat(100)}\nسارا: پاسخ`));
  assert.ok(d.cues[0].to - d.cues[0].from > 40);
  assert.ok(d.cues[1].from >= d.cues[0].to);
});
test("negated sitting never produces a sit action", () => {
  for (const text of ["علی ننشست", "علی ننشستند", "علی نمی‌نشیند"]) {
    const p = parseStory(text);
    assert.ok(p.scenes.flatMap(s => s.beats).every(b => b.kind === "narration" || !b.acts.some(a => a.sit)));
  }
});
test("gesture, prop, scene and duration edits affect compiled keys and survive JSON and text insertion", () => {
  let p = newProject("صحنه: پارک\nعلی: سلام\nعلی دست تکان می‌دهد.\nراوی: پایان");
  const d = compileProject(p), id = d.beats[0].id;
  p = setEdit(p, id, { actor: "علی", gesture: "cheer", hold: "flowers", move: "toRight" });
  p = setEdit(p, id, { place: "living", night: true, duration: 8 });
  p = setEdit(p, d.beats[1].id, { duration: 5 });
  p = setEdit(p, d.beats[2].id, { duration: 6 });
  p = importProject(projectJson(p));
  const after = compileProject(p), scene = after.timeline.scenes[0];
  assert.equal(scene.place, "living"); assert.equal(scene.night, true);
  assert.ok(scene.actors[0].track.keys.some(k => k.pose === "standCheer" && k.holdR === "flowers"));
  assert.ok(scene.actors[0].track.keys.some(k => k.x === 0.78));
  assert.equal(after.beats[1].to - after.beats[1].from, 5);
  assert.equal(after.beats[2].to - after.beats[2].from, 6);
  assert.equal(compileProject(changeText(p, p.text.replace("علی: سلام", "راوی: شروع\nعلی: سلام"))).unresolved.length, 0);
  assert.throws(() => setEdit(p, id, { gesture: "bogus" } as never));
});
test("scene edits from different beats have one effective value and explicit pauses can be retimed", () => {
  let p = newProject("صحنه: پارک\nعلی: سلام\nعلی: خوبی؟\nپس از ۳ ثانیه");
  const beats = compileProject(p).beats;
  p = setEdit(p, beats[1].id, { place: "car", night: true });
  p = setEdit(p, beats[0].id, { place: "yard", night: false });
  p = setEdit(p, beats[2].id, { duration: 9 });
  const d = compileProject(p);
  assert.equal(d.timeline.scenes[0].place, "yard"); assert.equal(d.timeline.scenes[0].night, false);
  assert.equal(d.beats[2].to - d.beats[2].from, 9);
});
test("same-heading scenes keep separate overrides; seated gestures compile actual seated poses", () => {
  let p = newProject("صحنه: خانه\nعلی: اول\nصحنه: خانه\nعلی: دوم");
  const beats = compileProject(p).beats;
  p = setEdit(p, beats[1].id, { place: "cafe" });
  p = setEdit(p, beats[0].id, { place: "living" });
  p = setEdit(p, beats[0].id, { actor: "علی", gesture: "write" });
  const d = compileProject(p);
  assert.equal(d.timeline.scenes[1].place, "cafe");
  assert.ok(d.timeline.scenes[0].actors[0].track.keys.some(k => k.pose === "sitWrite"));
});
