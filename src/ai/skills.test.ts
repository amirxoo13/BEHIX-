import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CHAR_TASKS } from "../lib/studio-ai-tasks.ts";
import { WORLD_TASK_IDS } from "../studio/world/ai-tasks.ts";
import { loadSkills, MAX_SKILL_WORDS, parseFrontmatter, parseSkill, SKILL_OWNERS, SKILL_TASKS, SkillError, skillsFor, withSkills } from "./skills.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const SKILLS_DIR = join(ROOT, "skills");

function repoSkillFiles(): Record<string, string> {
  if (!existsSync(SKILLS_DIR)) return {};
  const out: Record<string, string> = {};
  for (const dir of readdirSync(SKILLS_DIR)) {
    const file = join(SKILLS_DIR, dir, "SKILL.md");
    if (existsSync(file)) out[`/skills/${dir}/SKILL.md`] = readFileSync(file, "utf8");
  }
  return out;
}

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== "node_modules") sourceFiles(p, out); }
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p);
  }
  return out;
}

const skill = (front: string, body = "Rules.") => `---\n${front}\n---\n${body}\n`;
const BASE = "id: demo-skill\nname: Demo\nversion: 1\nowner: story\ntasks: [film-plan.outline, film-plan.shots]";

describe("skills loader", () => {
  it("UT-SK-01 frontmatter: scalars, [lists], quotes and comments", () => {
    const { data, body } = parseFrontmatter(skill(`${BASE}   # trailing comment\nsource: "https://github.com/a/b/blob/main/SKILL.md"\nlicense: MIT`, "Body"));
    assert.deepEqual(data.tasks, ["film-plan.outline", "film-plan.shots"]);
    assert.equal(data.source, "https://github.com/a/b/blob/main/SKILL.md");
    assert.equal(body, "Body");
    assert.throws(() => parseFrontmatter("no frontmatter"), SkillError);
  });
  it("UT-SK-02 parseSkill types source and license; source requires an accepted license", () => {
    const s = parseSkill(skill(`${BASE}\nsource: https://github.com/a/b\nlicense: Apache-2.0`), "/skills/demo-skill/SKILL.md");
    assert.deepEqual(s.source, ["https://github.com/a/b"]);
    assert.deepEqual(s.license, ["Apache-2.0"]);
    const multi = parseSkill(skill(`${BASE}\nsource: [https://github.com/a/b, https://github.com/c/d]\nlicense: [MIT, Apache-2.0]`), "x");
    assert.deepEqual(multi.source, ["https://github.com/a/b", "https://github.com/c/d"]);
    assert.deepEqual(multi.license, ["MIT", "Apache-2.0"]);
    assert.throws(() => parseSkill(skill(`${BASE}\nsource: [https://github.com/a/b, http://x]\nlicense: MIT`), "x"), /https/);
    assert.equal(s.version, 1);
    const original = parseSkill(skill(BASE), "/skills/demo-skill/SKILL.md");
    assert.equal(original.source, undefined);
    assert.equal(original.license, undefined);
    assert.throws(() => parseSkill(skill(`${BASE}\nsource: https://github.com/a/b`), "x"), /needs a license/);
    assert.throws(() => parseSkill(skill(`${BASE}\nsource: https://github.com/a/b\nlicense: GPL-3.0`), "x"), /license/);
    assert.throws(() => parseSkill(skill(`${BASE}\nsource: ftp://x`), "x"), /https/);
  });
  it("UT-SK-03 rejects unknown owner, bad version, folder mismatch, oversize and forbidden models", () => {
    assert.throws(() => parseSkill(skill(BASE.replace("owner: story", "owner: marketing")), "x"), /owner/);
    assert.throws(() => parseSkill(skill(BASE.replace("version: 1", "version: one")), "x"), /version/);
    assert.throws(() => parseSkill(skill(BASE), "/skills/other/SKILL.md"), /folder/);
    assert.throws(() => parseSkill(skill(BASE, "w ".repeat(MAX_SKILL_WORDS + 1)), "x"), /cap/);
    assert.throws(() => parseSkill(skill(BASE, "Use gemini-4-argon."), "x"), /forbidden/);
    assert.throws(() => loadSkills({ "/a/SKILL.md": skill(BASE), "/b/SKILL.md": skill(BASE) }), /duplicate/);
  });
  it("UT-SK-04 skillsFor / withSkills prepend matching bodies deterministically", () => {
    const skills = loadSkills({
      "/skills/zeta/SKILL.md": skill(BASE.replace("demo-skill", "zeta").replace("Demo", "Zeta"), "Z rules"),
      "/skills/alpha/SKILL.md": skill(BASE.replace("demo-skill", "alpha").replace("Demo", "Alpha").replace(", film-plan.shots", ""), "A rules"),
    });
    assert.equal(skillsFor("film-plan.outline", skills), "## Skill: Alpha (alpha v1)\n\nA rules\n\n## Skill: Zeta (zeta v1)\n\nZ rules");
    assert.equal(skillsFor("film-plan.shots", skills), "## Skill: Zeta (zeta v1)\n\nZ rules");
    assert.equal(withSkills("rig.joints", "SYS", skills), "SYS");
    assert.ok(withSkills("film-plan.shots", "SYS", skills).endsWith("\n\n---\n\nSYS"));
    assert.equal(skillsFor("film-plan.outline"), skillsFor("film-plan.outline", loadSkills({})), "plain Node has no bundled skills");
  });
});

