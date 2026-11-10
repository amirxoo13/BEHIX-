import { test } from "node:test";
import assert from "node:assert/strict";
import { kWeighting, Limiter, LoudnessMeter, loudnessGain, planSegments } from "./mix-dsp.ts";

const near = (a: number, b: number, eps: number, msg?: string) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} ${a} vs ${b}`);

const cat = (parts: Float32Array[]) => {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

function tone(seconds: number, rate: number, freq: number, amp: number, phase = 0): Float32Array {
  const n = Math.round(seconds * rate), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = amp * Math.sin(2 * Math.PI * freq * (i / rate) + phase);
  return x;
}

test("segments cover the film frame-exactly in 10–30 s pieces", () => {
  const segs = planSegments(185.3, 48000, 20);
  assert.equal(segs.reduce((a, s) => a + s.frames, 0), Math.round(185.3 * 48000));
  segs.forEach((s, i) => i && assert.equal(s.startFrame, segs[i - 1].startFrame + segs[i - 1].frames));
  assert.ok(segs.every((s) => s.frames >= 48000 * 5.3 - 1 && s.frames <= 48000 * 31));
  assert.equal(planSegments(60, 48000, 5)[0].frames, 480000, "clamped to 10 s");
  assert.equal(planSegments(40.5, 48000, 20).length, 2, "0.5 s tail folded");
});

test("K-weighting at 48 kHz matches BS.1770 published coefficients", () => {
  const [s, h] = kWeighting(48000);
  near(s.b0, 1.53512485958697, 1e-9); near(s.b1, -2.69169618940638, 1e-9); near(s.b2, 1.19839281085285, 1e-9);
  near(s.a1, -1.69065929318241, 1e-9); near(s.a2, 0.73248077421585, 1e-9);
  near(h.a1, -1.99004745483398, 1e-9); near(h.a2, 0.99007225036621, 1e-9);
});

test("997 Hz sine at −20 dBFS on both channels reads −20 LUFS", () => {
  // BS.1770: a 0 dBFS 997 Hz sine on one channel reads −3.01 LUFS.
  const rate = 48000, amp = 10 ** (-20 / 20);
  const m = new LoudnessMeter(rate, 2);
  const x = tone(5, rate, 997, amp);
  m.push([x, x]);
  // each channel: −20 dBFS sine → −23.01 LUFS; two channels add +3.01 → −20.0
  near(m.integrated(), -20, 0.1);
});

test("loudness meter is identical streamed in odd chunks and gates silence", () => {
  const rate = 48000, x = tone(3, rate, 440, 0.3), y = tone(3, rate, 660, 0.2);
  const whole = new LoudnessMeter(rate, 2);
  whole.push([x, y]);
  const parts = new LoudnessMeter(rate, 2);
  for (let i = 0; i < x.length; i += 7919) parts.push([x.subarray(i, i + 7919), y.subarray(i, i + 7919)]);
  assert.equal(parts.integrated(), whole.integrated());
  const sil = new LoudnessMeter(rate, 1);
  sil.push([new Float32Array(rate * 2)]);
  assert.equal(sil.integrated(), -Infinity);
  near(loudnessGain(-22, -16), 10 ** (6 / 20), 1e-12);
  assert.equal(loudnessGain(-Infinity), 1);
});

test("limiter holds the −1 dB ceiling and leaves quiet audio untouched (after latency)", () => {
  const rate = 48000, lim = new Limiter({ sampleRate: rate, channels: 1, ceilingDb: -1 });
  const ceiling = 10 ** (-1 / 20);
  const quiet = tone(0.5, rate, 300, 0.3);
  const loud = tone(0.5, rate, 300, 1.8);
  const out = cat([lim.process([quiet])[0], lim.process([loud])[0], lim.flush()[0]]);
  assert.equal(out.length, quiet.length + loud.length + lim.latency);
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak <= ceiling + 1e-6 && peak > ceiling - 0.01, `peak ${peak}`);
  for (let i = 1000; i < 20000; i += 997) near(out[i + lim.latency], quiet[i], 1e-7, "quiet passes");
});

test("segment seams: chunked limiter output is bit-identical to one pass", () => {
  const rate = 48000;
  const l = tone(4, rate, 220, 1.6), r = tone(4, rate, 330, 1.2, 1);
  const one = new Limiter({ sampleRate: rate, channels: 2, preGain: 1.3 });
  const a = one.process([l, r]), af = one.flush();
  const seg = new Limiter({ sampleRate: rate, channels: 2, preGain: 1.3 });
  const L: Float32Array[] = [], R: Float32Array[] = [];
  // seams at awkward places (not multiples of the look-ahead)
  const cuts = [0, 12345, 48000, 48001, 100000, 150007, l.length];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const o = seg.process([l.subarray(cuts[i], cuts[i + 1]), r.subarray(cuts[i], cuts[i + 1])]);
    L.push(o[0]); R.push(o[1]);
  }
  const f = seg.flush();
  L.push(f[0]); R.push(f[1]);
  const outL = cat(L);
  assert.deepEqual(outL, cat([a[0], af[0]]));
  assert.deepEqual(cat(R), cat([a[1], af[1]]));
  let maxStep = 0;
  for (let i = 1; i < outL.length; i++) maxStep = Math.max(maxStep, Math.abs(outL[i] - outL[i - 1]));
  assert.ok(maxStep < 0.1, `max step ${maxStep}`);
});
