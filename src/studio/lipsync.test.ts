import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { buildMouthTrack, mouthAt, mouthFromLevel, monoOf } from "./lipsync.ts";
import { blinkAt, pulseEnv } from "./rig.ts";

const SR = 16000;
function tone(sec: number, hz: number, amp: number) {
  const a = new Float32Array(Math.round(sec * SR));
  for (let i = 0; i < a.length; i++) a[i] = amp * Math.sin((2 * Math.PI * hz * i) / SR);
  return a;
}
function concat(...parts: Float32Array[]) {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

describe("T11 analysis", () => {
  it("UT-LS-01 silence → mouth closed", () => {
    const tr = buildMouthTrack(new Float32Array(SR), SR, 30);
    assert.ok(tr.open.length >= 30 && tr.open.length <= 31);
    for (let t = 0; t < 1; t += 0.1) assert.equal(mouthAt(tr, t)?.viseme, "rest");
  });
  it("UT-LS-02 voiced section opens mouth, silence closes it (timing)", () => {
    const tr = buildMouthTrack(concat(new Float32Array(SR / 2), tone(0.5, 200, 0.5), new Float32Array(SR / 2)), SR, 30);
    assert.equal(mouthAt(tr, 0.2)?.open, 0);
    assert.ok((mouthAt(tr, 0.75)?.open ?? 0) > 0.6);
    assert.notEqual(mouthAt(tr, 0.75)?.viseme, "rest");
    assert.equal(mouthAt(tr, 1.4)?.viseme, "rest");
  });
  it("UT-LS-03 deterministic per frame", () => {
    const s = concat(tone(0.3, 180, 0.4), tone(0.3, 3000, 0.2));
    assert.deepEqual(buildMouthTrack(s, SR), buildMouthTrack(s, SR));
  });
  it("UT-LS-04 quiet recording is normalized", () => {
    const tr = buildMouthTrack(concat(new Float32Array(SR / 4), tone(0.5, 200, 0.02)), SR, 30);
    assert.ok((mouthAt(tr, 0.5)?.open ?? 0) > 0.6);
  });
  it("UT-CR-13 amplitude 0.001 still opens the mouth", () => {
    const tr = buildMouthTrack(tone(0.5, 200, 0.001), SR, 30);
    assert.ok((mouthAt(tr, 0.4)?.open ?? 0) > 0.2);
  });
});

describe("T11 mapping + fallback", () => {
  it("UT-LS-05 mapping thresholds", () => {
    assert.deepEqual(mouthFromLevel(0.02, 0.1), { viseme: "rest", open: 0 });
    assert.equal(mouthFromLevel(0.6, 0.1).viseme, "ah");
    assert.equal(mouthFromLevel(0.4, 0.4).viseme, "ee");
    assert.equal(mouthFromLevel(0.2, 0.4).viseme, "fv");
    assert.equal(mouthFromLevel(0.4, 0.03).viseme, "oo");
    assert.equal(mouthFromLevel(0.95, 0.1).viseme, "shout");
    assert.equal(mouthFromLevel(Number.NaN, 0).viseme, "rest");
  });
  it("UT-LS-06 no audio → null (renderFrame keeps text-driven mouth)", () => {
    assert.equal(mouthAt(undefined, 1), null);
    assert.equal(mouthAt(null, 1), null);
  });
  it("UT-LS-07 past end of audio → closed", () => {
    const tr = buildMouthTrack(tone(0.5, 200, 0.5), SR, 30);
    assert.equal(mouthAt(tr, 3)?.viseme, "rest");
    assert.equal(mouthAt(tr, -1)?.viseme, "rest");
  });
  it("UT-LS-08 monoOf averages channels", () => {
    const L = new Float32Array([1, 0]);
    const R = new Float32Array([0, 1]);
    const m = monoOf({ numberOfChannels: 2, length: 2, getChannelData: (c) => (c ? R : L) });
    assert.deepEqual(Array.from(m), [0.5, 0.5]);
  });
});

describe("T11 blink + easing", () => {
  it("UT-LS-09 blink deterministic, irregular intervals, slots differ", () => {
    const starts: number[] = [];
    let was = 0;
    for (let i = 0; i < 4000; i++) {
      const t = i / 100;
      const b = blinkAt(t, "neutral");
      if (b > 0 && was === 0) starts.push(t);
      was = b;
      assert.equal(b, blinkAt(t, "neutral"));
    }
    assert.ok(starts.length >= 8, `blinks=${starts.length}`);
    const gaps = starts.slice(1).map((t, i) => +(t - starts[i]).toFixed(2));
    assert.ok(new Set(gaps).size > 3, `gaps=${gaps}`);
    let diff = 0;
    for (let t = 0; t < 20; t += 0.05) if (blinkAt(t, "neutral", 0) !== blinkAt(t, "neutral", 1)) diff++;
    assert.ok(diff > 0);
    assert.equal(blinkAt(1, "shock"), 0);
  });
  it("UT-LS-10 emotion pulse eases in (no jump to 1)", () => {
    assert.equal(pulseEnv(0, 100), 0);
    assert.ok(pulseEnv(1000, 1001) < 0.01);
    assert.ok(pulseEnv(1000, 1070) > 0.4 && pulseEnv(1000, 1070) < 0.7);
    assert.ok(Math.abs(pulseEnv(1000, 1140) - 0.99) < 0.01);
    assert.equal(pulseEnv(1000, 3000), 0);
  });
});

const WAV = "/workspace/t11/speech-fa.wav";
describe("T11 real espeak-ng WAV", { skip: !existsSync(WAV) }, () => {
  it("UT-LS-11 speech WAV: mouth moves with syllables and rests in pauses", () => {
    const b = readFileSync(WAV);
    let o = 12;
    let sr = 0;
    let data: Float32Array | null = null;
    while (o < b.length - 8) {
      const id = b.toString("ascii", o, o + 4);
      const size = b.readUInt32LE(o + 4);
      if (id === "fmt ") sr = b.readUInt32LE(o + 12);
      if (id === "data") {
        const n = Math.floor(Math.min(size, b.length - o - 8) / 2);
        data = new Float32Array(n);
        for (let i = 0; i < n; i++) data[i] = b.readInt16LE(o + 8 + i * 2) / 32768;
        break;
      }
      o += 8 + size;
    }
    assert.ok(data && sr > 0);
    const tr = buildMouthTrack(data, sr, 30);
    const opens = Array.from(tr.open);
    const rest = opens.filter((v) => v < 0.08).length;
    let changes = 0;
    for (let i = 1; i < opens.length; i++) if (opens[i] >= 0.08 !== opens[i - 1] >= 0.08) changes++;
    console.log(`frames=${opens.length} rest=${rest} changes=${changes}`);
    assert.ok(rest > opens.length * 0.1, `rest=${rest}/${opens.length}`);
    assert.ok(rest < opens.length * 0.8);
    assert.ok(changes >= 8, `open/close changes=${changes}`);
  });
});
