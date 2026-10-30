/** Real-browser integration and visual regression. Attaches to the shared Preview browser. */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
const output = resolve(
  process.env.WORKSPACE_ROOT ?? "/home/vercel-sandbox/workspace",
  "output/behix",
);
const baseline = resolve("tests/story/baselines");
mkdirSync(output, { recursive: true });
const browser = await chromium.connectOverCDP(
  process.env.BROWSER_CDP_URL ?? execFileSync("coderabbit-agent-browser", ["get", "cdp-url"], { encoding: "utf8" }).trim(),
);
const page = await browser.contexts()[0].newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const report = { browser: browser.version(), checks: [], errors };
const check = (name, value) => {
  assert.ok(value, name);
  report.checks.push(name);
  console.log(`PASS ${name}`);
};
try {
  await page.goto("http://localhost:8080/story");
  await page.locator("canvas").waitFor();
  await page.waitForFunction(
    () => document.querySelector("#story") && !document.querySelector("#story").disabled,
  );
  await page.evaluate(() => document.fonts.ready);
  const result = await page.evaluate(async () => {
    const { parseStory } = await import("/src/studio/stick/story-parse.ts");
    const { directStory } = await import("/src/studio/stick/story-direct.ts");
    const { renderStory } = await import("/src/studio/stick/story-render.ts");
    const { makePaper } = await import("/src/studio/stick/paper.ts");
    const { loadRenderFonts } = await import("/src/studio/stick/fonts.ts");
    const { frameFor } = await import("/src/studio/stick/layout.ts");
    const { TEMPLATES } = await import("/tests/story/fixtures.ts");
    await loadRenderFonts();
    const frames = [];
    for (const [index, template] of TEMPLATES.entries())
      for (const format of ["portrait", "square", "landscape"]) {
        const d = directStory(parseStory(template.text)),
          f = frameFor(format),
          c = document.createElement("canvas");
        c.width = f.w;
        c.height = f.h;
        const ctx = c.getContext("2d"),
          paper = makePaper(f.w, f.h),
          t = d.cues[0] ? (d.cues[0].from + d.cues[0].to) / 2 : 1;
        renderStory(ctx, d.timeline, t, paper, { captions: true, format });
        const first = c.toDataURL();
        renderStory(ctx, d.timeline, t + 0.37, paper, { captions: true, format });
        renderStory(ctx, d.timeline, t, paper, { captions: true, format });
        frames.push({
          name: `template-${index}-${format}`,
          png: first,
          equal: first === c.toDataURL(),
        });
      }
    const d = directStory(parseStory(TEMPLATES[0].text)),
      t = 4.1,
      c = document.createElement("canvas");
    c.width = 1080;
    c.height = 1920;
    const ctx = c.getContext("2d");
    renderStory(ctx, d.timeline, t, makePaper(1080, 1920), { captions: true });
    const expected = ctx.getImageData(0, 0, 1080, 1920).data;
    const pixels = await new Promise((resolve, reject) => {
      const worker = new Worker("/tests/story/render.worker.ts", { type: "module" });
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error("worker timeout"));
      }, 30000);
      worker.onmessage = (e) => {
        clearTimeout(timer);
        worker.terminate();
        resolve(new Uint8ClampedArray(e.data));
      };
      worker.onerror = (e) => {
        clearTimeout(timer);
        worker.terminate();
        reject(new Error(e.message));
      };
      worker.postMessage({ timeline: d.timeline, time: t });
    });
    let difference = 0;
    for (let i = 0; i < expected.length; i++) if (expected[i] !== pixels[i]) difference++;
    return { frames, workerDifference: difference };
  });
  check(
    "repeat rendering is pixel-identical after seeking",
    result.frames.every((f) => f.equal),
  );
  check("worker and main canvas pixels match", result.workerDifference === 0);
  for (const frame of result.frames) {
    const bytes = Buffer.from(frame.png.split(",")[1], "base64");
    writeFileSync(resolve(output, `${frame.name}.png`), bytes);
    const file = resolve(baseline, `${frame.name}.png`);
    if (existsSync(file)) {
      const a = PNG.sync.read(readFileSync(file)),
        b = PNG.sync.read(bytes),
        diff = new PNG({ width: a.width, height: a.height });
      const count = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
      if (count) writeFileSync(resolve(output, `${frame.name}-diff.png`), PNG.sync.write(diff));
      if (count && process.env.STORY_VISUAL_CANDIDATES === "1") report.checks.push(`candidate pending review: ${frame.name}, ${count} changed pixels`);
      else check(`visual baseline ${frame.name}`, count === 0);
    } else if(process.env.STORY_VISUAL_CANDIDATES === "1") report.checks.push(`candidate saved, baseline review pending: ${frame.name}`);
    else throw new Error(`Missing reviewed baseline: ${frame.name}`);
  }
  if (process.env.STORY_VISUAL_ONLY !== "1") {
  const persistence = await page.evaluate(async () => {
    const model = await import("/src/studio/stick/project.ts"),
      db = await import("/src/studio/stick/project-db.ts");
    let p = model.newProject("علی: سلام\nعلی: خوبی؟", "آزمون ذخیره");
    p = model.setEdit(p, model.compileProject(p).beats[0].id, { duration: 6 });
    await db.saveProject(p);
    const read = (await db.listProjects()).find((x) => x.id === p.id);
    await db.deleteProject(p.id);
    const char = {
      id: "test-character",
      name: "شخصیت آزمون",
      look: { kind: "baby", clothing: "shirt" },
    };
    await db.saveCharacter(char);
    const readChar = (await db.listCharacters()).find((x) => x.id === char.id);
    await db.deleteCharacter(char.id);
    return {
      project: JSON.stringify(p) === JSON.stringify(read),
      character: JSON.stringify(char) === JSON.stringify(readChar),
    };
  });
  check(
    "real IndexedDB project and character roundtrips",
    persistence.project && persistence.character,
  );
  // User controls, not a fabricated API: create a disposable project, edit, reload and undo.
  const original = page.url();
  await page.getByRole("link", { name: "پروژه‌ها" }).click();
  await page.getByRole("button", { name: "داستان تازه" }).first().click();
  await page.waitForURL(url => url.href !== original && url.pathname.endsWith("/story"));
  await page.getByLabel("نام پروژه", { exact: true }).fill("آزمون مرورگر");
  await page.getByLabel("داستان", { exact: true }).fill("صحنه: پارک\nعلی: سلام\nعلی: خوبی؟");
  await page.getByLabel("مدت بخش (ثانیه)").fill("7");
  await page.getByLabel("مدت بخش (ثانیه)").press("Tab");
  await page.waitForFunction(() => document.body.textContent.includes("ذخیره شد"));
  await page.reload();
  await page.locator("canvas").waitFor();
  check(
    "timeline duration survives reload",
    (await page.getByLabel("مدت بخش (ثانیه)").inputValue()) === "7",
  );
  await page
    .getByLabel("داستان", { exact: true })
    .fill("صحنه: پارک\nعلی: جملهٔ تازه\nعلی: سلام\nعلی: خوبی؟");
  await page.locator(".studio-actions").getByRole("button", { name: "برگردان", exact: true }).click();
  check(
    "undo restores story text",
    (await page.getByLabel("داستان", { exact: true }).inputValue()).includes("جملهٔ تازه") ===
      false,
  );
  await page.getByRole("button", { name: "تکرار", exact: true }).click();
  check(
    "redo restores insertion",
    (await page.getByLabel("داستان", { exact: true }).inputValue()).includes("جملهٔ تازه"),
  );
  await page
    .getByLabel("بخش داستان")
    .selectOption({
      label: await page.getByLabel("بخش داستان").locator("option").nth(1).textContent(),
    });
  check(
    "matching text retains manual duration after insertion",
    (await page.getByLabel("مدت بخش (ثانیه)").inputValue()) === "7",
  );
  for (const format of ["portrait", "square", "landscape"]) {
    await page.getByLabel("قاب خروجی").selectOption(format);
    await page.setViewportSize({ width: 390, height: 844 });
    check(
      `390px no horizontal overflow: ${format}`,
      await page.evaluate(() => document.documentElement.scrollWidth <= 390),
    );
    await page.screenshot({ path: resolve(output, `mobile-${format}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByLabel("قاب خروجی").selectOption("portrait");
  const testId = await page.getByLabel("داستان‌های ذخیره‌شده").inputValue();
  await page.getByLabel("داستان‌های ذخیره‌شده").selectOption(original);
  await page.evaluate(async (id) => {
    const db = await import("/src/studio/stick/project-db.ts");
    await db.deleteProject(id);
  }, testId);
  await page.screenshot({ path: resolve(output, "desktop.png") });
  }
  check("no uncaught browser errors", errors.length === 0);
} finally {
  writeFileSync(resolve(output, "browser-report.json"), JSON.stringify(report, null, 2));
  await page.close();
  await browser.close();
}
