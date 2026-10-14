import type { SfxId, Viseme } from "./types";

let ctx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let voiceOn = false;
let recDest: MediaStreamAudioDestinationNode | null = null;
const active: AudioBufferSourceNode[] = [];

function context(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setRecordDest(node: MediaStreamAudioDestinationNode | null) {
  if (analyser && recDest) {
    try {
      analyser.disconnect(recDest);
    } catch {
      /* already disconnected */
    }
  }
  recDest = node;
  if (analyser && node) analyser.connect(node);
}

function out(node: AudioNode) {
  if (offline) {
    node.connect(offline.ctx.destination);
    return;
  }
  const c = context();
  node.connect(c.destination);
  if (recDest) node.connect(recDest);
}

let voiceToken = 0;

/**
 * T08: offline render target. While set, `playSfx` schedules into this
 * OfflineAudioContext at `at` seconds instead of playing live.
 */
let offline: { ctx: OfflineAudioContext; at: number } | null = null;

function sfxCtx(): BaseAudioContext {
  return offline ? offline.ctx : context();
}

export function stopAll() {
  voiceToken += 1;
  voiceOn = false;
  for (const src of active) {
    try {
      src.stop();
    } catch {
      /* already stopped */
    }
  }
  active.length = 0;
}

function noise(seconds: number) {
  const c = sfxCtx();
  const buffer = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

export function playSfx(id: SfxId) {
  if (id === "none") return;
  const c = sfxCtx();
  const now = offline ? offline.at : c.currentTime;
  if (id === "beep") {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1000, now);
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.45);
    osc.connect(gain);
    out(gain);
    osc.start(now);
    osc.stop(now + 0.46);
    return;
  }
  if (id === "slap") {
    const src = c.createBufferSource();
    src.buffer = noise(0.18);
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1600, now);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    src.connect(filter);
    filter.connect(gain);
    out(gain);
    src.start(now);
    return;
  }
  if (id === "shock") {
    const notes = [220, 196, 146.8];
    const times = [0, 0.2, 0.42];
    const durs = [0.18, 0.18, 0.7];
    notes.forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now + times[i]);
      gain.gain.setValueAtTime(0.2, now + times[i]);
      gain.gain.exponentialRampToValueAtTime(0.001, now + times[i] + durs[i]);
      osc.connect(gain);
      out(gain);
      osc.start(now + times[i]);
      osc.stop(now + times[i] + durs[i]);
    });
    return;
  }
  if (id === "crickets") {
    for (let i = 0; i < 6; i++) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      const t = now + i * 0.13;
      osc.frequency.setValueAtTime(4200, t);
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(gain);
      out(gain);
      osc.start(t);
      osc.stop(t + 0.08);
    }
    return;
  }
  if (id === "rimshot") {
    const hit = (freq: number, t: number, dur: number) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + dur);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      out(gain);
      osc.start(t);
      osc.stop(t + dur);
    };
    hit(150, now, 0.12);
    hit(200, now + 0.16, 0.16);
    const src = c.createBufferSource();
    src.buffer = noise(0.2);
    const filter = c.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 4000;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.25, now + 0.32);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    src.connect(filter);
    filter.connect(gain);
    out(gain);
    src.start(now + 0.32);
    return;
  }
  if (id === "horn") {
    [0, 0.18].forEach((t, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(i === 0 ? 466 : 415, now + t);
      gain.gain.setValueAtTime(0.12, now + t);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.14);
      osc.connect(gain);
      out(gain);
      osc.start(now + t);
      osc.stop(now + t + 0.15);
    });
    return;
  }
  if (id === "clink") {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(2100, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    out(gain);
    osc.start(now);
    osc.stop(now + 0.2);
    return;
  }
  const src = c.createBufferSource();
  src.buffer = noise(0.25);
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(400, now);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
  src.connect(filter);
  filter.connect(gain);
  out(gain);
  src.start(now);
  const creak = c.createOscillator();
  const cg = c.createGain();
  creak.frequency.setValueAtTime(180, now);
  creak.frequency.linearRampToValueAtTime(90, now + 0.3);
  cg.gain.setValueAtTime(0.08, now);
  cg.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  creak.connect(cg);
  out(cg);
  creak.start(now);
  creak.stop(now + 0.32);
}

