import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { autoLayout } from "./auto-layout.ts";
import { IDS } from "./catalog.ts";
import { buildMessages, extractJson, planFromModelReply } from "./script-llm.ts";

const GOOD = JSON.stringify({
  shots: [
    {
      scene: 0,
      heading: "داخلی. کافه — شب",
      background: "cafe",
      actionLine: "پرویز وارد می‌شود.",
      speaker: "parviz",
      dialogue: "سلام!",
      characters: [
        { id: "parviz", emotion: "smile", action: "walk" },
        { id: "pooneh", emotion: "poker", action: "idle" },
      ],
      sfx: "door",
    },
    {
      scene: 0,
      background: "cafe",
      speaker: "pooneh",
      dialogue: "دیر کردی.",
      characters: [{ id: "pooneh", emotion: "angry", action: "hips" }],
      sfx: "none",
    },
  ],
});

describe("model prompt", () => {
  it("UT-LLM-01 lists every catalog id", () => {
    const [system, user] = buildMessages("متن");
    for (const id of [...IDS.characters, ...IDS.backgrounds, ...IDS.emotions, ...IDS.actions]) {
      assert.ok(system.content.includes(`- ${id}:`), id);
    }
    assert.equal(user.content, "متن");
  });
  it("UT-LLM-02 extracts JSON wrapped in code fences", () => {
    assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
    assert.throws(() => extractJson("no json here"));
  });
});

describe("model reply validation", () => {
  it("UT-LLM-03 a valid reply becomes a plan; scene cast is merged", () => {
    const r = planFromModelReply(GOOD);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.plan.shots.length, 2);
    assert.deepEqual(r.plan.shots[1].cast, ["pooneh", "parviz"]);
    assert.equal(r.plan.shots[0].emotion.parviz, "smile");
    assert.equal(r.plan.warnings.length, 0);
  });
  it("UT-LLM-04 ids outside the catalog are dropped with warnings", () => {
    const r = planFromModelReply(
      JSON.stringify({
        shots: [
          {
            scene: 0,
            background: "moon",
            speaker: "batman",
            dialogue: "x",
            actionLine: "شب است.",
            characters: [{ id: "sara", emotion: "dancing", action: "fly" }],
            sfx: "explosion",
          },
        ],
      }),
    );
    assert.ok(r.ok);
    if (!r.ok) return;
    const s = r.plan.shots[0];
    assert.equal(s.background, "living");
    assert.equal(s.speaker, null);
    assert.equal(s.dialogue, "");
    assert.equal(s.sfx, "none");
    assert.deepEqual(s.emotion, {});
    for (const bad of ["moon", "batman", "dancing", "fly", "explosion"]) {
      assert.ok(r.plan.warnings.some((w) => w.includes(bad)), bad);
    }
  });
  it("UT-LLM-05 garbage or empty replies are errors", () => {
    assert.equal(planFromModelReply("I cannot help").ok, false);
    assert.equal(planFromModelReply('{"shots":[]}').ok, false);
  });
});

describe("method selection", () => {
  const script = "[کافه]\nپرویز: سلام\nپونه: سلام";

  it("UT-LLM-06 auto uses the model when it answers", async () => {
    const r = await autoLayout(script, "auto", async () => {
      const p = planFromModelReply(GOOD);
      if (!p.ok) throw new Error(p.error);
      return { ok: true, plan: p.plan, model: "test-model" };
    });
    assert.equal(r.used, "model");
    assert.equal(r.model, "test-model");
    assert.equal(r.shots[0].actorA.emotion, "smile");
  });
  it("UT-LLM-07 auto falls back to the dictionary on model error or exception", async () => {
    const failed = await autoLayout(script, "auto", async () => ({ ok: false, error: "خطای 500" }));
    assert.equal(failed.used, "dictionary");
    assert.equal(failed.shots.length, 2);
    assert.match(failed.warnings[0], /خطای 500/);
    const thrown = await autoLayout(script, "auto", async () => {
      throw new Error("network");
    });
    assert.equal(thrown.used, "dictionary");
  });
  it("UT-LLM-08 dictionary method never calls the model", async () => {
    let called = false;
    const r = await autoLayout(script, "dictionary", async () => {
      called = true;
      return { ok: false, error: "x" };
    });
    assert.equal(called, false);
    assert.equal(r.used, "dictionary");
  });
});
