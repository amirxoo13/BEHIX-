import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compileProject, newProject } from "./project.ts";
import { defaultVoices, envelopePulses, lineDurationFor, mixClips, placeVoices, stylePrompt, VOICES } from "./voice.ts";

const tone = (sec: number, rate = 24000, gaps: [number, number][] = []) => {
  const a = new Float32Array(Math.round(sec * rate));
  for (let i = 0; i < a.length; i++) {
    const t = i / rate;
    a[i] = gaps.some(([f, to]) => t >= f && t < to) ? 0 : 0.5 * Math.sin(2 * Math.PI * 220 * t);
  }
  return a;
};

describe("Gemini voice casting and lip sync", () => {
  it("UT-VO-01 default voices follow gender and never repeat in one story", () => {
    const v = defaultVoices([
      { id: "a", look: { kind: "man" } }, { id: "b", look: { kind: "man" } }, { id: "c", look: { kind: "woman" } },
    ]);
    assert.notEqual(v.a, v.b);
    assert.equal(VOICES[v.a], "m");
    assert.equal(VOICES[v.c], "f");
    assert.equal(defaultVoices([{ id: "a", look: { kind: "man" } }], { a: "Puck" }).a, "Puck");
  });
  it("UT-VO-02 style prompt carries mood and age, in Persian", () => {
    assert.match(stylePrompt("angry", "boy"), /child.*Persian.*angrily/);
  });
  it("UT-VO-03 envelope pulses follow real speech and silences", () => {
    const p = envelopePulses(tone(1, 24000, [[0.4, 0.6]]), 24000, 10);
    assert.ok(p.length >= 2);
    assert.ok(p.every((x) => x.from >= 10 && x.to <= 11.05 && x.strength > 0 && x.strength <= 1));
    assert.ok(!p.some((x) => x.from >= 10.42 && x.to <= 10.58), "no pulse inside the silence");
    assert.equal(envelopePulses(new Float32Array(2400), 24000, 0).length, 0);
  });
  it("UT-VO-04 clips sit on the speaker's talk span and replace mouth pulses", () => {
    const d = compileProject(newProject("صحنه: پارک، روز\nعلی (مرد): سلام\nسارا (زن): خوبی؟"));
    const line = d.beats.find((b) => b.kind === "line")!;
    const { timeline, placed } = placeVoices(d, new Map([[line.id, { samples: tone(0.8), sampleRate: 24000 }]]));
    assert.equal(placed.length, 1);
    assert.ok(placed[0].start >= line.from && placed[0].start < line.to);
    const talk = timeline.scenes[0].actors.find((a) => a.cast === line.speaker)!.track.talk[0];
    assert.ok(talk.pulses!.length > 0 && talk.pulses![0].from >= talk.from - 1e-6);
    assert.notEqual(timeline, d.timeline, "input timeline is not mutated");
  });
  it("UT-VO-05 mix places clips at their start and clamps", () => {
    const m = mixClips([{ beatId: "x", start: 0.5, samples: new Float32Array(2400).fill(0.9), sampleRate: 24000 }, { beatId: "y", start: 0.5, samples: new Float32Array(2400).fill(0.9), sampleRate: 24000 }], 1);
    assert.equal(m.length, 24000);
    assert.equal(m[11999], 0);
    assert.equal(m[12000], 1);
    assert.equal(lineDurationFor(2.04), 2.5);
  });
});
