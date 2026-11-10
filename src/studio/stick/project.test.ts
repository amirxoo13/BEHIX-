import { test } from "node:test";
import assert from "node:assert/strict";
import {
  newProject,
  importProject,
  projectJson,
  changeText,
  setEdit,
  compileProject,
  history,
  remember,
  undo,
  redo,
  copyCharacter,
} from "./project.ts";
import { parseStory } from "./story-parse.ts";
import { dialogueText, thumbnailTime } from "./deliverables.ts";
import { frameFor } from "./layout.ts";
test("validated JSON roundtrip, rejecting foreign versions, nonfinite timing and duplicate ids", () => {
  const p = newProject("علی: سلام");
  assert.deepEqual(importProject(projectJson(p)), p);
  for (const invalid of [
    { ...p, schemaVersion: 2 },
    { ...p, settings: { ...p.settings, fps: 20 } },
    { ...p, text: "آ".repeat(20001) },
  ])
    assert.throws(() => importProject(JSON.stringify(invalid)));
  assert.throws(() => importProject("{"));
});
test("manual duration retimes mouth, SRT cues, camera and subsequent scenes coherently", () => {
  let p = newProject("علی: سلام\nعلی: خوبی؟\nصحنه: پارک\nعلی: رسیدیم");
  const before = compileProject(p),
    beat = before.beats[0];
  p = setEdit(p, beat.id, { duration: 8 });
  const after = compileProject(p),
    delta = after.cues[0].to - before.cues[0].to;
  assert.equal(after.cues[0].to - after.cues[0].from, 8);
  assert.ok(delta > 0);
  assert.ok(Math.abs(after.cues[1].from - before.cues[1].from - delta) < 1e-8);
  assert.ok(
    Math.abs(after.timeline.scenes[1].start - before.timeline.scenes[1].start - delta) < 1e-8,
  );
  const talk = after.timeline.scenes[0].actors[0].track.talk[0];
  assert.ok(talk.pulses!.every((p) => p.from >= talk.from && p.to <= talk.to));
});
test("text insertion preserves unambiguous edits; deleted or duplicated targets remain unresolved", () => {
  let p = newProject("علی: سلام\nعلی: خوبی؟");
  const id = parseStory(p.text).scenes[0].beats[1].id!;
  p = setEdit(p, id, { actor: "علی", x: 0.7, face: "smile" });
  const moved = changeText(p, "علی: سلام\nعلی: چه خبر؟\nعلی: خوبی؟");
  assert.equal(compileProject(moved).unresolved.length, 0);
  const removed = changeText(p, "علی: سلام");
  assert.equal(compileProject(removed).unresolved.length, 1);
  assert.equal(removed.edits.length, 1);
  const ambiguous = changeText(p, "علی: خوبی؟\nعلی: خوبی؟");
  assert.equal(compileProject(ambiguous).unresolved.length, 1);
});
test("position/face edits produce actual actor keys", () => {
  let p = newProject("علی: سلام");
  const id = compileProject(p).beats[0].id;
  p = setEdit(p, id, { actor: "علی", x: 0.8, face: "angry" });
  assert.ok(
    compileProject(p).timeline.scenes[0].actors[0].track.keys.some(
      (k) => k.x === 0.8 && k.face === "angry",
    ),
  );
});
test("history coalesces typing, truncates future, caps at 100 and supports redo", () => {
  let h = remember(history(0), 1);
  h = remember(h, 2, true);
  assert.equal(undo(h).present, 0);
  assert.equal(redo(undo(h)).present, 2);
  h = remember(undo(h), 3);
  assert.equal(h.future.length, 0);
  for (let i = 0; i < 150; i++) h = remember(h, i);
  assert.equal(h.past.length, 100);
});
test("character library copies are independent and output helpers use actual cue timing", () => {
  const c = { id: "علی", name: "علی", look: { kind: "man" as const, clothing: "coat" as const } };
  const p = copyCharacter(newProject("علی: سلام"), c);
  c.name = "تغییر";
  assert.equal(p.cast[0].name, "علی");
  const d = compileProject(p);
  assert.equal(d.timeline.cast[0].look.clothing, "coat");
  assert.match(dialogueText(d.cues), /علی: سلام/);
  assert.equal(thumbnailTime(d.cues, d.timeline.scenes), (d.cues[0].from + d.cues[0].to) / 2);
  assert.deepEqual([frameFor("square").w, frameFor("square").h], [1080, 1080]);
  assert.deepEqual([frameFor("landscape").w, frameFor("landscape").h], [1920, 1080]);
});
test("one-second dialogue keeps mouth and caption inside its SRT cue", () => {
  let p = newProject("علی (عصبانی): نه!\nعلی: سلام");
  p = setEdit(p, compileProject(p).beats[0].id, { duration: 1 });
  const d = compileProject(p),
    talk = d.timeline.scenes[0].actors[0].track.talk[0];
  assert.ok(talk.to <= d.cues[0].to);
  assert.ok(talk.from >= d.cues[0].from);
  assert.equal(d.cues[0].to - d.cues[0].from, 1);
});
test("malformed JSON edit anchors are rejected before reaching the editor", () => {
  const p = newProject("علی: سلام"),
    edited = setEdit(p, compileProject(p).beats[0].id, { duration: 3 });
  edited.edits[0].anchor.signature = "not-json";
  assert.throws(() => importProject(JSON.stringify(edited)));
});
test("moving a seated actor off a seat stands them up instead of floating", () => {
  let p = newProject("صحنه: پذیرایی خانه\nعلی نشسته است.\nعلی: سلام");
  p = setEdit(p, compileProject(p).beats[1].id, { actor: "علی", x: 0.9 });
  const keys = compileProject(p).timeline.scenes[0].actors[0].track.keys;
  assert.ok(keys.some((k) => k.x === 0.9 && k.pose.startsWith("stand")));
});

test("a duration the user picks clears the voice-fit marker; other edits keep it", () => {
  let p = changeText(newProject(), "مریم (زن): سلام");
  const id = parseStory(p.text).scenes[0].beats[0].id!;
  p = setEdit(p, id, { duration: 2.5, fit: true });
  assert.equal(p.edits[0].fit, true);
  p = setEdit(p, id, { shot: "close" });
  assert.equal(p.edits[0].fit, true);
  p = setEdit(p, id, { duration: 12 });
  assert.equal(p.edits[0].duration, 12);
  assert.equal(p.edits[0].fit, undefined);
});
