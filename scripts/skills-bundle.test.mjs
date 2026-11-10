/**
 * Build-time check that in-app AI skills (skills/<id>/SKILL.md, BEHIX-SKILLS-SPEC.md) reach both bundles.
 *
 * src/ai/skills.ts reads them with `import.meta.glob("/skills/*\/SKILL.md", { query: "?raw", eager: true })`.
 * A leading "/" in import.meta.glob is relative to the Vite root, and `?raw` inlines the file text into the
 * JavaScript chunk, so no publicDir or copy step is needed. These tests prove both halves:
 *  1. vite.config.ts (web) and vite.android.config.ts (dist-android -> Capacitor) both use the repo as root;
 *  2. a real Vite build of that exact glob inlines a placeholder SKILL.md (a fixture in a temp dir, never in
 *     skills/) and leaves out files the glob does not match.
 * scripts/check-skills-bundle.mjs checks the real build outputs for every real skill.
 */
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { build, loadConfigFromFile } from "vite";
import { SKILLS_GLOB } from "./check-skills-bundle.mjs";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const file of ["vite.config.ts", "vite.android.config.ts"]) {
  test(`${file} builds from the repo root, where skills/ lives`, async () => {
    const loaded = await loadConfigFromFile({ command: "build", mode: "production" }, join(repo, file), repo, "silent");
    assert.ok(loaded, `${file} did not load`);
    const config = typeof loaded.config === "function" ? await loaded.config({ command: "build", mode: "production" }) : loaded.config;
    assert.equal(resolve(repo, config.root ?? "."), repo);
  });
}

test("the skills glob inlines a placeholder skill file into the built chunk", async () => {
  const root = mkdtempSync(join(tmpdir(), "behix-skills-bundle-"));
  try {
    const marker = `placeholder-skill-${Date.now().toString(36)}`;
    mkdirSync(join(root, "skills", "zz-placeholder"), { recursive: true });
    writeFileSync(join(root, "skills", "zz-placeholder", "SKILL.md"), `---\nid: zz-placeholder\n---\n${marker} body\n`);
    writeFileSync(join(root, "skills", "zz-placeholder", "notes.md"), "not-a-skill-file\n");
    writeFileSync(
      join(root, "entry.js"),
      `export const files = import.meta.glob(${JSON.stringify(SKILLS_GLOB)}, { query: "?raw", import: "default", eager: true });\n`,
    );
    const out = await build({
      configFile: false,
      root,
      logLevel: "silent",
      build: { write: false, minify: false, lib: { entry: join(root, "entry.js"), formats: ["es"], fileName: "probe" } },
    });
    const outputs = (Array.isArray(out) ? out : [out]).flatMap((o) => o.output);
    const code = outputs.map((o) => (o.type === "chunk" ? o.code : "")).join("\n");
    assert.ok(code.includes(marker), "SKILL.md text was not inlined");
    assert.ok(code.includes("/skills/zz-placeholder/SKILL.md"), "glob key missing");
    assert.ok(!code.includes("not-a-skill-file"), "glob matched a non-SKILL.md file");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
