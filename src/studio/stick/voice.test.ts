import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compileProject, newProject } from "./project.ts";
import { concatClips, defaultVoices, encodeWav, envelopePulses, lineDurationFor, MAX_LINE, mixClips, placeVoices, splitLine, stylePrompt, legacyStylePrompt, VOICES } from "./voice.ts";

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
  it("UT-VO-02 style is a short 3.8 style (mood + dialect, no preamble, no age); legacy prompt unchanged", () => {
    const st = stylePrompt("angry", "boy");
    assert.equal(st, "angrily; natural, colloquial Tehrani Persian");
    assert.ok(st.split(/\s+/).length < 15);
    assert.doesNotMatch(st, /Read this|Do not|child/);
    assert.equal(stylePrompt(), "natural, colloquial Tehrani Persian");
    assert.equal(legacyStylePrompt("angry", "boy"), "Read this line as a child in natural, colloquial Tehrani Persian, angrily. Do not add words.");
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

describe("long lines (over the 400-char server limit)", () => {
  const sentence = "این یک جملهٔ نسبتاً طولانی فارسی است که برای آزمون تکه‌کردن نوشته شده. ";
  it("short lines stay whole", () => {
    assert.deepEqual(splitLine("  سلام  "), ["سلام"]);
    assert.deepEqual(splitLine(""), []);
  });
  it("splits at sentence boundaries into ≤ MAX_LINE chunks without losing words", () => {
    const text = sentence.repeat(12).trim();
    const parts = splitLine(text);
    assert.ok(parts.length >= 2);
    assert.ok(parts.every((p) => p.length <= MAX_LINE && p.length > 0));
    assert.ok(parts.every((p) => p.endsWith(".")), "every chunk ends on a sentence end");
    assert.equal(parts.join(" ").replace(/\s+/g, " "), text.replace(/\s+/g, " "));
  });
  it("falls back to clause marks, then spaces, then a hard cut", () => {
    const clauses = Array.from({ length: 40 }, (_, i) => `بخش شمارهٔ ${i} از متن`).join("، ");
    const parts = splitLine(clauses, 100);
    assert.ok(parts.every((p) => p.length <= 100));
    assert.ok(parts.slice(0, -1).every((p) => p.endsWith("،")));
    const words = "کلمه ".repeat(200);
    assert.ok(splitLine(words, 50).every((p) => p.length <= 50));
    const blob = "ا".repeat(250);
    const hard = splitLine(blob, 100);
    assert.deepEqual(hard.map((p) => p.length), [100, 100, 50]);
  });
  it("concatClips joins parts with a short gap and resamples to the first rate", () => {
    const a = { samples: new Float32Array(240).fill(0.5), sampleRate: 24000 };
    const b = { samples: new Float32Array(480).fill(-0.5), sampleRate: 48000 };
    const c = concatClips([a, b], 0.01);
    assert.equal(c.sampleRate, 24000);
    assert.equal(c.samples.length, 240 + 240 + 240);
    assert.equal(c.samples[0], 0.5);
    assert.equal(c.samples[300], 0);
    assert.equal(c.samples[c.samples.length - 1], -0.5);
    assert.equal(concatClips([a]), a);
  });
  it("encodeWav writes a 16-bit mono RIFF header", () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 2]), 24000);
    const v = new DataView(wav.buffer);
    assert.equal(String.fromCharCode(...wav.subarray(0, 4)), "RIFF");
    assert.equal(v.getUint32(24, true), 24000);
    assert.equal(v.getUint32(40, true), 8);
    assert.deepEqual([v.getInt16(44, true), v.getInt16(46, true), v.getInt16(48, true), v.getInt16(50, true)], [0, 32767, -32768, 32767]);
  });
});
