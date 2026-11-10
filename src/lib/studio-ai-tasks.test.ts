import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CHAR_TASKS, systemPart } from "./studio-ai-tasks.ts";

describe("character AI call sites: optional systemInstruction", () => {
  it("adds nothing when there is no skill text (request body unchanged)", () => {
    const body = { contents: [1] };
    assert.equal(JSON.stringify({ ...systemPart(undefined), ...body }), JSON.stringify(body));
    assert.equal(JSON.stringify({ ...systemPart("   "), ...body }), JSON.stringify(body));
  });
  it("adds a Vertex systemInstruction part when given", () => {
    assert.deepEqual(systemPart(" rules "), { systemInstruction: { parts: [{ text: "rules" }] } });
  });
  it("task ids are unique and namespaced", () => {
    const ids = Object.values(CHAR_TASKS);
    assert.equal(new Set(ids).size, ids.length);
    for (const id of ids) assert.match(id, /^(char|rig)\.[a-z]+$/);
  });
});
