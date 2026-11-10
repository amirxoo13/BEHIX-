/**
 * Browser renderer for a FilmMix → 48 kHz stereo PCM, streamed to a sink (e.g. mediabunny AudioSampleSource).
 *
 *  - Chunked: each segment (10–30 s, mix-dsp.planSegments) is its own OfflineAudioContext, so a 5 min film never
 *    holds more than one segment of PCM on a phone. Segments after the first render with a short pre-roll that is
 *    discarded, so resampler/source state at the seam matches a continuous render.
 *  - Two-pass loudness: pass 1 renders and measures BS.1770 integrated loudness (no output kept); pass 2 renders
 *    again, applies the gain to `target.lufs` (−16) and the look-ahead limiter (−1 dB ceiling, state carried across
 *    segments), then streams frames to the sink in order.
 *  - Ducking: music/ambience buses follow mix.duckCurve, written as a 100 Hz value curve per segment.
 * Not wired into the export UI yet (see audio workflow SKILL.md → integration points).
 */
import type { AudioSampleSource } from "mediabunny";
import { clipGainPoints, clipsIn, curveSlice, dbToGain, duckCurve, duckIntervals, gainAt, MIX_BUSES, type FilmMix, type MixBus } from "./mix.ts";
import { Limiter, LoudnessMeter, loudnessGain, planSegments, type Segment } from "./mix-dsp.ts";

export type ResolveBuffer = (src: string) => Promise<AudioBuffer | null>;
export type MixSink = (planes: Float32Array[], startFrame: number) => Promise<void>;
export type RenderOptions = { segSeconds?: number; onProgress?: (fraction: number) => void; signal?: AbortSignal; preRoll?: number };
export type RenderResult = { frames: number; measuredLufs: number; gain: number };

const CURVE_HZ = 100;

async function renderSegment(mix: FilmMix, seg: Segment, buffers: Map<string, AudioBuffer>, preRoll: number): Promise<Float32Array[]> {
  const rate = mix.sampleRate;
  const pre = seg.startFrame === 0 ? 0 : Math.min(seg.startFrame, Math.round(preRoll * rate));
  const frames = seg.frames + pre;
  const from = (seg.startFrame - pre) / rate, to = from + frames / rate;
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: frames, sampleRate: rate });
  const duck = duckCurve(duckIntervals(mix.clips, mix.duck.mergeGap, mix.duration), mix.duck);
  const buses = new Map<MixBus, GainNode>();
  for (const b of MIX_BUSES) {
    const g = ctx.createGain();
    g.gain.value = dbToGain(mix.busDb[b]);
    let node: AudioNode = g;
    if (mix.duck.buses.includes(b) && duck.length > 1) {
      const d = ctx.createGain();
      const slice = curveSlice(duck, from, to);
      const n = Math.max(2, Math.ceil((to - from) * CURVE_HZ) + 1);
      const values = new Float32Array(n);
      for (let i = 0; i < n; i++) values[i] = dbToGain(gainAt(slice, ((to - from) * i) / (n - 1)));
      d.gain.setValueCurveAtTime(values, 0, to - from);
      g.connect(d);
      node = d;
    }
    node.connect(ctx.destination);
    buses.set(b, g);
  }
  for (const c of clipsIn(mix, from, to)) {
    const buf = buffers.get(c.src);
    if (!buf) continue;
    const pts = clipGainPoints(c, from, to);
    if (!pts.length) continue;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const env = ctx.createGain();
    env.gain.setValueAtTime(pts[0].g, pts[0].t);
    for (const p of pts.slice(1)) env.gain.linearRampToValueAtTime(p.g, p.t);
    src.connect(env).connect(buses.get(c.bus)!);
    const local = c.start - from;
    const skip = Math.max(0, -local);
    const when = Math.max(0, local);
    const remaining = c.duration - skip;
    if (c.loop) {
      src.loop = true;
      src.start(when, (c.offset + skip) % buf.duration);
      src.stop(when + remaining);
    } else src.start(when, c.offset + skip, remaining);
  }
  const out = await ctx.startRendering();
  return [out.getChannelData(0).subarray(pre), out.getChannelData(1).subarray(pre)];
}

/** Decode every distinct clip source once (missing sources are skipped, so a lost clip is silence, not a crash). */
async function loadBuffers(mix: FilmMix, resolve: ResolveBuffer): Promise<Map<string, AudioBuffer>> {
  const out = new Map<string, AudioBuffer>();
  for (const src of new Set(mix.clips.map((c) => c.src))) {
    const b = await resolve(src).catch(() => null);
    if (b) out.set(src, b);
  }
  return out;
}

export async function renderMix(mix: FilmMix, resolve: ResolveBuffer, sink: MixSink, opts: RenderOptions = {}): Promise<RenderResult> {
  const rate = mix.sampleRate, segs = planSegments(mix.duration, rate, opts.segSeconds ?? 20);
  const total = segs.reduce((a, s) => a + s.frames, 0);
  const preRoll = opts.preRoll ?? 0.1;
  const buffers = await loadBuffers(mix, resolve);
  const check = () => {
    if (opts.signal?.aborted) throw opts.signal.reason ?? new DOMException("Aborted", "AbortError");
  };
  // pass 1: measure
  const meter = new LoudnessMeter(rate, 2);
  for (const s of segs) {
    check();
    meter.push(await renderSegment(mix, s, buffers, preRoll));
    opts.onProgress?.((s.startFrame + s.frames) / total / 2);
  }
  const measuredLufs = meter.integrated();
  const gain = loudnessGain(measuredLufs, mix.target.lufs);
  // pass 2: gain + limiter, emitted in order; the limiter's latency is trimmed so output frame i = film frame i
  const lim = new Limiter({ sampleRate: rate, channels: 2, ceilingDb: mix.target.ceilingDb, preGain: gain });
  let skip = lim.latency, written = 0;
  const emit = async (planes: Float32Array[]) => {
    const cut = Math.min(skip, planes[0].length);
    skip -= cut;
    const p = cut ? planes.map((x) => x.subarray(cut)) : planes;
    const n = Math.min(p[0].length, total - written);
    if (n <= 0) return;
    await sink(n < p[0].length ? p.map((x) => x.subarray(0, n)) : p, written);
    written += n;
  };
  for (const s of segs) {
    check();
    await emit(lim.process(await renderSegment(mix, s, buffers, preRoll)));
    opts.onProgress?.(0.5 + (s.startFrame + s.frames) / total / 2);
  }
  await emit(lim.flush());
  return { frames: written, measuredLufs, gain };
}

/** Sink that feeds a mediabunny AudioSampleSource (f32-planar), respecting encoder backpressure. */
export async function mediabunnySink(source: AudioSampleSource, sampleRate: number): Promise<MixSink> {
  const { AudioSample } = await import("mediabunny");
  return async (planes, startFrame) => {
    const n = planes[0].length;
    const data = new Float32Array(n * planes.length);
    planes.forEach((p, c) => data.set(p, c * n));
    const sample = new AudioSample({ data, format: "f32-planar", numberOfChannels: planes.length, sampleRate, timestamp: startFrame / sampleRate });
    try {
      await source.add(sample);
    } finally {
      sample.close();
    }
  };
}
