import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WORLD_TASK_IDS } from "./ai-tasks.ts";

/** Minimal frontmatter reader (the real loader, src/ai/skills.ts, is owned by the story branch). */
function frontmatter(path: string) {
  const text = readFileSync(new URL(path, import.meta.url), "utf8");
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  assert.ok(m, `${path}: frontmatter`);
  const fields: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = /^([a-z]+):\s*(.*)$/.exec(line);
    if (kv) fields[kv[1]] = kv[2];
  }
  return { fields, tasks: list(fields.tasks ?? ""), sources: list(fields.source ?? ""), body: m[2] };
}
const list = (v: string) => v.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim()).filter(Boolean);
const SKILLS = { "world-set-design": "../../../skills/world-set-design/SKILL.md", "world-camera": "../../../skills/world-camera/SKILL.md" };

describe("world in-app skills", () => {
  it("frontmatter follows BEHIX-SKILLS-SPEC (id, name, version, owner, tasks, source, license)", () => {
    for (const [id, path] of Object.entries(SKILLS)) {
      const f = frontmatter(path);
      assert.equal(f.fields.id, id);
      assert.ok(f.fields.name);
      assert.equal(f.fields.version, "1");
      assert.equal(f.fields.owner, "world");
      assert.ok(f.tasks.length > 0, id);
      assert.ok(f.sources.length > 0 && f.sources.every((s) => s.startsWith("https://github.com/")), id);
      const licenses = list(f.fields.license ?? "");
      assert.ok(licenses.length > 0 && licenses.every((l) => l === "MIT" || l === "Apache-2.0"), id);
    }
  });
  it("task ids match the world call-site ids and every call site has a skill", () => {
    const used = new Set<string>();
    for (const path of Object.values(SKILLS)) for (const t of frontmatter(path).tasks) {
      assert.ok((WORLD_TASK_IDS as string[]).includes(t), `unknown task ${t}`);
      used.add(t);
    }
    for (const t of WORLD_TASK_IDS) assert.ok(used.has(t), `no skill for ${t}`);
  });
  it("bodies stay under the token budget and never mention banned models or AI video", () => {
    for (const path of Object.values(SKILLS)) {
      const { body } = frontmatter(path);
      assert.ok(body.split(/\s+/).filter(Boolean).length <= 1500, path);
      assert.doesNotMatch(body, /gemini-2\.5|argon|imagen|veo|seedance|kling/i, path);
      assert.match(body, /[\u0600-\u06FF]/, "has a Persian example");
    }
  });
});
