import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findAll, findFirst, BACKGROUNDS, EMOTION_ENTRIES, SFX_ENTRIES, normalizeFa } from "./catalog.ts";
import { isHeader, sceneTraits } from "./script-plan.ts";
import { parseProject } from "./persist.ts";
import { durationFor, layoutPlan, planFromDictionary } from "./script-plan.ts";

const SCRIPT = `[داخلی. قهوه‌خانه — شب]
پرویز وارد می‌شود، استکان در دست. پهلوان اژدر با تعجب نگاهش می‌کند.
پرویز: سلام پهلوان! (خندان، اشاره)
پهلوان: دیر کردی. (اخم، دست به کمر)
صدای در.
رضا راننده: ماشین دم در است.

[خارجی. خیابان — شب]
سارا: کجا می‌روی؟ (گریه)
کیان: من هم میام!`;

describe("catalog matching", () => {
  it("UT-AL-01 normalizes Arabic letters and half-spaces", () => {
    assert.equal(normalizeFa("قهوه‌خانه يك"), "قهوه خانه یک");
  });
  it("UT-AL-02 longest alias wins and short labels are not matched alone", () => {
    assert.equal(findFirst("بوق سانسور می‌خورد", SFX_ENTRIES), "beep");
    assert.equal(findFirst("استکان در دست دارد", SFX_ENTRIES), undefined);
    assert.equal(findFirst("داخل ماشین نشسته‌اند", BACKGROUNDS), "car");
  });
  it("UT-AL-03 stems match verb forms only at word start", () => {
    assert.equal(findFirst("می‌خندد", EMOTION_ENTRIES), "laugh");
    assert.equal(findFirst("خندید", EMOTION_ENTRIES), "laugh");
    assert.equal(findFirst("لبخند زد", EMOTION_ENTRIES), "smile");
    assert.deepEqual(findAll("چایخانه", EMOTION_ENTRIES), []);
  });
});

describe("dictionary understanding", () => {
  const plan = planFromDictionary(SCRIPT);

  it("UT-AL-04 one shot per dialogue line, scenes and places", () => {
    assert.equal(plan.shots.length, 5);
    assert.deepEqual(plan.shots.map((s) => s.scene), [0, 0, 0, 1, 1]);
    assert.equal(plan.shots[0].background, "cafe");
    assert.equal(plan.shots[3].background, "street");
    assert.equal(plan.shots[3].night, true);
  });
  it("UT-AL-05 speakers, directions and descriptions", () => {
    const [a, b, c, d] = plan.shots;
    assert.equal(a.speaker, "parviz");
    assert.equal(a.dialogue, "سلام پهلوان!");
    assert.equal(a.emotion.parviz, "laugh");
    assert.equal(a.action.parviz, "point");
    assert.equal(a.emotion.pahlavan, "shock");
    assert.match(a.actionLine, /وارد می‌شود/);
    assert.equal(b.speaker, "pahlavan");
    assert.equal(b.emotion.pahlavan, "angry");
    assert.equal(b.action.pahlavan, "hips");
    assert.equal(c.speaker, "reza");
    assert.equal(c.sfx, "door");
    assert.equal(d.emotion.sara, "cry");
    assert.deepEqual(plan.shots[0].cast, ["parviz", "pahlavan", "reza"]);
  });
  it("UT-AL-06 unknown speaker becomes description with a warning", () => {
    const p = planFromDictionary("ناشناس: سلام");
    assert.equal(p.shots.length, 1);
    assert.equal(p.shots[0].speaker, null);
    assert.ok(p.warnings.some((w) => w.includes("ناشناس")));
  });
  it("UT-AL-07 no place anywhere → living with a warning", () => {
    const p = planFromDictionary("پرویز: سلام");
    assert.equal(p.shots[0].background, "living");
    assert.ok(p.warnings.some((w) => w.includes("مکان")));
  });
});

describe("layout engine", () => {
  const { shots, warnings } = layoutPlan(planFromDictionary(SCRIPT));

  it("UT-AL-08 every generated shot passes the project validator unchanged", () => {
    const parsed = parseProject({ shots });
    assert.ok(parsed.ok);
    if (parsed.ok) {
      assert.equal(parsed.dropped, 0);
      assert.deepEqual(parsed.data.shots, shots);
    }
  });
  it("UT-AL-09 speaker side, cameras and emotion carry-over", () => {
    assert.equal(shots[0].camera, "wide");
    assert.equal(shots[0].speaker, "a");
    assert.equal(shots[0].actorA.charId, "parviz");
    assert.equal(shots[0].actorB.charId, "pahlavan");
    assert.equal(shots[1].speaker, "b");
    assert.equal(shots[1].camera, "closeRight");
    assert.equal(shots[1].actorA.emotion, "laugh");
    // رضا جای پرویز می‌آید چون آخرین گوینده (پهلوان) در قاب می‌ماند
    assert.equal(shots[2].actorA.charId, "reza");
    assert.equal(shots[2].actorB.charId, "pahlavan");
    assert.equal(shots[2].speaker, "a");
    assert.equal(shots[3].camera, "wide");
    assert.equal(warnings.length, 0);
  });
  it("UT-AL-10 single-character scene gets a second actor and a warning", () => {
    const r = layoutPlan(planFromDictionary("[پارک]\nسارا: چه هوای خوبی."));
    assert.equal(r.shots[0].actorA.charId, "sara");
    assert.notEqual(r.shots[0].actorB.charId, "sara");
    assert.ok(r.warnings.some((w) => w.includes("فقط یک شخصیت")));
  });
  it("UT-AL-11 duration grows with dialogue and is clamped", () => {
    assert.equal(durationFor({ speaker: null, dialogue: "" }), 3.5);
    assert.equal(durationFor({ speaker: "a", dialogue: "سلام" }), 2.5);
    assert.equal(durationFor({ speaker: "a", dialogue: "کلمه ".repeat(100) }), 12);
  });
});