describe("repo skills (/skills/*/SKILL.md)", () => {
  const files = repoSkillFiles();
  const skills = loadSkills(files); // throws on any parse error, duplicate id, unknown owner or oversize body
  it("UT-SK-05 every SKILL.md parses with a unique id, known owner, known tasks and size cap", () => {
    for (const s of skills) {
      assert.ok(SKILL_OWNERS.includes(s.owner));
      assert.ok(s.words <= MAX_SKILL_WORDS);
      for (const t of s.tasks) assert.ok(t in SKILL_TASKS, `${s.id}: unknown task ${t}`);
    }
  });
  it("UT-SK-06 every task id used by an AI call site is registered in SKILL_TASKS", () => {
    const used = new Set<string>();
    for (const f of sourceFiles(join(ROOT, "src"))) {
      for (const m of readFileSync(f, "utf8").matchAll(/(?:withSkills|skillsFor|skillSystem)\(\s*"([^"]+)"/g)) used.add(m[1]);
    }
    for (const t of Object.values(CHAR_TASKS)) used.add(t); // character call sites pass CHAR_TASKS.* through (ai.system ?? skillSystem)
    for (const t of WORLD_TASK_IDS) used.add(t);
    for (const t of used) assert.ok(t in SKILL_TASKS, `unregistered task ${t}`);
  });
  it("UT-SK-08 story skills load with attribution and feed both film-plan stages", () => {
    const byId = new Map(skills.map((s) => [s.id, s]));
    for (const id of ["story-screenwriting", "story-shot-grammar"]) {
      const s = byId.get(id);
      assert.ok(s, `${id} missing`);
      assert.equal(s!.owner, "story");
      assert.ok(s!.source?.length && s!.source.every((u) => u.startsWith("https://github.com/")));
      assert.deepEqual(s!.license, ["MIT"]);
      assert.ok(!/veo|seedance|kling/i.test(s!.body), `${id} mentions AI video`);
    }
    assert.ok(skillsFor("film-plan.outline", skills).includes("story-screenwriting v1"));
    const shots = skillsFor("film-plan.shots", skills);
    assert.ok(shots.includes("story-screenwriting v1") && shots.includes("story-shot-grammar v1"));
    assert.ok(existsSync(join(SKILLS_DIR, "THIRD_PARTY_NOTICES.md")));
  });
  for (const [task, owner] of Object.entries(SKILL_TASKS)) {
    const has = skills.some((s) => s.tasks.includes(task));
    // Skills are being adapted from GitHub sources (spec UPDATE); until the owner bot adds one this is a visible TODO.
    it(`UT-SK-07 task ${task} has at least one skill`, has ? {} : { todo: `no skill yet (owner: ${owner})` }, () => {
      assert.ok(has);
    });
  }
});
