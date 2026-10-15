import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IDS } from "./catalog.ts";
import { CAST, findChar, setCustomCast } from "./characters.ts";
import { layoutPlan, planFromDictionary } from "./script-plan.ts";
import { buildMessages, planFromModelReply } from "./script-llm.ts";
import type { CharacterDef } from "./types.ts";

const javad: CharacterDef = { ...CAST[0], id: "u-javad01", name: "عمو جواد", build: "heavy" };

describe("custom characters in the scenario", () => {
  it("UT-CC-03 a custom character's name is understood by the dictionary and placed in shots", () => {
    setCustomCast([javad]);
    try {
      assert.ok(IDS.characters.includes("u-javad01"));
      assert.equal(findChar("u-javad01").name, "عمو جواد");
      const { shots } = layoutPlan(planFromDictionary("پارک\nجواد: سلام سارا!\nسارا: سلام عمو جواد."));
      assert.equal(shots[0].actorA.charId, "u-javad01");
      assert.equal(shots[1].actorB.charId, "sara");
    } finally {
      setCustomCast([]);
    }
    assert.ok(!IDS.characters.includes("u-javad01"), "removing the character removes it from the catalog");
  });
  it("UT-CC-04 the model path accepts custom ids only when the browser sends them", () => {
    const extra = [{ id: "u-javad01", name: "عمو جواد" }];
    assert.match(buildMessages("x", extra)[0].content, /u-javad01=عمو جواد/);
    const reply = '{"s":[[2,"park","u-javad01","u-javad01:smile",""]]}';
    const ok = planFromModelReply(reply, "پارک\nجواد: سلام", extra);
    assert.ok(ok.ok && ok.plan.shots[0].speaker === "u-javad01");
    const without = planFromModelReply(reply, "پارک\nجواد: سلام");
    assert.ok(!without.ok || without.plan.shots[0].speaker === null);
  });
});
