/** Exercise browser failures with real storage quotas and real stopped media tracks. */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.connectOverCDP(
  process.env.BROWSER_CDP_URL ??
    execFileSync("coderabbit-agent-browser", ["get", "cdp-url"], { encoding: "utf8" }).trim(),
);
const context = await browser.newContext();
const page = await context.newPage();
const origin = "http://localhost:8080";
const checks = [];
let cdp;
try {
  cdp = await context.newCDPSession(page);
  await cdp.send("Storage.overrideQuotaForOrigin", { origin, quotaSize: 1 });
  await page.goto(`${origin}/story`);
  await page.locator("canvas[data-render-ready=true]").waitFor();
  await page.bringToFront();
  await page.locator('details[aria-label="پروژه‌ها"] > summary').click();
  await page.getByText("ذخیره نشد؛", { exact: false }).first().waitFor();
  // New stories start empty (no sample text), so type while saving is failing.
  await page.getByLabel("داستان", { exact: true }).fill("علی: هنوز قابل ویرایش");
  assert.equal(await page.getByLabel("داستان", { exact: true }).inputValue(), "علی: هنوز قابل ویرایش");
  checks.push("actual storage quota failure is visible while story text remains editable");
  await cdp.send("Storage.overrideQuotaForOrigin", { origin });
  await page.getByLabel("داستان", { exact: true }).fill("علی: ذخیره دوباره");
  await page.waitForFunction(async () => {
    const db = await import("/src/studio/stick/project-db.ts");
    return (await db.listProjects()).some((p) => p.text === "علی: ذخیره دوباره");
  });
  checks.push("actual autosave recovers after restoring the browser storage quota");
  await page.evaluate(async () => {
    const { newProject } = await import("/src/studio/stick/project.ts");
    const db = await import("/src/studio/stick/project-db.ts");
    for (const title of ["قسمت خطا", "قسمت بعدی"])
      await db.saveProject(newProject("صحنه: ماشین\nعلی: سلام!", title));
  });
  await page.reload();
  await page.locator("canvas[data-render-ready=true]").waitFor();
  await page.waitForFunction(() => document.body.textContent.includes("ذخیره شد؛"));
  const panel = page.locator("details").filter({
    has: page.locator("summary", { hasText: "خروجی دسته‌ای قسمت‌ها" }),
  });
  await panel.locator("summary").click();
  await page.getByLabel("قسمت خطا", { exact: true }).check();
  await page.getByLabel("قسمت بعدی", { exact: true }).check();
  await page.evaluate(() => {
    const capture = HTMLCanvasElement.prototype.captureStream;
    window.__behixCapturedStreams = [];
    HTMLCanvasElement.prototype.captureStream = function (fps) {
      const stream = capture.call(this, fps);
      window.__behixCapturedStreams.push(stream);
      return stream;
    };
  });
  await page.getByRole("button", { name: "ساخت قسمت‌های انتخاب‌شده", exact: true }).click();
  await panel.getByRole("status").filter({ hasText: "ساخت فیلم:" }).first().waitFor();
  // Instrumentation retains the native captureStream. End its real tracks,
  // rather than substituting a recorder or fabricating an error event.
  await page.evaluate(() => window.__behixCapturedStreams[0].getTracks().forEach((t) => t.stop()));
  await page
    .getByRole("button", { name: "لغو صف", exact: true })
    .waitFor({ state: "hidden", timeout: 30000 });
  assert.equal(await panel.getByRole("status").filter({ hasText: "خطا:" }).count(), 1);
  const files = await page.evaluate(async () => {
    const db = await import("/src/studio/stick/project-db.ts");
    return (await db.listArtifacts()).map((a) => ({ name: a.name, size: a.blob.size }));
  });
  assert.equal(files.filter((f) => f.name.startsWith("قسمت خطا")).length, 0);
  assert.equal(files.filter((f) => f.name.startsWith("قسمت بعدی") && f.size > 0).length, 4);
  checks.push(
    "ending the first episode's real capture stream fails that episode; the next produces four actual files",
  );

  const media = await page.evaluate(async () => {
    const { recordLive } = await import("/src/studio/stick/story-export.ts");
    const { parseStory } = await import("/src/studio/stick/story-parse.ts");
    const { directStory } = await import("/src/studio/stick/story-direct.ts");
    const { makePaper } = await import("/src/studio/stick/paper.ts");
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    let stream;
    const capture = canvas.captureStream.bind(canvas);
    canvas.captureStream = (fps) => {
      stream = capture(fps);
      return stream;
    };
    let error = "";
    try {
      await recordLive(
        directStory(parseStory("علی: سلام!")).timeline,
        canvas,
        canvas.getContext("2d"),
        makePaper(1080, 1920),
        {
          fps: 30,
          captions: false,
          onProgress: (n) => {
            if (n > 0.05) stream.getTracks().forEach((t) => t.stop());
          },
        },
      );
    } catch (e) {
      error = e.message;
    }
    return { error, ended: stream.getTracks().every((t) => t.readyState === "ended") };
  });
  assert.match(media.error, /پیش از پایان/);
  assert.equal(media.ended, true);
  checks.push(
    "unexpected termination of the real capture stream rejects recording and releases tracks",
  );
  console.log(checks.join("\n"));
} finally {
  await cdp?.send("Storage.overrideQuotaForOrigin", { origin }).catch(() => undefined);
  writeFileSync(
    resolve(
      process.env.WORKSPACE_ROOT ?? "/home/vercel-sandbox/workspace",
      "output/behix/failure-report.json",
    ),
    JSON.stringify({ checks }, null, 2),
  );
  await context.close();
  await browser.close();
}
