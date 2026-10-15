import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";
const out = resolve(process.env.WORKSPACE_ROOT ?? "/home/vercel-sandbox/workspace", "output/behix");
const browser = await chromium.connectOverCDP(
  process.env.BROWSER_CDP_URL ?? execFileSync("coderabbit-agent-browser", ["get", "cdp-url"], { encoding: "utf8" }).trim(),
);
const page = await browser.contexts()[0].newPage();
const report = { checks: [], films: [] };
try {
  await page.goto("http://localhost:8080/story");
  await page.locator("canvas").waitFor();
  await page.bringToFront();
  const data = await page.evaluate(async () => {
    const { parseStory } = await import("/src/studio/stick/story-parse.ts"),
      { directStory } = await import("/src/studio/stick/story-direct.ts"),
      { exportStoryFilm, canExportMp4, recordLive } =
        await import("/src/studio/stick/story-export.ts"),
      { makePaper } = await import("/src/studio/stick/paper.ts"),
      { inspectVideo } = await import("/tests/story/browser-utils.ts");
    const { timeline } = directStory(parseStory("صحنه: پارک\nعلی: سلام!"));
    const films = [];
    for (const format of ["portrait", "square", "landscape"]) {
      const capable = await canExportMp4(30, format);
      const film = await exportStoryFilm(timeline, { fps: 30, captions: true, format });
      const metadata = await inspectVideo(film.blob);
      const bytes = new Uint8Array(await film.blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      films.push({
        format,
        capable,
        ext: film.ext,
        notice: film.notice,
        bytes: film.blob.size,
        ...metadata,
        base64: btoa(binary),
      });
    }
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 1920;
    const ctx = c.getContext("2d"),
      paper = makePaper(1080, 1920);
    const captured = [];
    const original = c.captureStream.bind(c);
    c.captureStream = (fps) => {
      const stream = original(fps);
      captured.push(stream);
      return stream;
    };
    const abort = new AbortController();
    setTimeout(() => abort.abort(), 200);
    let cancelled = false;
    try {
      await recordLive(timeline, c, ctx, paper, { fps: 30, captions: false, signal: abort.signal });
    } catch (e) {
      cancelled = e.name === "AbortError";
    }
    const released = captured.flatMap((s) => s.getTracks()).every((t) => t.readyState === "ended");
    const fallback = await recordLive(timeline, c, ctx, paper, { fps: 30, captions: true });
    const fallbackMeta = await inspectVideo(fallback.blob);
    const recovered = captured.flatMap((s) => s.getTracks()).every((t) => t.readyState === "ended");
    const pre = new AbortController();
    pre.abort();
    let preCancelled = false;
    try {
      await exportStoryFilm(timeline, { fps: 30, captions: true, signal: pre.signal });
    } catch (e) {
      preCancelled = e.name === "AbortError";
    }
    const workerAbort = new AbortController();
    setTimeout(() => workerAbort.abort(), 100);
    let workerCancelled = false;
    try {
      await exportStoryFilm(timeline, { fps: 60, captions: true, signal: workerAbort.signal });
    } catch (e) {
      workerCancelled = e.name === "AbortError";
    }
    return {
      films,
      cancelled,
      released,
      recovered,
      preCancelled,
      workerCancelled,
      fallback: { ext: fallback.ext, bytes: fallback.blob.size, ...fallbackMeta },
      duration: timeline.duration,
    };
  });
  for (const f of data.films) {
    const { base64, ...info } = f;
    report.films.push(info);
    writeFileSync(resolve(out, `export-${f.format}.${f.ext}`), Buffer.from(base64, "base64"));
    assert.ok(f.bytes > 1000);
    assert.equal(f.audio, 0);
    const dims =
      f.format === "portrait" ? [1080, 1920] : f.format === "square" ? [1080, 1080] : [1920, 1080];
    assert.deepEqual([f.width, f.height], dims);
    assert.ok(Math.abs(f.duration - data.duration) < 0.3);
    console.log(`${f.format}: ${f.ext}, ${f.width}x${f.height}, ${f.duration}s, ${f.codec}`);
  }
  for (const key of ["cancelled", "released", "recovered", "preCancelled", "workerCancelled"]) {
    assert.equal(data[key], true, key);
    report.checks.push(key);
  }
  assert.equal(data.fallback.audio, 0);
  assert.ok(data.fallback.bytes > 1000);
  report.fallback = data.fallback;
  report.checks.push("real MediaRecorder output after abort");
  console.log(JSON.stringify(report, null, 2));
} finally {
  writeFileSync(resolve(out, "export-report.json"), JSON.stringify(report, null, 2));
  await page.close();
  await browser.close();
}
