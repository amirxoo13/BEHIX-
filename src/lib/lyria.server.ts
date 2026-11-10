/**
 * Lyria 3 Pro music cues (server only), via the Agent Platform Interactions API.
 * Docs (checked 2026-11-10):
 *   https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/music/generate-music
 *   https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/lyria/lyria-3
 * Facts used: POST https://aiplatform.googleapis.com/v1/projects/{p}/locations/global/interactions,
 * body {model:"lyria-3-pro-preview", input:[{type:"user_input",content:[{type:"text",text}]}]};
 * response steps[].content[] with {type:"audio", mime_type:"audio/mpeg", data:<base64>} (and optional text);
 * global only, up to 184 s, one clip per prompt, 44.1 kHz 192 kbps MP3, ~10 RPM, Preview.
 * Instrumental mode, duration, BPM and intensity are set in the prompt text; negative prompts are not supported,
 * so the prompt says what to play (e.g. "instrumental only") rather than what to avoid. Prompts are English
 * (Persian is not a supported prompt language).
 * Disabled unless LYRIA_MODEL is set (e.g. LYRIA_MODEL=lyria-3-pro-preview).
 */
import { sha256Hex } from "./gemini-tts.server.ts";

export const LYRIA_DOCS_URL = "https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/music/generate-music";
export const LYRIA_MAX_SECONDS = 184;
export const LYRIA_LOCATION = "global";

export type LyriaConfig = { model: string; enabled: boolean };
export function lyriaConfig(env: Record<string, string | undefined> = process.env): LyriaConfig {
  const model = (env.LYRIA_MODEL ?? "").trim();
  return { model, enabled: model.length > 0 };
}

export const MUSIC_MOODS = ["calm", "happy", "playful", "tense", "sad", "mysterious", "romantic", "epic", "funny", "hopeful"] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];
export type MusicCue = { mood: MusicMood; style?: string; bpm?: number; seconds: number; intensity?: "low" | "medium" | "high"; instruments?: string };

const MOOD_TEXT: Record<MusicMood, string> = {
  calm: "calm, gentle and warm",
  happy: "bright, cheerful and light",
  playful: "playful and bouncy, cartoon-like",
  tense: "tense and suspenseful, slowly building",
  sad: "sad and tender, slow",
  mysterious: "mysterious and curious, sparse",
  romantic: "romantic and soft",
  epic: "grand and uplifting",
  funny: "comic and quirky, with light pizzicato feel",
  hopeful: "hopeful and rising",
};

/** Only plain English words survive in free-text fields (keeps the prompt in a supported language). */
export const englishOnly = (s: string | undefined, max = 120) => (s ?? "").replace(/[^A-Za-z0-9 ,.'&/-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** English, instrumental, length-bounded prompt for a background cue under dialogue. */
export function musicPrompt(c: MusicCue): string {
  const seconds = Math.round(Math.min(LYRIA_MAX_SECONDS, Math.max(5, c.seconds)));
  const style = englishOnly(c.style) || "light orchestral score for a Persian cartoon, with subtle Persian instruments such as santur and tar";
  const parts = [
    `Instrumental background music for an animated short film scene: ${MOOD_TEXT[c.mood]}.`,
    `Style: ${style}.`,
    englishOnly(c.instruments) ? `Instruments: ${englishOnly(c.instruments)}.` : "",
    c.bpm ? `Tempo around ${Math.round(Math.min(200, Math.max(40, c.bpm)))} BPM.` : "",
    `Intensity: ${c.intensity ?? "low"}, leaving room for dialogue in the mid range.`,
    "Instrumental only, no vocals or singing.",
    `Duration about ${seconds} seconds, with a clean ending.`,
  ];
  return parts.filter(Boolean).join(" ");
}

export const lyriaUrl = (project: string) => `https://aiplatform.googleapis.com/v1/projects/${project}/locations/${LYRIA_LOCATION}/interactions`;

export const buildLyriaRequest = (model: string, prompt: string) => ({ model, input: [{ type: "user_input", content: [{ type: "text", text: prompt }] }] });

export class LyriaError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** First audio part of the interaction (MP3 bytes) plus any text the model returned. */
export function parseLyriaResponse(json: unknown): { mp3: Uint8Array; mimeType: string; text?: string } {
  const j = (json ?? {}) as { status?: string; steps?: { type?: string; content?: { type?: string; text?: string; data?: string; mime_type?: string; mimeType?: string }[] }[] };
  if (j.status && j.status !== "completed") throw new LyriaError(`interaction ${j.status}`);
  let text: string | undefined;
  for (const step of j.steps ?? []) {
    for (const c of step.content ?? []) {
      if (c.type === "text" && c.text) text = (text ? `${text}\n` : "") + c.text;
      if (c.type === "audio" && c.data) return { mp3: b64ToBytes(c.data), mimeType: c.mime_type ?? c.mimeType ?? "audio/mpeg", text };
    }
  }
  throw new LyriaError("no audio in Lyria response");
}

export const musicKey = async (model: string, prompt: string) => `music/${await sha256Hex(`${model}|${prompt}`)}.mp3`;

export async function generateMusic(opts: { project: string; model: string; prompt: string; headers: Record<string, string>; fetchImpl?: typeof fetch; timeoutMs?: number }) {
  const r = await (opts.fetchImpl ?? fetch)(lyriaUrl(opts.project), {
    method: "POST",
    headers: { ...opts.headers, "x-goog-user-project": opts.project, "content-type": "application/json" },
    body: JSON.stringify(buildLyriaRequest(opts.model, opts.prompt)),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 180_000),
  });
  if (!r.ok) {
    const msg = ((await r.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? r.statusText;
    throw new LyriaError(`Lyria ${r.status}: ${String(msg).slice(0, 300)}`, r.status);
  }
  return parseLyriaResponse(await r.json());
}
