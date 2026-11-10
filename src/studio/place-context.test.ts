import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BACKGROUNDS, PROP_ENTRIES, SENTENCE_BACKGROUNDS, findAll, findFirst } from "./catalog.ts";
import { backgroundOf, layoutPlan, planFromDictionary } from "./script-plan.ts";
import { parseStory } from "./stick/story-parse.ts";

const storyPlace = (text: string) => parseStory(text).scenes[0]?.place;
const ids = (text: string, entries: { id: string; label: string; aliases: string[]; unless?: RegExp }[] = BACKGROUNDS): string[] =>
  findAll(text, entries).map((m) => m.id);

describe("«پارک» the verb is not the park (catalog + story parser)", () => {
  for (const s of ["علی ماشین را پارک کرد.", "تاکسی پارک شده است.", "ماشین‌ها پارک شده‌اند.", "رضا ماشین را پارک می‌کند.", "اینجا پارک نکنید.", "پارک‌شده کنار خیابان"])
    it(`negative: ${s}`, () => {
      assert.ok(!ids(s).includes("park"), s);
      assert.notEqual(storyPlace(`${s}\nعلی: سلام`), "park", s);
    });
  for (const s of ["علی در پارک قدم می‌زند.", "به پارک رفتند.", "پارک، روز", "پارکی بزرگ", "پارک کنار خانه"])
    it(`positive: ${s}`, () => assert.ok(ids(s).includes("park"), s));
  it("story heading and sentence still find the park", () => {
    assert.equal(storyPlace("صحنه: پارک، روز\nعلی: سلام"), "park");
    assert.equal(storyPlace("علی در پارک قدم می‌زند.\nعلی: سلام"), "park");
  });
  it("«پارکینگ» stays parking", () => assert.deepEqual(ids("پارکینگ"), ["parking"]));
});

describe("bare vehicle words do not force the car interior inside sentences", () => {
  it("story: a parked taxi or a car as an object is not the car scene", () => {
    assert.notEqual(storyPlace("علی ماشین را پارک کرد.\nعلی: رسیدیم"), "car");
    assert.notEqual(storyPlace("تاکسی جلوی خانه پارک شده است.\nعلی: سلام"), "car");
    assert.equal(storyPlace("تاکسی جلوی خانه پارک شده است.\nعلی: سلام"), "living");
  });
  it("story: contextual forms and headings still mean the car", () => {
    assert.equal(storyPlace("صحنه: ماشین\nعلی: سلام"), "car");
    assert.equal(storyPlace("صحنه ۲: داخل ماشین، روز\nعلی: سلام"), "car");
    assert.equal(storyPlace("علی و سارا داخل ماشین نشسته‌اند.\nعلی: سلام"), "car");
    assert.equal(storyPlace("علی سوار تاکسی می‌شود.\nعلی: سلام"), "car");
  });
  it("legacy studio: description sentences use SENTENCE_BACKGROUNDS", () => {
    assert.equal(backgroundOf("رضا ماشین را پارک می‌کند.", true), undefined);
    assert.equal(backgroundOf("ماشین"), "car");
    assert.equal(backgroundOf("داخل ماشین نشسته‌اند", true), "car");
    assert.equal(findFirst("سوار تاکسی شدند", SENTENCE_BACKGROUNDS), "car");
    const r = layoutPlan(planFromDictionary("خیابان\nیک پیکان و یک تاکسی کنار درخت پارک شده‌اند.\nرضا: سلام"));
    assert.equal(r.shots[0].background, "street");
    assert.deepEqual(r.shots[0].props.map((p) => p.id), ["peykan", "taxi", "tree"]);
  });
});

describe("«سطل» alone is not a trash can", () => {
  it("negatives", () => {
    for (const s of ["سارا سطل آب را می‌آورد.", "یک سطل ماست", "سطل رنگ"]) assert.deepEqual(ids(s, PROP_ENTRIES).filter((x) => x === "trash"), [], s);
  });
  it("positives", () => {
    for (const s of ["کنار سطل زباله", "سطل آشغال پر است", "سطل‌زباله", "زباله‌دان کوچه"]) assert.ok(ids(s, PROP_ENTRIES).includes("trash"), s);
  });
});
