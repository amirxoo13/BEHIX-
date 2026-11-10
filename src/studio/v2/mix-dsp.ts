/**
 * Pure DSP for the film mix render (no Web Audio; tested in Node):
 *  - planSegments: 10–30 s render segments on exact frame boundaries
 *  - kWeighting + LoudnessMeter: ITU-R BS.1770-4 integrated loudness (400 ms blocks, 75 % overlap,
 *    −70 LUFS absolute and −10 LU relative gates), streaming across segments
 *  - Limiter: look-ahead brick-wall limiter (sample peak), state carried across process() calls so
 *    segment seams are bit-identical to a single pass
 * BS.1770 filter derivation for any sample rate follows the published biquad form (same constants as
 * libebur128/pyloudnorm); at 48 kHz it reproduces the coefficients printed in the recommendation.
 */

export type Segment = { index: number; startFrame: number; frames: number };

/** Split `duration` seconds into segments of ~segSeconds (clamped 10–30 s), frame-exact, no gaps. */
export function planSegments(duration: number, sampleRate: number, segSeconds = 20): Segment[] {
  const total = Math.max(0, Math.round(duration * sampleRate));
  const seg = Math.round(Math.min(30, Math.max(10, segSeconds)) * sampleRate);
  const out: Segment[] = [];
  for (let s = 0, i = 0; s < total; s += seg, i++) out.push({ index: i, startFrame: s, frames: Math.min(seg, total - s) });
  // fold a tiny tail (< 1 s) into the previous segment so no segment is pointlessly short
  if (out.length > 1 && out[out.length - 1].frames < sampleRate) {
    const t = out.pop()!;
    out[out.length - 1].frames += t.frames;
  }
  return out;
}

export type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

/** The two K-weighting stages (pre-filter high shelf, RLB high-pass) for a sample rate. */
export function kWeighting(fs: number): [Biquad, Biquad] {
  const G = 3.999843853973347;
  let f0 = 1681.974450955533, Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / fs);
  const Vh = 10 ** (G / 20), Vb = Vh ** 0.4996667741545416;
  let a0 = 1 + K / Q + K * K;
  const shelf = { b0: (Vh + (Vb * K) / Q + K * K) / a0, b1: (2 * (K * K - Vh)) / a0, b2: (Vh - (Vb * K) / Q + K * K) / a0, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / fs);
  a0 = 1 + K / Q + K * K;
  const hp = { b0: 1, b1: -2, b2: 1, a1: (2 * (K * K - 1)) / a0, a2: (1 - K / Q + K * K) / a0 };
  return [shelf, hp];
}

/** Streaming integrated loudness (LUFS) for 1–2 channels (L/R weight 1). */
export class LoudnessMeter {
  readonly sampleRate: number;
  readonly channels: number;
  private readonly f: [Biquad, Biquad];
  private readonly z: Float64Array; // per channel: s1 x1,x2,y1,y2 ; s2 x1,x2,y1,y2
  private readonly hop: number;
  private acc = 0;
  private accN = 0;
  private readonly hops: number[] = [];

  constructor(sampleRate: number, channels: number) {
    this.sampleRate = sampleRate;
    this.channels = channels;
    this.f = kWeighting(sampleRate);
    this.z = new Float64Array(channels * 8);
    this.hop = Math.round(sampleRate * 0.1);
  }

  /** Push planar frames (all channels same length). */
  push(planes: Float32Array[]): void {
    const n = planes[0]?.length ?? 0;
    const [s, h] = this.f, z = this.z;
    for (let i = 0; i < n; i++) {
      let sum = 0;
      for (let c = 0; c < this.channels; c++) {
        const o = c * 8, x = planes[c][i];
        const y1 = s.b0 * x + s.b1 * z[o] + s.b2 * z[o + 1] - s.a1 * z[o + 2] - s.a2 * z[o + 3];
        z[o + 1] = z[o]; z[o] = x; z[o + 3] = z[o + 2]; z[o + 2] = y1;
        const y2 = h.b0 * y1 + h.b1 * z[o + 4] + h.b2 * z[o + 5] - h.a1 * z[o + 6] - h.a2 * z[o + 7];
        z[o + 5] = z[o + 4]; z[o + 4] = y1; z[o + 7] = z[o + 6]; z[o + 6] = y2;
        sum += y2 * y2;
      }
      this.acc += sum;
      if (++this.accN === this.hop) {
        this.hops.push(this.acc / this.hop);
        this.acc = 0;
        this.accN = 0;
      }
    }
  }

