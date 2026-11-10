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

describe("character skills cover every character AI call site", () => {
  it("skills/char-* frontmatter lists only known task ids and covers all of them", async () => {
    const { readFileSync } = await import("node:fs");
    const covered = new Set<string>();
    for (const id of ["char-design", "char-rig-acting"]) {
      const text = readFileSync(new URL(`../../skills/${id}/SKILL.md`, import.meta.url), "utf8");
      const fm = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? "";
      assert.match(fm, new RegExp(`^id: ${id}$`, "m"));
      assert.match(fm, /^owner: characters$/m);
      assert.match(fm, /^license: MIT$/m);
      assert.match(fm, /^source: https:\/\/github\.com\//m);
      const tasks = /^tasks: \[(.*)\]$/m.exec(fm)?.[1].split(",").map((t) => t.trim()) ?? [];
      for (const t of tasks) { assert.ok((Object.values(CHAR_TASKS) as string[]).includes(t), `${id}: unknown task ${t}`); covered.add(t); }
      assert.ok(text.split(/\s+/).length <= 1600, `${id} over the word cap`);
      assert.doesNotMatch(text, /gemini-2\.5|argon|veo/i);
    }
    for (const t of Object.values(CHAR_TASKS)) assert.ok(covered.has(t), `no skill for ${t}`);
  });
});
