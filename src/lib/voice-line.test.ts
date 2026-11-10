import { test } from "node:test";
import assert from "node:assert/strict";
import { pcmToWav } from "./gemini-tts.server.ts";
import { audioName, lineHash, timelineName, voiceLine, wavSamples, type VoiceDeps } from "./voice-line.server.ts";

const TTS = { location: "global", model: "gemini-3.8-flash-tts", previewModel: "gemini-3.8-flash-lite-tts", fallback: true };
const STT = { location: "europe-west4", model: "chirp_2", enabled: true };

/** 1 s at 24 kHz: 0.2–0.5 s and 0.6–0.9 s voiced (a 200 Hz tone), the rest silent. */
function wav(): Uint8Array {
  const rate = 24000, n = rate;
  const pcm = new Uint8Array(n * 2), v = new DataView(pcm.buffer);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const on = (t > 0.2 && t < 0.5) || (t > 0.6 && t < 0.9);
    v.setInt16(i * 2, on ? Math.round(Math.sin(2 * Math.PI * 200 * t) * 12000) : 0, true);
  }
  return pcmToWav(pcm, rate);
}

function fakes(over: Partial<VoiceDeps> = {}) {
  const store = new Map<string, Uint8Array>();
  const calls = { synth: 0, stt: 0, reserved: 0, refunded: 0 };
  const deps: VoiceDeps = {
    tts: TTS,
    stt: STT,
    get: async (n) => store.get(n) ?? null,
    put: async (n, b) => { store.set(n, typeof b === "string" ? new TextEncoder().encode(b) : b); },
    synth: async (models) => { calls.synth++; return { bytes: wav(), model: models[0] }; },
    recognize: async () => { calls.stt++; return [{ text: "سلام", start: 0.2, end: 0.5, confidence: 0.9, source: "stt-words" }, { text: "دنیا", start: 0.6, end: 0.9, confidence: 0.8, source: "stt-words" }]; },
    reserve: async (cost) => { calls.reserved += cost; return { refund: async (n) => { calls.refunded += n; } }; },
    audioUrl: (n) => `/api/voice?clip=${n.slice(4)}`,
    log: () => {},
    ...over,
  };
  return { deps, store, calls };
}

const line = { id: "b1", text: "سلام دنیا", voice: "Kore", style: "calm; natural, colloquial Tehrani Persian" };

test("wavSamples decodes PCM16 to floats", () => {
  const { samples, sampleRate } = wavSamples(wav());
  assert.equal(sampleRate, 24000);
  assert.equal(samples.length, 24000);
  assert.ok(Math.max(...samples.subarray(4800, 12000)) > 0.3);
});

test("miss: TTS + STT, weighted cost 2, timeline from stt-words, both cached under one hash", async () => {
  const { deps, store, calls } = fakes();
  const out = await voiceLine(line, deps);
  assert.ok("timeline" in out);
  assert.equal(out.cache, "miss");
  assert.equal(out.timeline.timing, "stt-words");
  assert.equal(out.timeline.aligner?.model, "chirp_2");
  assert.deepEqual([calls.synth, calls.stt, calls.reserved, calls.refunded], [1, 1, 2, 0]);
  const h = await lineHash(TTS.model, line.voice, line.style, line.text);
  assert.equal(out.timeline.clipKey, h);
  assert.ok(store.has(audioName(h)) && store.has(timelineName(h)));
  assert.equal(out.audioUrl, `/api/voice?clip=${h}.wav`);
});

test("hit: audio + timeline cached → no spend", async () => {
  const { deps, calls } = fakes();
  await voiceLine(line, deps);
  const before = { ...calls };
  const out = await voiceLine(line, deps);
  assert.ok("timeline" in out && out.cache === "hit");
  assert.deepEqual(calls, before);
});

test("audio cached without timeline (old /api/tts clip) → STT only, cost 1", async () => {
  const { deps, store, calls } = fakes();
  const h = await lineHash(TTS.model, line.voice, line.style, line.text);
  store.set(audioName(h), wav());
  const out = await voiceLine(line, deps);
  assert.ok("timeline" in out);
  assert.deepEqual([calls.synth, calls.reserved], [0, 1]);
});

test("STT failure → amplitude timing and the STT unit is refunded", async () => {
  const { deps, calls } = fakes({ recognize: async () => { throw new Error("403"); } });
  const out = await voiceLine(line, deps);
  assert.ok("timeline" in out);
  assert.equal(out.timeline.timing, "amplitude");
  assert.equal(out.timeline.aligner, undefined);
  assert.deepEqual([calls.reserved, calls.refunded], [2, 1]);
});

test("STT disabled → cost 1, amplitude timing", async () => {
  const { deps, calls } = fakes({ stt: { ...STT, enabled: false } });
  const out = await voiceLine(line, deps);
  assert.ok("timeline" in out && out.timeline.timing === "amplitude");
  assert.deepEqual([calls.stt, calls.reserved], [0, 1]);
});

test("TTS failure → per-line error and full refund; quota refusal is fatal", async () => {
  const a = fakes({ synth: async () => { throw new Error("all models failed"); } });
  const out = await voiceLine(line, a.deps);
  assert.ok("error" in out && !out.fatal);
  assert.deepEqual([a.calls.reserved, a.calls.refunded], [2, 2]);
  const b = fakes({ reserve: async () => ({ refused: "full" }) });
  const r = await voiceLine(line, b.deps);
  assert.ok("error" in r && r.fatal === true);
});

test("preview line uses Flash-Lite first and finds its cache", async () => {
  const { deps } = fakes();
  const out = await voiceLine({ ...line, preview: true }, deps);
  assert.ok("model" in out && out.model === TTS.previewModel);
});