describe("scene headings without brackets", () => {
  it("UT-BG-02 a short place line is a heading; a sentence with a character is not", () => {
    assert.equal(isHeader("آشپزخانه، شب"), "آشپزخانه، شب");
    assert.equal(isHeader("اتاق خواب — صبح"), "اتاق خواب — صبح");
    assert.equal(isHeader("داخلی. حمام"), "داخلی. حمام");
    assert.equal(isHeader("سارا وارد آشپزخانه می‌شود."), null);
    assert.equal(isHeader("پرویز: برویم پارک"), null);
  });
  it("UT-BG-03 every new place is recognised", () => {
    const cases: [string, string][] = [
      ["پذیرایی", "living"],
      ["آشپزخانه", "kitchen"],
      ["اتاق خواب", "bedroom"],
      ["حمام", "bathroom"],
      ["دستشویی", "toilet"],
      ["پارکینگ", "parking"],
      ["خیابان", "street"],
      ["پارک", "park"],
      ["قهوه‌خانه", "cafe"],
      ["کافه", "coffee"],
      ["بازار تهران", "bazaar"],
      ["برج میلاد", "milad"],
      ["میدان آزادی", "azadi"],
      ["سعادت‌آباد", "saadatabad"],
      ["خیابان فرشته", "fereshteh"],
    ];
    for (const [text, id] of cases) assert.equal(sceneTraits(text).background, id, text);
  });
  it("UT-BG-04 Tehran places win over generic words in the same heading", () => {
    assert.equal(sceneTraits("خیابان، سعادت‌آباد").background, "saadatabad");
    assert.equal(sceneTraits("کافه‌ای در فرشته").background, "fereshteh");
  });
  it("UT-BG-05 night and design number come from the heading", () => {
    assert.deepEqual(sceneTraits("آشپزخانه ۲، شب"), { background: "kitchen", night: true, variant: 1 });
    assert.deepEqual(sceneTraits("حمام، صبح"), { background: "bathroom", night: false, variant: undefined });
    assert.equal(sceneTraits("سکانس ۳. پارک").variant, undefined, "a sequence number is not a design number");
  });
  it("UT-BG-06 a place keeps its design across scenes unless the heading changes it", () => {
    const { shots } = layoutPlan(
      planFromDictionary(
        "آشپزخانه ۳، شب\nسارا: سلام\nپارک\nکیان: بیا\nآشپزخانه، صبح\nسارا: باز هم سلام\nآشپزخانه ۱\nکیان: خداحافظ",
      ),
    );
    assert.deepEqual(
      shots.map((s) => [s.background, s.variant, s.night]),
      [
        ["kitchen", 2, true],
        ["park", 0, false],
        ["kitchen", 2, false],
        ["kitchen", 0, false],
      ],
    );
  });
});

describe("more than two people", () => {
  it("UT-EX-02 everyone present stays in frame: the pair talks, the rest stand behind", () => {
    const { shots } = layoutPlan(planFromDictionary(SCRIPT));
    assert.deepEqual(shots[0].extras.map((e) => e.charId), ["reza"]);
    // وقتی رضا حرف می‌زند جای پرویز جلو می‌آید و پرویز عقب می‌رود، ولی از صحنه بیرون نمی‌رود.
    assert.equal(shots[2].actorA.charId, "reza");
    assert.deepEqual(shots[2].extras.map((e) => e.charId), ["parviz"]);
    assert.deepEqual(shots[3].extras, [], "scene 2 has only Sara and Kian");
  });
  it("UT-EX-03 more than five people → five in frame and a warning", () => {
    const r = layoutPlan(
      planFromDictionary("قهوه‌خانه\nپرویز، پونه، پهلوان، خاله بتول، رضا و سارا نشسته‌اند.\nپرویز: سلام"),
    );
    const s = r.shots.at(-1)!;
    assert.equal(2 + s.extras.length, 5);
    assert.ok(r.warnings.some((w) => w.includes("حداکثر ۵") || w.includes("حداکثر 5")));
  });
});
