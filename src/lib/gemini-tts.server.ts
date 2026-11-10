/**
 * Gemini 3.8 TTS on Agent Platform (`generateContent`), server side only.
 *
 * Request/response shape, endpoints and output format are taken from the official page
 * https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/text-to-speech/overview
 * (fetched 2026-11-10):
 *  - POST https://{host}/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent
 *    hosts: global → aiplatform.googleapis.com, us → aiplatform.us.rep.googleapis.com, eu → aiplatform.eu.rep.googleapis.com
 *  - body: contents[].parts[] = { text, speechMetadata: { style } },
 *          generationConfig = { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { voice } } }
 *  - "By default, unary requests return a complete WAV file (16-bit PCM, 24 kHz, mono)" in
 *    candidates[0].content.parts[0].inlineData.data (base64). Streaming/AUDIO_L16 is headerless PCM,
 *    so `ensureWav` wraps anything without a RIFF header.
 * Credentials: a Bearer token from ADC (`gcp-auth.server.ts`); no key ever reaches the client.
 * Everything except `synthesizeGemini` is pure and covered by `gemini-tts.test.ts`.
 */

export const TTS_DOCS_URL = "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/text-to-speech/overview";
export const DEFAULT_TTS_MODEL = "gemini-3.8-flash-tts";
export const DEFAULT_TTS_PREVIEW_MODEL = "gemini-3.8-flash-lite-tts";
export const TTS_SAMPLE_RATE = 24000;

export type TtsConfig = { location: string; model: string; previewModel: string; fallback: boolean };

/** Settings from env: TTS_LOCATION (default global), TTS_MODEL, TTS_PREVIEW_MODEL, TTS_FALLBACK=off disables Flash → Flash-Lite. */
export function ttsConfig(env: Record<string, string | undefined> = process.env): TtsConfig {
  const pick = (v: string | undefined, d: string) => v?.trim() || d;
  return {
    location: pick(env.TTS_LOCATION, "global"),
    model: pick(env.TTS_MODEL, DEFAULT_TTS_MODEL),
    previewModel: pick(env.TTS_PREVIEW_MODEL, DEFAULT_TTS_PREVIEW_MODEL),
    fallback: !/^(0|off|false|no)$/i.test(env.TTS_FALLBACK?.trim() ?? ""),
  };
}

/** Models to try in order: previews use only the preview model; full lines go Flash → Flash-Lite. */
export function modelChain(cfg: TtsConfig, preview = false): string[] {
  if (preview) return [cfg.previewModel];
  return cfg.fallback && cfg.previewModel !== cfg.model ? [cfg.model, cfg.previewModel] : [cfg.model];
}

export function ttsHost(location: string): string {
  if (location === "global") return "aiplatform.googleapis.com";
  if (location === "us" || location === "eu") return `aiplatform.${location}.rep.googleapis.com`;
  return `${location}-aiplatform.googleapis.com`;
}

