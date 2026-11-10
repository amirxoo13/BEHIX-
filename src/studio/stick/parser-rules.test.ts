import { test } from "node:test";
import assert from "node:assert/strict";
import { parseStory, MAX_STORY_CHARS } from "./story-parse.ts";
import { directStory } from "./story-direct.ts";
import { PLACES } from "./places.ts";
import { readDelay } from "./persian-rules.ts";
const acts = (text: string) =>
  parseStory(text).scenes.flatMap((s) =>
    s.beats.flatMap((b) => (b.kind === "action" ? b.acts : [])),
  );
test("plural and singular conjugations share meaning without deleting name suffixes", () => {
  for (const verb of ["می‌خندند", "میخندند", "خندیدند"])
    assert.deepEqual(
      acts(`علی و سارا ${verb}.`).map((a) => [a.who, a.face]),
      [
        ["علی", "laugh"],
        ["سارا", "laugh"],
      ],
    );
  assert.equal(acts("علی وارد می‌شوند.")[0].move, "enter");
});
test("pronouns resolve last unique subject, not the person approached", () => {
  const a = acts("علی به طرف سارا می‌رود. او دست تکان می‌دهد. اون می‌خندد.");
  assert.equal(a[1].who, "علی");
  assert.equal(a[2].who, "علی");
  const p = parseStory("علی و سارا می‌خندند. او دست تکان می‌دهد.");
  assert.ok(p.warnings.some((w) => w.includes("مرجع")));
  assert.equal(acts("علی می‌خندد.\nصحنه: پارک\nاو دست تکان می‌دهد.").length, 1);
});
test("sequential clauses inherit subjects and retain order", () => {
  const a = acts("علی و سارا وارد می‌شوند و دست تکان می‌دهند و سپس می‌خندند.");
  assert.deepEqual(
    a.map((x) => x.move ?? x.gesture ?? x.face),
    ["enter", "enter", "wave", "wave", "laugh", "laugh"],
  );
});
test("negative verbs never become positive actions", () => {
  assert.deepEqual(
    acts("علی نمی‌خندد و سپس دست تکان می‌دهد.").map((a) => a.gesture),
    ["wave"],
  );
  assert.equal(acts("علی وارد نمی‌شود.").length, 0);
});
test("explicit and default waits shift subsequent cues by exactly their duration", () => {
  assert.equal(readDelay("بعد از چند ثانیه علی می‌خندد")?.seconds, 3);
  assert.equal(readDelay("پس از ۲٫۵ ثانیه، علی می‌خندد")?.seconds, 2.5);
  const base = directStory(parseStory("علی: سلام\nعلی: خوبی؟"));
  const wait = directStory(parseStory("علی: سلام\nبعد از ۳ ثانیه\nعلی: خوبی؟"));
  assert.ok(Math.abs(wait.cues[1].from - base.cues[1].from - 3) < 1e-9);
});
test("unrecognized instructions report original line and source range", () => {
  const text = "\nعلی: سلام\nعلی جادوی نامفهوم انجام داد.";
  const p = parseStory(text),
    b = p.scenes[0].beats[1];
  assert.ok(p.warnings.some((w) => w.includes("خط 3") && w.includes("جادوی نامفهوم")));
  assert.equal(text.slice(b.source!.start, b.source!.end), b.source!.text);
});
test("all added locations map to actual renderers", () => {
  for (const id of [
    "hospital",
    "shop",
    "elevator",
    "metro",
    "bus",
    "roof",
    "yard",
    "wedding",
  ] as const) {
    const p = parseStory(`صحنه: ${PLACES[id].label}\nعلی: سلام`);
    assert.equal(p.scenes[0].place, id);
    assert.equal(typeof PLACES[id].back, "function");
  }
});
test("edge inputs stay finite, bounded and deterministic", () => {
  for (const text of [
    "",
    " ",
    "علي: كجا؟",
    "علی می‌خندد.",
    "علی (مرد",
    "صحنه ۱۲: پارک\nعلی: ۱۲۳",
    "علی: " + "آ".repeat(MAX_STORY_CHARS + 20),
  ]) {
    const p = parseStory(text),
      d = directStory(p);
    assert.deepEqual(parseStory(text), p);
    assert.ok(Number.isFinite(d.timeline.duration));
    if (text.length > MAX_STORY_CHARS) assert.ok(p.warnings.some((w) => w.includes("نویسه")));
  }
});
