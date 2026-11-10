import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { actorAt } from "./animate.ts";
import { cleanSpeaker, parseAttrs, parseStory } from "./story-parse.ts";
import { cuesToSrt, directStory, lineDuration, spread } from "./story-direct.ts";

const STORY = `صحنه ۱: پذیرایی خانه، شب
علی (مرد، سمت راست، عینکی) و سارا (زن، سمت چپ، روسری) روی مبل نشسته‌اند. سارا چای در دست دارد.
علی با گوشی ور می‌رود و لبخند می‌زند.
سارا (عصبانی): باز هم گوشی؟!
علی (شوکه): نه عزیزم.
پسر (بچه) وارد می‌شود و به طرف علی می‌رود.
علی فکر می‌کند.
صحنه ۲: داخل ماشین، روز
علی پشت فرمان نشسته است.
راوی: فردای آن روز...
ناگهان سارا گفت: نگه دار!
علی بیرون می‌رود.`;

describe("Persian story parser", () => {
  const plan = parseStory(STORY);

  it("UT-SP-01 reads scenes with place and day/night", () => {
    assert.deepEqual(
      plan.scenes.map((s) => [s.place, s.night]),
      [
        ["living", true],
        ["car", false],
      ],
    );
  });

  it("UT-SP-02 reads cast with gender, age, side and looks", () => {
    const ali = plan.cast.find((c) => c.id === "علی");
    const sara = plan.cast.find((c) => c.id === "سارا");
    const boy = plan.cast.find((c) => c.id === "پسر");
    assert.equal(ali?.look.kind, "man");
    assert.equal(ali?.look.glasses, true);
    assert.equal(ali?.side, "right");
    assert.equal(sara?.look.kind, "woman");
    assert.equal(sara?.look.hair, "scarf");
    assert.equal(sara?.side, "left");
    assert.equal(boy?.look.kind, "boy");
    assert.equal(plan.cast.length, 3);
    assert.deepEqual(plan.warnings, []);
  });

  it("UT-SP-03 shared subjects, holds, faces and idioms", () => {
    const beats = plan.scenes[0].beats;
    assert.deepEqual(beats[0].kind === "action" && beats[0].acts.map((a) => [a.who, a.sit]), [
      ["علی", true],
      ["سارا", true],
    ]);
    assert.equal(beats[1].kind === "action" && beats[1].acts[0].hold, "cup");
    // «ور می‌رود» یعنی با گوشی بازی می‌کند، نه بیرون رفتن
    const phone = beats[2].kind === "action" ? beats[2].acts[0] : null;
    assert.equal(phone?.move, undefined);
    assert.equal(phone?.hold, "phone");
    const smile = beats[3];
    assert.equal(smile.kind === "action" && smile.acts[0]?.face, "smile");
  });

  it("UT-SP-04 dialogue with mood, entry toward someone, narration and speaker cleanup", () => {
    const beats = plan.scenes[0].beats;
    const line = beats.find(b => b.kind === "line")!;
    assert.equal(line.kind, "line");
    assert.equal(line.kind === "line" && line.text, "باز هم گوشی؟!");
    assert.equal(line.kind === "line" && line.acts[0].face, "angry");
    const actions = beats.flatMap(b => b.kind === "action" ? b.acts : []);
    const enter = actions.find(a => a.move === "enter");
    const approach = actions.find(a => a.move === "approach");
    assert.deepEqual([enter?.who, enter?.move], ["پسر", "enter"]);
    assert.deepEqual([approach?.who, approach?.target], ["پسر", "علی"]);
    const car = plan.scenes[1].beats;
    assert.equal(car[1].kind, "narration");
    assert.equal(car[2].kind === "line" && car[2].speaker, "سارا");
    assert.equal(car[3].kind === "action" && car[3].acts[0].move, "exit");
    assert.equal(cleanSpeaker("ناگهان علی گفت"), "علی");
  });

  it("UT-SP-05 attributes: old, child, side", () => {
    assert.equal(parseAttrs("زن، پیر").kind, "oldWoman");
    assert.equal(parseAttrs("بچه، دختر").kind, "girl");
    assert.equal(parseAttrs("مرد، سمت چپ، سبیلو").side, "left");
    assert.equal(parseAttrs("مرد، سمت چپ، سبیلو").look.mustache, true);
  });

  it("UT-SP-06 unknown gender is reported, not silently guessed", () => {
    const p = parseStory("زیگی: سلام");
    assert.equal(parseStory("کوروش‌خان: سلام").cast[0].look.kind, "man");
    assert.ok(p.warnings.some((w) => w.includes("جنسیت")));
  });
});

describe("auto director", () => {
  const d = directStory(parseStory(STORY));

  it("UT-SD-01 dialogue timing follows reading speed and cues are ordered", () => {
    assert.ok(lineDuration("سلام") >= 1.4);
    assert.ok(lineDuration("یک دو سه چهار پنج شش هفت هشت نه ده یازده دوازده") > lineDuration("یک دو سه"));
    assert.equal(d.cues.length, 3);
    for (let i = 1; i < d.cues.length; i++) assert.ok(d.cues[i].from >= d.cues[i - 1].to - 1e-9);
    const srt = cuesToSrt(d.cues);
    assert.match(srt, /^1\n00:00:\d\d,\d{3} --> 00:00:\d\d,\d{3}\nسارا \(عصبانی\): باز هم گوشی؟!/);
  });

  it("UT-SD-02 left/right placement and seating", () => {
    const s0 = d.timeline.scenes[0];
    const x = (id: string) => actorAt(s0.actors.find((a) => a.cast === id)!.track, 0.2, null).x;
    assert.ok(x("سارا") < x("علی"), "Sara (left) must be left of Ali (right)");
    const ali = actorAt(s0.actors.find((a) => a.cast === "علی")!.track, 0.2, null);
    assert.ok(ali.state.pose.thigh < 0.7, "Ali starts seated");
  });

  it("UT-SD-03 the boy enters from off-screen and walks in", () => {
    const s0 = d.timeline.scenes[0];
    const boy = s0.actors.find((a) => a.cast === "پسر")!.track;
    const start = actorAt(boy, 0, null).x;
    assert.ok(start < 0 || start > 1);
    const enterKey = boy.keys.find((k) => k.x > 0 && k.x < 1)!;
    const mid = actorAt(boy, enterKey.t + 0.3, null);
    assert.equal(mid.walking, true);
    const end = actorAt(boy, s0.end - s0.start - 0.1, null);
    assert.ok(end.x > 0 && end.x < 1);
  });

  it("UT-SD-04 exit walks off-screen; car forces sitting; scenes are contiguous", () => {
    const [a, b] = d.timeline.scenes;
    assert.equal(a.end, b.start);
    assert.equal(b.end, d.timeline.duration);
    const ali = b.actors.find((x) => x.cast === "علی")!.track;
    assert.ok(actorAt(ali, 0.3, null).state.pose.thigh < 0.7);
    const last = actorAt(ali, b.end - b.start, null).x;
    assert.ok(last < 0 || last > 1);
  });

  it("UT-SD-05 even spread for standing people", () => {
    assert.deepEqual(spread(1), [0.5]);
    assert.deepEqual(spread(2), [0.3, 0.7]);
    assert.equal(spread(6).length, 6);
  });
});
