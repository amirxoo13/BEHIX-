/**
 * One line of /api/voice: TTS (gemini-3.8) → STT (chirp_2 word offsets) → align.ts → VisemeTimeline.
 * Pure orchestration: every side effect (GCS, Agent Platform, Speech-to-Text, quota) is injected, so the
 * flow is tested in Node with fakes (voice-line.test.ts).
 *
 * Cache layout in TTS_BUCKET (same hash as the device key `voice:<hash>` / `viseme:<hash>`):
 *   tts/<sha256(model|voice|style|text)>.wav           24 kHz mono WAV
 *   tts/<sha256(model|voice|style|text)>.viseme.json   VisemeTimeline (seconds)
 */
import { alignLine } from "../studio/v2/align.ts";
import { repairTimeline, type VisemeTimeline } from "../studio/v2/viseme-timeline.ts";
import { modelChain, sha256Hex, wavPcm, type TtsConfig } from "./gemini-tts.server.ts";
import { STT_MAX_SECONDS, type SttConfig } from "./gcp-stt.server.ts";
import type { TimedWord } from "../studio/v2/viseme-timeline.ts";

export type VoiceLineIn = { id: string; text: string; voice: string; style: string; preview?: boolean };
export type VoiceLineOut =
  | { id: string; audioUrl: string; timeline: VisemeTimeline; model: string; cache: "hit" | "miss" }
  | { id: string; error: string; fatal?: boolean };

export type Reservation = { refund: (cost: number) => Promise<void> };
export type VoiceDeps = {
  tts: TtsConfig;
  stt: SttConfig;
  get: (name: string) => Promise<Uint8Array | null>;
  put: (name: string, body: Uint8Array | string, type: string) => Promise<unknown>;
  synth: (models: string[], text: string, voice: string, style: string) => Promise<{ bytes: Uint8Array; model: string }>;
  recognize: (wav: Uint8Array, seconds: number) => Promise<TimedWord[]>;
  /** Reserve `cost` units (IP limit + daily quota). Returns null with a user message when refused. */
  reserve: (cost: number) => Promise<Reservation | { refused: string }>;
  audioUrl: (name: string, wav: Uint8Array) => string;
  log?: (...a: unknown[]) => void;
};

export const audioName = (hash: string) => `tts/${hash}.wav`;
export const timelineName = (hash: string) => `tts/${hash}.viseme.json`;
export const lineHash = (model: string, voice: string, style: string, text: string) => sha256Hex(`${model}|${voice}|${style}|${text}`);

/** 16-bit PCM WAV → mono float samples (first channel). */
export function wavSamples(wav: Uint8Array): { samples: Float32Array; sampleRate: number } {
  const { pcm, sampleRate } = wavPcm(wav);
  const v = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  const samples = new Float32Array(pcm.byteLength >> 1);
  for (let i = 0; i < samples.length; i++) samples[i] = v.getInt16(i * 2, true) / 32768;
  return { samples, sampleRate };
}

export async function voiceLine(line: VoiceLineIn, deps: VoiceDeps): Promise<VoiceLineOut> {
  const log = deps.log ?? console.error;
  const models = modelChain(deps.tts, line.preview);
  // 1) cached audio (+ timeline) under any model of the chain
  let wav: Uint8Array | null = null, model = "", hash = "";
  for (const m of models) {
    const h = await lineHash(m, line.voice, line.style, line.text);
    const got = await deps.get(audioName(h));
    if (got) { wav = got; model = m; hash = h; break; }
  }
  if (wav) {
    const raw = await deps.get(timelineName(hash));
    const cached = raw ? repairTimeline(safeJson(new TextDecoder().decode(raw))) : undefined;
    if (cached) return { id: line.id, audioUrl: deps.audioUrl(audioName(hash), wav), timeline: cached, model, cache: "hit" };
  }
  // 2) reserve what we will spend: 1 for TTS (if not cached) + 1 for STT (if enabled)
  const cost = (wav ? 0 : 1) + (deps.stt.enabled ? 1 : 0);
  let reservation: Reservation | null = null;
  if (cost > 0) {
    const r = await deps.reserve(cost);
    if ("refused" in r) return { id: line.id, error: r.refused, fatal: true };
    reservation = r;
  }
  let spent = cost;
  const refund = async (n: number) => {
    if (reservation && n > 0) { spent -= n; await reservation.refund(n).catch((e) => log("[voice] refund", e)); }
  };
  if (!wav) {
    try {
      const made = await deps.synth(models, line.text, line.voice, line.style);
      wav = made.bytes;
      model = made.model;
      hash = await lineHash(model, line.voice, line.style, line.text);
      await deps.put(audioName(hash), wav, "audio/wav");
    } catch (e) {
      log("[voice] tts", line.id, e);
      await refund(spent);
      return { id: line.id, error: "ساخت صدای این دیالوگ انجام نشد؛ کمی بعد دوباره امتحان کنید." };
    }
  }
  // 3) timing: STT word offsets, else amplitude/text fallback inside alignLine
  const { samples, sampleRate } = wavSamples(wav);
  const duration = samples.length / sampleRate;
  let words: TimedWord[] | undefined;
  if (deps.stt.enabled) {
    if (duration <= STT_MAX_SECONDS) {
      try {
        words = await deps.recognize(wav, duration);
      } catch (e) {
        log("[voice] stt", line.id, e);
        await refund(1);
      }
    } else await refund(1);
  }
  const timeline = alignLine(
    { text: line.text, duration, sampleRate, samples, stt: words?.map((w) => ({ word: w.text, start: w.start, end: w.end, confidence: w.confidence })) },
    { lineId: line.id, clipKey: hash, voice: { engine: "gemini-tts", model, name: line.voice }, ...(words ? { aligner: { model: deps.stt.model, location: deps.stt.location, matchedWords: 0, totalWords: 0 } } : {}) },
  );
  if (timeline.timing !== "stt-words") delete timeline.aligner;
  await deps.put(timelineName(hash), JSON.stringify(timeline), "application/json");
  return { id: line.id, audioUrl: deps.audioUrl(audioName(hash), wav), timeline, model, cache: cost === 0 ? "hit" : "miss" };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
