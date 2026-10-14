import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { autoLayout, clearModelCache, type ModelCall } from "./auto-layout.ts";
import { IDS } from "./catalog.ts";
import { buildMessages, extractJson, maxOutputTokens, planFromModelReply } from "./script-llm.ts";

const SCRIPT = `[داخلی. قهوه‌خانه — شب]
پرویز وارد می‌شود، استکان در دست. پهلوان اژدر با تعجب نگاهش می‌کند.
پرویز: سلام پهلوان! (خندان، اشاره)
پهلوان: دیر کردی. (اخم، دست به کمر)

[خارجی. خیابان — شب]
سارا: کجا می‌روی؟ (گریه)
کیان: من هم میام!`;

// پاسخ واقعی qwen3.8-flash (Alibaba Model Studio، 2026-10-14) به همین SCRIPT با پرامپت فشرده؛
// مصرف واقعی: ۴۶۱ توکن ورودی + ۸۸ توکن خروجی.
const REAL_QWEN_REPLY =
  '{"s":[[2,"cafe","","parviz:smile:tea,pahlavan:shock",""],[3,"cafe","parviz","parviz:laugh:point",""],[4,"cafe","pahlavan","pahlavan:angry:hips",""],[7,"streetNight","sara","sara:cry",""],[8,"streetNight","kian","",""]]}';

describe("compact prompt", () => {
  it("UT-LLM-01 lists every catalog id and numbers the script lines", () => {
    const [system, user] = buildMessages(SCRIPT);
    for (const id of [...IDS.characters, ...IDS.backgrounds, ...IDS.emotions, ...IDS.actions]) {
      assert.ok(system.content.includes(id), id);
    }
    assert.match(user.content, /^1\|\[داخلی/);
    assert.match(user.content, /\n8\|کیان: من هم میام!$/);
    assert.ok(!user.content.includes("5|"), "empty lines are not sent");
  });
  it("UT-LLM-02 system prompt stays small and output is capped by line count", () => {
    assert.ok(buildMessages("").at(0)!.content.length < 1400);
    assert.equal(maxOutputTokens(SCRIPT), 60 + 40 * 7);
    assert.equal(maxOutputTokens("x\n".repeat(500)), 3000);
  });
  it("UT-LLM-03 extracts JSON wrapped in code fences", () => {
    assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
    assert.throws(() => extractJson("no json here"));
  });
});

describe("compact reply → plan", () => {
  it("UT-LLM-04 real Qwen reply: text comes from the script, description merges into next shot", () => {
    const r = planFromModelReply(REAL_QWEN_REPLY, SCRIPT);
    assert.ok(r.ok);
    if (!r.ok) return;
    const s = r.plan.shots;
    assert.equal(r.plan.warnings.length, 0);
    assert.equal(s.length, 4);
    assert.equal(s[0].speaker, "parviz");
    assert.equal(s[0].dialogue, "سلام پهلوان!");
    assert.match(s[0].actionLine, /^پرویز وارد می‌شود/);
    assert.equal(s[0].emotion.parviz, "laugh", "the spoken line's own emotion wins");
    assert.equal(s[0].action.parviz, "point");
    assert.equal(s[0].emotion.pahlavan, "shock", "description emotions are kept");
    assert.equal(s[0].heading, "داخلی. قهوه‌خانه — شب");
    assert.deepEqual(s.map((x) => x.scene), [0, 0, 1, 1]);
    assert.equal(s[2].background, "streetNight");
    assert.equal(s[3].dialogue, "من هم میام!");
  });
  it("UT-LLM-05 ids outside the catalog and bad line numbers are dropped", () => {
    const r = planFromModelReply(
      '{"s":[[3,"moon","batman","sara:dancing:fly,joker",""],[99,"cafe","parviz","",""],[1,"cafe","parviz","",""],[4,"cafe","pahlavan","","explosion"]]}',
      SCRIPT,
    );
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.plan.shots.length, 2, "line 99 does not exist and line 1 is a header");
    const [a, b] = r.plan.shots;
    assert.equal(a.background, "living");
    assert.equal(a.speaker, null);
    assert.deepEqual(a.emotion, {});
    assert.equal(b.sfx, "none");
    for (const bad of ["moon", "batman", "dancing", "fly", "joker", "explosion"]) {
      assert.ok(r.plan.warnings.some((w) => w.includes(bad)), bad);
    }
  });
  it("UT-LLM-06 garbage or empty replies are errors", () => {
    assert.equal(planFromModelReply("I cannot help", SCRIPT).ok, false);
    assert.equal(planFromModelReply('{"s":[]}', SCRIPT).ok, false);
  });
});

describe("method selection saves tokens", () => {
  beforeEach(() => clearModelCache());
  const realModel: ModelCall = async (script) => {
    const p = planFromModelReply(REAL_QWEN_REPLY, script);
    if (!p.ok) throw new Error(p.error);
    return { ok: true, plan: p.plan, model: "qwen3.8-flash", usage: { input: 461, output: 88 } };
  };
  const counting = () => {
    let calls = 0;
    const fn: ModelCall = async (s) => {
      calls++;
      return realModel(s);
    };
    return { fn, calls: () => calls };
  };

  it("UT-LLM-07 smart: a fully understood script never calls the model", async () => {
    const m = counting();
    const r = await autoLayout(SCRIPT, "smart", m.fn);
    assert.equal(m.calls(), 0);
    assert.equal(r.used, "dictionary");
    assert.deepEqual(r.usage, { input: 0, output: 0 });
  });
  it("UT-LLM-08 smart: an unknown direction sends the script to the model once, then cache", async () => {
    const odd = SCRIPT.replace("(گریه)", "(دلخور و بی‌قرار)");
    const m = counting();
    const first = await autoLayout(odd, "smart", m.fn);
    assert.equal(first.used, "model");
    assert.deepEqual(first.usage, { input: 461, output: 88 });
    const again = await autoLayout(odd, "smart", m.fn);
    assert.equal(m.calls(), 1, "same text is not paid for twice");
    assert.deepEqual(again.usage, { input: 0, output: 0 });
  });
  it("UT-LLM-09 model method always asks; failures fall back to the dictionary", async () => {
    const m = counting();
    assert.equal((await autoLayout(SCRIPT, "model", m.fn)).used, "model");
    assert.equal(m.calls(), 1);
    clearModelCache();
    const failed = await autoLayout(SCRIPT, "model", async () => ({ ok: false, error: "خطای 500" }));
    assert.equal(failed.used, "dictionary");
    assert.match(failed.warnings[0], /خطای 500/);
    const thrown = await autoLayout(SCRIPT, "model", async () => {
      throw new Error("network");
    });
    assert.equal(thrown.used, "dictionary");
  });
  it("UT-LLM-10 dictionary method never calls the model", async () => {
    const m = counting();
    await autoLayout(SCRIPT, "dictionary", m.fn);
    assert.equal(m.calls(), 0);
  });
});
