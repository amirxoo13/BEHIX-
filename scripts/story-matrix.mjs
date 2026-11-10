import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
const out = resolve(
  process.env.WORKSPACE_ROOT ?? "/home/vercel-sandbox/workspace",
  "output/behix/matrix",
);
mkdirSync(out, { recursive: true });
const browser = await chromium.connectOverCDP(
  process.env.BROWSER_CDP_URL ?? execFileSync("coderabbit-agent-browser", ["get", "cdp-url"], { encoding: "utf8" }).trim(),
);
const page = await browser.contexts()[0].newPage();
const summary = { frames: 0, places: [], variants: [], times: [0.8, 1.15, 1.8] };
try {
  await page.goto("http://localhost:8080/story");
  await page.locator("canvas").waitFor();
  const places = await page.evaluate(async () =>
    Object.keys((await import("/src/studio/stick/places.ts")).PLACES),
  );
  for (const place of places) {
    const result = await page.evaluate(
      async ({ place, times }) => {
        const { POSES } = await import("/src/studio/stick/poses.ts"),
          { HOLD_IDS } = await import("/src/studio/stick/holds.ts"),
          { renderStory } = await import("/src/studio/stick/story-render.ts"),
          { makePaper } = await import("/src/studio/stick/paper.ts"),
          { loadRenderFonts } = await import("/src/studio/stick/fonts.ts");
        await loadRenderFonts();
        const poses = Object.keys(POSES),
          c = document.createElement("canvas");
        c.width = 108;
        c.height = 192;
        const ctx = c.getContext("2d"),
          paper = makePaper(1080, 1920);
        const sheet = document.createElement("canvas");
        sheet.width = HOLD_IDS.length * 108;
        sheet.height = poses.length * 216;
        const grid = sheet.getContext("2d");
        grid.fillStyle = "white";
        grid.fillRect(0, 0, sheet.width, sheet.height);
        grid.font = "10px sans-serif";
        let count = 0;
        for (const [row, pose] of poses.entries())
          for (const [col, hold] of HOLD_IDS.entries())
            for (const night of [false, true])
              for (const hand of ["holdL", "holdR"]) {
                const scene = {
                  start: 0,
                  end: 3,
                  place,
                  night,
                  actors: [
                    {
                      cast: "actor",
                      track: {
                        seed: 3,
                        talk: [],
                        keys: [
                          {
                            t: 0,
                            x: 0.5,
                            pose: POSES[pose].thigh < 0.7 ? "sit" : "stand",
                            face: "neutral",
                            [hand]: hold,
                          },
                          { t: 1, x: 0.5, pose, face: "smile", [hand]: hold },
                        ],
                      },
                    },
                  ],
                  captions: [],
                  cameras: [],
                  thoughts: [],
                  speakers: [],
                };
                const tl = {
                  duration: 3,
                  cast: [{ id: "actor", name: "شخصیت", look: { kind: "man" } }],
                  scenes: [scene],
                };
                for (const t of times) {
                  ctx.setTransform(0.1, 0, 0, 0.1, 0, 0);
                  renderStory(ctx, tl, t, paper, { captions: false });
                  count++;
                }
                if (!night && hand === "holdR") {
                  grid.drawImage(c, col * 108, row * 216);
                  grid.fillStyle = "black";
                  grid.fillText(`${pose}/${hold}`, col * 108 + 2, row * 216 + 204, 104);
                }
              }
        return { count, poses: poses.length, holds: HOLD_IDS.length, png: sheet.toDataURL() };
      },
      { place, times: summary.times },
    );
    summary.frames += result.count;
    summary.places.push({ place, frames: result.count, poses: result.poses, holds: result.holds });
    writeFileSync(resolve(out, `${place}.png`), Buffer.from(result.png.split(",")[1], "base64"));
    console.log(`${place}: ${result.count} frames`);
  }
  for (const kind of ["baby", "boy", "girl", "woman", "oldMan", "oldWoman"]) {
    const result = await page.evaluate(async (kind) => {
      const { drawFigure, CLOTHES } = await import("/src/studio/stick/figure.ts"),
        { POSES } = await import("/src/studio/stick/poses.ts"),
        { HOLD_IDS } = await import("/src/studio/stick/holds.ts"),
        { FACES } = await import("/src/studio/stick/face.ts");
      const c = document.createElement("canvas");
      c.width = 200;
      c.height = 240;
      const ctx = c.getContext("2d");
      let count = 0;
      for (const clothing of CLOTHES)
        for (const pose of Object.values(POSES))
          for (const hold of HOLD_IDS)
            for (const hand of ["holdL", "holdR"]) {
              ctx.clearRect(0, 0, 200, 240);
              drawFigure(
                ctx,
                { kind, clothing },
                { pose, face: FACES.neutral, blink: 0, talk: 0, [hand]: hold },
                100,
                145,
                0.55,
              );
              count++;
            }
      return { kind, count };
    }, kind);
    summary.variants.push(result);
    summary.frames += result.count;
    console.log(`${kind}: ${result.count} frames`);
  }
  writeFileSync(resolve(out, "coverage.json"), JSON.stringify(summary, null, 2));
  console.log(`Total rendered: ${summary.frames}`);
} finally {
  await page.close();
  await browser.close();
}
