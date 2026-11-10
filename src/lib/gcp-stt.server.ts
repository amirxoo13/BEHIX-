/**
 * Speech-to-Text v2 `Recognize` with chirp_2 fa-IR word time offsets, server side only.
 * It is used to time a TTS clip's words for lip-sync; the client never sees credentials.
 *
 * Official docs (fetched 2026-11-10):
 *  - Method: https://docs.cloud.google.com/speech-to-text/docs/reference/rest/v2/projects.locations.recognizers/recognize
 *    "POST https://speech.googleapis.com/v2/{recognizer=projects/*\/locations/*\/recognizers/*}:recognize"
 *    "The {recognizer} segment may be set to _ to use an empty implicit Recognizer."
 *    Body { config: RecognitionConfig, content: base64 }. The response is results[].alternatives[].words[]
 *    with WordInfo { startOffset, endOffset (Duration, e.g. "3.5s"), word, confidence }.
 *    "This field is only set if enableWordTimeOffsets is true and only in the top hypothesis."
 *    IAM permission: speech.recognizers.recognize.
 *  - RecognitionConfig / RecognitionFeatures: https://docs.cloud.google.com/speech-to-text/docs/reference/rest/v2/projects.locations.recognizers
 *    autoDecodingConfig "Automatically detect decoding parameters. Preferred for supported formats." (WAV has a RIFF header).
 *    features.enableWordTimeOffsets / enableWordConfidence: "If true, the top result includes a list of words and …".
 *  - Chirp 2: https://docs.cloud.google.com/speech-to-text/docs/models/chirp-2
 *    Regional endpoint "<region>-speech.googleapis.com". Regions us-central1, europe-west4, asia-southeast1
 *    are "Private GA". "Speech.Recognize (good for short audio < 1 min)". `auto_decoding_config` and
 *    `enable_word_time_offsets` are as in the doc sample.
 *  - Languages: https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages
 *    "Persian (Iran) fa-IR chirp_2" in europe-west4 / us-central1 / asia-southeast1, with "Word-level confidence".
 * Times come out in SECONDS. Nothing here uses milliseconds except the request timeout.
 */
import type { TimedWord } from "../studio/v2/viseme-timeline.ts";

export const STT_DOCS_URL = "https://docs.cloud.google.com/speech-to-text/docs/reference/rest/v2/projects.locations.recognizers/recognize";
/** Synchronous Recognize is for audio shorter than 1 minute (chirp_2 page); keep a margin. */
export const STT_MAX_SECONDS = 55;

export type SttConfig = { location: string; model: string; enabled: boolean };

/** Env: STT_LOCATION (default europe-west4), STT_MODEL (default chirp_2), STT_ENABLED=off disables STT timing. */
export function sttConfig(env: Record<string, string | undefined> = process.env): SttConfig {
  return {
    location: env.STT_LOCATION?.trim() || "europe-west4",
    model: env.STT_MODEL?.trim() || "chirp_2",
    enabled: !/^(0|off|false|no)$/i.test(env.STT_ENABLED?.trim() ?? ""),
  };
}

export const sttHost = (location: string) => (location === "global" ? "speech.googleapis.com" : `${location}-speech.googleapis.com`);

/** The implicit recognizer `_` means no Recognizer resource has to be created first. */
export function sttUrl(project: string, location: string): string {
  return `https://${sttHost(location)}/v2/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/recognizers/_:recognize`;
}

/** Recognize body for a WAV (LINEAR16 with RIFF header) clip; the header is auto-decoded. */
export function buildSttRequest(wav: Uint8Array, model = "chirp_2", languageCode = "fa-IR") {
  return {
    config: {
      autoDecodingConfig: {},
      languageCodes: [languageCode],
      model,
      features: { enableWordTimeOffsets: true, enableWordConfidence: true },
    },
    content: Buffer.from(wav).toString("base64"),
  };
}

/** Duration JSON ("1.500s", or {seconds, nanos}) → seconds; NaN when unreadable. */
export function durationSeconds(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const m = /^(-?\d+(?:\.\d+)?)s$/.exec(v.trim());
    return m ? Number(m[1]) : NaN;
  }
  if (v && typeof v === "object") {
    const o = v as { seconds?: string | number; nanos?: number };
    return Number(o.seconds ?? 0) + Number(o.nanos ?? 0) / 1e9;
  }
  return NaN;
}

type WordInfo = { startOffset?: unknown; endOffset?: unknown; word?: string; confidence?: number };
type RecognizeResponse = { results?: { alternatives?: { transcript?: string; words?: WordInfo[] }[] }[] };

/**
 * Words of the top hypothesis of every result, in seconds, sorted.
 * A missing startOffset counts as 0. This is an assumption from proto3 JSON, which omits default values, so a word
 * at 0 s may have none. Words with no end, or end ≤ start, are dropped.
 * A confidence of 0 is the documented "not set" sentinel, so it is left out.
 */
export function parseSttResponse(json: unknown): TimedWord[] {
  const out: TimedWord[] = [];
  for (const r of (json as RecognizeResponse | null)?.results ?? []) {
    for (const w of r.alternatives?.[0]?.words ?? []) {
      const text = (w.word ?? "").trim();
      const start = w.startOffset === undefined ? 0 : durationSeconds(w.startOffset);
      const end = durationSeconds(w.endOffset);
      if (!text || !(end > start) || !Number.isFinite(start)) continue;
      const tw: TimedWord = { text, start: round(start), end: round(end), source: "stt-words" };
      if (typeof w.confidence === "number" && w.confidence > 0) tw.confidence = Math.round(w.confidence * 1000) / 1000;
      out.push(tw);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

const round = (t: number) => Math.round(t * 1000) / 1000;

export class SttError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/** One Recognize call. Throws SttError on HTTP errors, bad JSON or audio that is too long. */
export async function recognizeWords(opts: {
  project: string;
  wav: Uint8Array;
  seconds: number;
  headers: Record<string, string>;
  config?: SttConfig;
  fetchImpl?: typeof fetch;
}): Promise<TimedWord[]> {
  const cfg = opts.config ?? sttConfig();
  if (opts.seconds > STT_MAX_SECONDS) throw new SttError(`clip too long for sync Recognize (${opts.seconds.toFixed(1)} s)`);
  const r = await (opts.fetchImpl ?? fetch)(sttUrl(opts.project, cfg.location), {
    method: "POST",
    headers: { ...opts.headers, "x-goog-user-project": opts.project, "content-type": "application/json" },
    body: JSON.stringify(buildSttRequest(opts.wav, cfg.model)),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new SttError(`stt ${r.status}: ${(await r.text()).slice(0, 300)}`, r.status);
  return parseSttResponse(await r.json());
}