export async function playUrl(url: string, pitch: number) {
  const my = voiceToken;
  const c = context();
  if (!analyser) return;
  const res = await fetch(url);
  if (my !== voiceToken) return;
  const arr = await res.arrayBuffer();
  const buf = await c.decodeAudioData(arr.slice(0));
  if (my !== voiceToken) return;
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = pitch;
  src.connect(analyser);
  voiceOn = true;
  src.onended = () => {
    if (my === voiceToken) voiceOn = false;
  };
  active.push(src);
  src.start();
}

export async function resumeAudio() {
  const c = context();
  if (c.state === "suspended") await c.resume();
}

export function openRecordBus() {
  const c = context();
  const dest = c.createMediaStreamDestination();
  setRecordDest(dest);
  return dest;
}

export function readMouth(): { viseme: Viseme; open: number } | null {
  if (!analyser || !voiceOn) return null;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  const hz = context().sampleRate / analyser.fftSize;
  const band = (f0: number, f1: number) => {
    const a = Math.max(0, Math.floor(f0 / hz));
    const b = Math.min(data.length - 1, Math.ceil(f1 / hz));
    if (b <= a) return 0;
    let sum = 0;
    for (let i = a; i <= b; i++) sum += data[i];
    return sum / (b - a + 1);
  };
  const low = band(140, 900);
  const high = band(1800, 5200);
  const open = Math.min(1, (low + high) / 260);
  let viseme: Viseme = "rest";
  if (open < 0.08) viseme = "rest";
  else if (open > 0.72) viseme = "shout";
  else if (high > low * 0.85) viseme = "ee";
  else if (low > 70 && high < 32) viseme = "oo";
  else if (open > 0.26) viseme = "ah";
  else viseme = "fv";
  return { viseme, open };
}

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let micStream: MediaStream | null = null;

export async function startMic() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  micStream = stream;
  chunks = [];
  const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
  try {
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  } catch (err) {
    // BUG-06: اگر ضبط‌کننده ساخته نشد، میکروفون باز نماند.
    stream.getTracks().forEach((t) => t.stop());
    micStream = null;
    recorder = null;
    throw err;
  }
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.start();
}

export function stopMic(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!recorder) {
      reject(new Error("میکروفون فعال نیست"));
      return;
    }
    recorder.onstop = () => {
      const type = recorder?.mimeType || "audio/webm";
      micStream?.getTracks().forEach((t) => t.stop());
      recorder = null;
      resolve(new Blob(chunks, { type }));
    };
    recorder.stop();
  });
}

export function pickVideoMime() {
  // T08-v2: ask for H.264 explicitly — a bare "video/mp4" lets Chrome put VP9/Opus in MP4.
  const types = [
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4;codecs=avc1,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

/** One audio event of the film timeline (seconds from film start). */
export type MixCue = { at: number; end: number; sfx: SfxId; url?: string; pitch: number };

/**
 * T08: render the film's whole soundtrack faster than real time with the same
 * synth code as live playback. Voices stop at their shot's end, matching
 * `stopAll()` on shot change during live playback.
 */
export async function renderMixOffline(
  cues: MixCue[],
  seconds: number,
  sampleRate = 48_000,
): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil(seconds * sampleRate));
  const octx = new OfflineAudioContext(2, length, sampleRate);
  const decoded = new Map<string, AudioBuffer>();
  for (const cue of cues) {
    if (!cue.url || decoded.has(cue.url)) continue;
    const arr = await (await fetch(cue.url)).arrayBuffer();
    decoded.set(cue.url, await octx.decodeAudioData(arr));
  }
  try {
    for (const cue of cues) {
      if (cue.sfx !== "none") {
        offline = { ctx: octx, at: cue.at };
        playSfx(cue.sfx);
        offline = null;
      }
      const buf = cue.url ? decoded.get(cue.url) : undefined;
      if (buf) {
        const src = octx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = cue.pitch;
        src.connect(octx.destination);
        src.start(cue.at);
        src.stop(Math.max(cue.at, cue.end));
      }
    }
  } finally {
    offline = null;
  }
  return octx.startRendering();
}
