import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const output = resolve(
  process.env.WORKSPACE_ROOT ?? "/home/vercel-sandbox/workspace",
  "output/behix/soak-report.json",
);
const browser = await chromium.connectOverCDP(
  process.env.BROWSER_CDP_URL ?? execFileSync("coderabbit-agent-browser", ["get", "cdp-url"], { encoding: "utf8" }).trim(),
);
const page = await browser.contexts()[0].newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const report = { durationSeconds: 600, heap: [], errors };
let original, testId;
try {
  await page.goto("http://localhost:8080/story");
  await page.locator("canvas").waitFor();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.bringToFront();
  await page.locator('details[aria-label="پروژه‌ها"] > summary').click();
  original = await page.getByLabel("داستان‌های ذخیره‌شده").inputValue();
  await page.getByRole("button", { name: "داستان تازه", exact: true }).click();
  await page.getByLabel("نام پروژه", { exact: true }).fill("آزمون ده دقیقه‌ای");
  await page
    .getByLabel("داستان", { exact: true })
    .fill(
      "صحنه: پذیرایی خانه\nعلی (مرد) و سارا (زن) نشسته‌اند.\n" +
        Array.from(
          { length: 240 },
          (_, i) => `${i % 2 ? "علی" : "سارا"}: سلام، امروز برای ساختن یک داستان تازه آماده‌ای؟`,
        ).join("\n"),
    );
  await page.waitForFunction(() => document.body.textContent.includes("ذخیره شد؛"));
  testId = await page.getByLabel("داستان‌های ذخیره‌شده").inputValue();
  await page.locator('details[aria-label="پروژه‌ها"] > summary').click();
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  report.heap.push({ second: 0, ...(await cdp.send("Runtime.getHeapUsage")) });
  await page.getByRole("button", { name: "پخش", exact: true }).click();
  const monitor = page.evaluate(
    () =>
      new Promise((resolve) => {
        const samples = [];
        let count = 0,
          slow = 0,
          previous = performance.now();
        const start = previous;
        let lastLog = start;
        const tick = (now) => {
          const delta = now - previous;
          previous = now;
          count++;
          if (delta > 25) slow++;
          samples.push(delta);
          if (now - lastLog >= 60000) {
            console.log(`soak ${Math.round((now - start) / 1000)}s`);
            lastLog = now;
          }
          if (now - start >= 600000) {
            samples.sort((a, b) => a - b);
            resolve({
              elapsedMs: now - start,
              frames: count,
              intervalP95: samples[Math.floor(samples.length * 0.95)],
              slowIntervals: slow,
              renderP95: Number(document.querySelector("canvas").dataset.renderP95),
              resolution: [
                document.querySelector("canvas").width,
                document.querySelector("canvas").height,
              ],
              playing: !![...document.querySelectorAll("button")].find(
                (b) => b.textContent === "توقف",
              ),
            });
          } else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
  );
  const sample = setInterval(() => {
    void cdp.send("Runtime.getHeapUsage").then((value) => {
      report.heap.push({ second: report.heap.length * 60, ...value });
      console.log(`heap sample ${report.heap.length - 1}: ${value.usedSize}`);
    });
  }, 60000);
  try {
    report.playback = await monitor;
  } finally {
    clearInterval(sample);
  }
  await cdp.send("HeapProfiler.collectGarbage");
  report.heap.push({ second: 600, afterGC: true, ...(await cdp.send("Runtime.getHeapUsage")) });
  assert.equal(errors.length, 0);
  assert.equal(report.playback.playing, true);
  assert.ok(report.playback.frames > 10000);
  report.retainedHeapGrowth = report.heap.at(-1).usedSize - report.heap[0].usedSize;
  assert.ok(
    report.retainedHeapGrowth < 10_000_000,
    `retained heap grew by ${report.retainedHeapGrowth}`,
  );
  assert.ok(report.playback.renderP95 <= 16.7, `render p95 ${report.playback.renderP95}`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (original && testId) {
    await page
      .locator('details[aria-label="پروژه‌ها"] > summary')
      .click()
      .catch(() => undefined);
    await page
      .getByLabel("داستان‌های ذخیره‌شده")
      .selectOption(original)
      .catch(() => undefined);
    await page
      .evaluate(async (id) => {
        const db = await import("/src/studio/stick/project-db.ts");
        await db.deleteProject(id);
      }, testId)
      .catch(() => undefined);
  }
  writeFileSync(output, JSON.stringify(report, null, 2));
  await page.close();
  await browser.close();
}
