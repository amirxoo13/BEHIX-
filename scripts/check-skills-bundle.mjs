#!/usr/bin/env node
/**
 * After a build, assert that every skills/<id>/SKILL.md was inlined into the bundle.
 *   node scripts/check-skills-bundle.mjs dist-android .output
 * Each directory passes when one of its .js/.mjs files contains the skill's `id: <id>` frontmatter line
 * (that line survives as plain text inside the inlined ?raw string). Exits 1 on any miss.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/** Must match the pattern in src/ai/skills.ts. */
export const SKILLS_GLOB = "/skills/*/SKILL.md";

export function listSkillIds(repo) {
  const dir = join(repo, "skills");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((id) => existsSync(join(dir, id, "SKILL.md")));
}

function* jsFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* jsFiles(p);
    else if (/\.(m?js)$/.test(name)) yield p;
  }
}

export function missingSkills(distDir, ids) {
  const left = new Set(ids);
  for (const file of jsFiles(distDir)) {
    if (!left.size) break;
    const text = readFileSync(file, "utf8");
    for (const id of left) if (text.includes(`id: ${id}`)) left.delete(id);
  }
  return [...left];
}

if (process.argv[1]?.endsWith("check-skills-bundle.mjs")) {
  const repo = process.cwd();
  const ids = listSkillIds(repo);
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.error("usage: node scripts/check-skills-bundle.mjs <distDir>...");
    process.exit(2);
  }
  let failed = false;
  for (const d of dirs) {
    const dir = resolve(repo, d);
    if (!existsSync(dir)) {
      console.error(`✖ ${d}: not built`);
      failed = true;
      continue;
    }
    const missing = missingSkills(dir, ids);
    if (missing.length) failed = true;
    console.log(`${missing.length ? "✖" : "✔"} ${d}: ${ids.length - missing.length}/${ids.length} skills bundled${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
  }
  process.exit(failed ? 1 : 0);
}