export function ttsUrl(project: string, location: string, model: string): string {
  return `https://${ttsHost(location)}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;
}

/** Request body for one single-speaker line. The style prompt goes in `speechMetadata.style`. */
export function buildTtsRequest(text: string, voice: string, style?: string) {
  const part: { text: string; speechMetadata?: { style: string } } = { text };
  if (style?.trim()) part.speechMetadata = { style: style.trim() };
  return {
    contents: [{ role: "user", parts: [part] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { voice } } },
  };
}

type InlineData = { data?: string; mimeType?: string };
type TtsResponse = { candidates?: { content?: { parts?: { inlineData?: InlineData; inline_data?: InlineData & { mime_type?: string } }[] } }[] };

/** All audio parts of the first candidate, concatenated. null when the response has no audio. */
export function audioFromResponse(json: unknown): { bytes: Uint8Array; mimeType: string } | null {
  const parts = (json as TtsResponse | null)?.candidates?.[0]?.content?.parts ?? [];
  const chunks: Uint8Array[] = [];
  let mimeType = "";
  for (const p of parts) {
    const d = p.inlineData ?? p.inline_data;
    if (!d?.data) continue;
    chunks.push(Uint8Array.from(Buffer.from(d.data, "base64")));
    mimeType ||= d.mimeType ?? (d as { mime_type?: string }).mime_type ?? "";
  }
  if (!chunks.length) return null;
  // Several WAV parts cannot simply be appended; keep the first file's header and append PCM bodies.
  if (chunks.length > 1 && isWav(chunks[0])) {
    const pcm = chunks.map((c) => (isWav(c) ? wavPcm(c).pcm : c));
    return { bytes: pcmToWav(concat(pcm), wavPcm(chunks[0]).sampleRate), mimeType: "audio/wav" };
  }
  return { bytes: concat(chunks), mimeType };
}

const concat = (chunks: Uint8Array[]) => {
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
};

export const isWav = (b: Uint8Array) => b.length >= 12 && String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WAVE";

/** PCM body and sample rate of a WAV file (first `data` chunk). */
export function wavPcm(b: Uint8Array): { pcm: Uint8Array; sampleRate: number } {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let sampleRate = TTS_SAMPLE_RATE;
  for (let at = 12; at + 8 <= b.length; ) {
    const id = String.fromCharCode(...b.subarray(at, at + 4));
    const size = v.getUint32(at + 4, true);
    if (id === "fmt " && at + 16 <= b.length) sampleRate = v.getUint32(at + 12, true);
    if (id === "data") return { pcm: b.subarray(at + 8, Math.min(b.length, at + 8 + size)), sampleRate };
    at += 8 + size + (size % 2);
  }
  return { pcm: new Uint8Array(0), sampleRate };
}

/** 44-byte RIFF/WAVE header + 16-bit little-endian PCM. */
export function pcmToWav(pcm: Uint8Array, sampleRate = TTS_SAMPLE_RATE, channels = 1): Uint8Array {
  const out = new Uint8Array(44 + pcm.length);
  const v = new DataView(out.buffer);
  const ascii = (at: number, s: string) => { for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i); };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + pcm.length, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

/** Always a playable WAV: RIFF data passes through; raw L16 PCM (rate from `audio/l16;rate=…`) gets a header. */
export function ensureWav(bytes: Uint8Array, mimeType = ""): Uint8Array {
  if (isWav(bytes)) return bytes;
  if (/mpeg|mp3|ogg|opus|mulaw|alaw/i.test(mimeType)) throw new Error(`unexpected TTS audio format ${mimeType}`);
  const rate = Number(/rate=(\d+)/i.exec(mimeType)?.[1] ?? TTS_SAMPLE_RATE);
  return pcmToWav(bytes.length % 2 ? bytes.subarray(0, bytes.length - 1) : bytes, rate);
}

export async function sha256Hex(s: string): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** GCS object for a clip. The model is part of the hash, so every model has its own cache. */
export async function cacheKey(model: string, voice: string, prompt: string, text: string, ext: "wav" | "mp3" = "wav"): Promise<string> {
  return `tts/${await sha256Hex(`${model}|${voice}|${prompt}|${text}`)}.${ext}`;
}

export type TtsAttempt = { model: string; status?: number; error: string };
export class TtsError extends Error {
  readonly attempts: TtsAttempt[];
  constructor(message: string, attempts: TtsAttempt[]) {
    super(message);
    this.attempts = attempts;
  }
}

/** Try each model in order; returns WAV bytes from the first that answers with audio. */
export async function synthesizeGemini(opts: {
  project: string;
  location: string;
  models: string[];
  text: string;
  voice: string;
  style?: string;
  headers: Record<string, string>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<{ bytes: Uint8Array; model: string; mimeType: string; wrapped: boolean }> {
  const doFetch = opts.fetchImpl ?? fetch;
  const attempts: TtsAttempt[] = [];
  for (const model of opts.models) {
    try {
      const r = await doFetch(ttsUrl(opts.project, opts.location, model), {
        method: "POST",
        headers: { ...opts.headers, "x-goog-user-project": opts.project, "content-type": "application/json" },
        body: JSON.stringify(buildTtsRequest(opts.text, opts.voice, opts.style)),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
      });
      if (!r.ok) {
        attempts.push({ model, status: r.status, error: (await r.text()).slice(0, 300) });
        continue;
      }
      const audio = audioFromResponse(await r.json());
      if (!audio) {
        attempts.push({ model, status: r.status, error: "no audio in response" });
        continue;
      }
      return { bytes: ensureWav(audio.bytes, audio.mimeType), model, mimeType: audio.mimeType, wrapped: !isWav(audio.bytes) };
    } catch (e) {
      attempts.push({ model, error: e instanceof Error ? e.message : String(e) });
    }
  }
  throw new TtsError("all TTS models failed", attempts);
}