  /** Integrated loudness in LUFS (−Infinity for silence / < 400 ms). */
  integrated(): number {
    const blocks: number[] = [];
    for (let i = 0; i + 4 <= this.hops.length; i++) blocks.push((this.hops[i] + this.hops[i + 1] + this.hops[i + 2] + this.hops[i + 3]) / 4);
    const L = (ms: number) => -0.691 + 10 * Math.log10(ms);
    const abs = blocks.filter((b) => b > 0 && L(b) > -70);
    if (!abs.length) return -Infinity;
    const rel = L(abs.reduce((a, b) => a + b, 0) / abs.length) - 10;
    const gated = abs.filter((b) => L(b) > rel);
    return gated.length ? L(gated.reduce((a, b) => a + b, 0) / gated.length) : -Infinity;
  }
}

/** Gain (linear) that brings `lufs` to `target`, capped at ±maxDb (silence → 1). */
export function loudnessGain(lufs: number, target = -16, maxDb = 24): number {
  if (!Number.isFinite(lufs)) return 1;
  return 10 ** (Math.max(-maxDb, Math.min(maxDb, target - lufs)) / 20);
}

/**
 * Look-ahead limiter: min-hold over L frames → L-frame boxcar → release smoothing, applied to the input
 * delayed by L−1 frames. The boxcar of the min-hold is ≤ the needed gain at the delayed sample, so no output
 * sample exceeds the ceiling. Output lags input by `latency` frames; call flush() at the end to drain.
 */
export class Limiter {
  readonly channels: number;
  readonly latency: number;
  private readonly L: number;
  private readonly ceiling: number;
  private readonly rel: number;
  private readonly delay: Float32Array[];
  private readonly minIdx: Float64Array;
  private readonly minVal: Float64Array;
  private head = 0;
  private tail = 0;
  private readonly box: Float64Array;
  private boxSum: number;
  private n = 0;
  private g = 1;
  private readonly preGain: number;

  constructor(opts: { sampleRate: number; channels: number; ceilingDb?: number; lookaheadMs?: number; releaseMs?: number; preGain?: number }) {
    this.channels = opts.channels;
    this.L = Math.max(2, Math.round((opts.sampleRate * (opts.lookaheadMs ?? 5)) / 1000));
    this.latency = this.L - 1;
    this.ceiling = 10 ** ((opts.ceilingDb ?? -1) / 20);
    this.rel = 1 - Math.exp(-1 / ((opts.sampleRate * (opts.releaseMs ?? 80)) / 1000));
    this.delay = Array.from({ length: opts.channels }, () => new Float32Array(this.L));
    this.minIdx = new Float64Array(this.L + 1);
    this.minVal = new Float64Array(this.L + 1);
    this.box = new Float64Array(this.L).fill(1);
    this.boxSum = this.L;
    this.preGain = opts.preGain ?? 1;
  }

  /** Process planar input; returns planar output of the same length (delayed by `latency`). */
  process(planes: Float32Array[]): Float32Array[] {
    const n = planes[0]?.length ?? 0;
    const out = Array.from({ length: this.channels }, () => new Float32Array(n));
    for (let i = 0; i < n; i++) this.step(planes, i, out, i);
    return out;
  }

  /** Drain the last `latency` frames. */
  flush(): Float32Array[] {
    const zeros = Array.from({ length: this.channels }, () => new Float32Array(this.latency));
    return this.process(zeros);
  }

  private step(inp: Float32Array[], i: number, out: Float32Array[], j: number) {
    const L = this.L, cap = L + 1;
    let peak = 0;
    const slot = this.n % L;
    // read the delayed sample (L−1 frames ago) before overwriting: it sits in the slot after the write slot
    const read = (this.n + 1) % L;
    for (let c = 0; c < this.channels; c++) {
      const x = inp[c][i] * this.preGain;
      this.delay[c][slot] = x;
      const a = Math.abs(x);
      if (a > peak) peak = a;
    }
    const need = peak > this.ceiling ? this.ceiling / peak : 1;
    // sliding minimum over the last L values (monotonic deque)
    while (this.tail !== this.head && this.minVal[(this.tail - 1 + cap) % cap] >= need) this.tail = (this.tail - 1 + cap) % cap;
    this.minIdx[this.tail] = this.n;
    this.minVal[this.tail] = need;
    this.tail = (this.tail + 1) % cap;
    while (this.minIdx[this.head] <= this.n - L) this.head = (this.head + 1) % cap;
    const m = this.minVal[this.head];
    this.boxSum += m - this.box[slot];
    this.box[slot] = m;
    const b = Math.min(1, this.boxSum / L);
    this.g = b < this.g ? b : this.g + (b - this.g) * this.rel;
    if (this.g > b) this.g = b;
    const g = this.g;
    for (let c = 0; c < this.channels; c++) {
      // before the delay line fills, `read` holds the initial zeros
      const x = this.delay[c][read];
      let y = x * g;
      if (y > this.ceiling) y = this.ceiling;
      else if (y < -this.ceiling) y = -this.ceiling;
      out[c][j] = y;
    }
    this.n++;
  }
}
