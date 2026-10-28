import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cameraAt } from "./story-render.ts";
import { actorAt } from "./animate.ts";
import { compileProject, newProject, setEdit } from "./project.ts";
import { SHOT_ZOOM } from "./story-direct.ts";
import { castTimeline, placeTimeline, sceneCoverTime } from "./previews.ts";
import { pickBeats, storyboardLayout, wrapLines } from "./storyboard.ts";

const TEXT = `صحنه: پذیرایی خانه، شب
علی (مرد، سمت راست) و سارا (زن، سمت چپ) روی مبل نشسته‌اند.
سارا: امروز چه خبر؟
علی: هیچ، خسته‌ام.`;

describe("camera shots chosen by the user", () => {
  const base = newProject(TEXT);
  const plain = compileProject(base);
  const line = plain.beats.find((b) => b.kind === "line")!;

  it("UT-ST-01 close shot zooms on the speaker; wide resets to the full frame", () => {
    const close = compileProject(setEdit(base, line.id, { shot: "close" }));
    const scene = close.timeline.scenes[0];
    const at = line.from - scene.start + 0.05;
    assert.equal(cameraAt(scene.cameras, at + 1).zoom, SHOT_ZOOM.close);
    assert.equal(close.beats.find((b) => b.id === line.id)?.shot, "close");
    const wide = compileProject(setEdit(base, line.id, { shot: "wide" }));
    assert.equal(cameraAt(wide.timeline.scenes[0].cameras, at + 1).zoom, 1);
  });

  it("UT-ST-02 shot survives JSON round trip and does not change timing", () => {
    const edited = setEdit(base, line.id, { shot: "medium" });
    const again = compileProject(JSON.parse(JSON.stringify(edited)));
    assert.equal(again.timeline.duration, plain.timeline.duration);
    assert.equal(again.beats.find((b) => b.id === line.id)?.shot, "medium");
  });
});

describe("library previews", () => {
  it("UT-ST-03 place preview is an empty scene of that place", () => {
    const tl = placeTimeline("car", true);
    assert.equal(tl.scenes[0].place, "car");
    assert.equal(tl.scenes[0].night, true);
    assert.equal(tl.scenes[0].actors.length, 0);
  });
  it("UT-ST-04 cast preview stands one character in the middle", () => {
    const tl = castTimeline({ id: "x", name: "x", look: { kind: "woman" } }, "laugh");
    const f = actorAt(tl.scenes[0].actors[0].track, 1, null);
    assert.equal(f.x, 0.5);
    assert.ok(f.state.pose.thigh > 0.7, "standing");
  });
  it("UT-ST-05 scene cover time is inside the scene", () => {
    for (const s of [{ start: 0, end: 1 }, { start: 3, end: 20 }]) {
      const t = sceneCoverTime(s);
      assert.ok(t > s.start && t < s.end);
    }
  });
});

describe("storyboard sheet", () => {
  const beats = Array.from({ length: 50 }, (_, i) => ({ id: `b${i}`, scene: 0, from: i, to: i + 1, text: "متن", kind: "line" as const }));
  it("UT-ST-06 samples evenly and keeps first and last", () => {
    const p = pickBeats(beats, 36);
    assert.equal(p.length, 36);
    assert.equal(p[0], beats[0]);
    assert.equal(p[35], beats[49]);
  });
  it("UT-ST-07 RTL grid: first cell top-right, cells inside the sheet, canvas size safe", () => {
    for (const format of ["portrait", "square", "landscape"] as const) {
      const l = storyboardLayout(beats, format);
      const [a, b] = l.cells;
      assert.ok(a.x > b.x, "second frame is to the left of the first");
      assert.equal(a.y, b.y);
      for (const c of l.cells) assert.ok(c.x >= 0 && c.x + c.w <= l.width && c.y + c.h + l.textH <= l.height);
      assert.ok(l.width <= 16384 && l.height <= 16384);
    }
  });
  it("UT-ST-08 text wraps to at most two lines with an ellipsis", () => {
    const lines = wrapLines("یک دو سه چهار پنج شش هفت هشت نه ده", 30, (s) => s.length * 4);
    assert.equal(lines.length, 2);
    assert.ok(lines[1].endsWith("…"));
  });
});
