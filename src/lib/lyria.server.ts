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

export type LyriaConfig = { model: string; enabled: boolean; modalities?: string[] };
const MODALITIES = new Set(["text", "image", "audio", "video", "document"]);
/**
 * LYRIA_RESPONSE_MODALITIES (optional, e.g. "audio,text"): sent as Interactions `response_modalities`.
 * Live 2026-11-10 (anime-512918): the documented request without it returned
 * {status:"completed", created, updated, object, model} — no id, no steps, no audio.
 */
export function lyriaConfig(env: Record<string, string | undefined> = process.env): LyriaConfig {
  const model = (env.LYRIA_MODEL ?? "").trim();
  const modalities = (env.LYRIA_RESPONSE_MODALITIES ?? "").split(",").map((m) => m.trim().toLowerCase()).filter((m) => MODALITIES.has(m));
  return { model, enabled: model.length > 0, ...(modalities.length ? { modalities } : {}) };
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
export const englishOnly = (s: string | undefined, max = 120) =>
  (s ?? "").replace(/[^A-Za-z0-9 ,.'&/-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max).replace(/^[\s,.'&/-]+|[\s,.'&/-]+$/g, "");

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

export const buildLyriaRequest = (model: string, prompt: string, modalities?: string[]) => ({
  model,
  input: [{ type: "user_input", content: [{ type: "text", text: prompt }] }],
  ...(modalities?.length ? { response_modalities: modalities } : {}),
});

/** A completed interaction that carries no output at all (seen live): clearer than "no audio". */
const emptyCompleted = (j: Record<string, unknown>) => j.status === "completed" && !j.steps && !j.outputs && !j.id;

export class LyriaError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/** Standard or URL-safe base64 (padding optional) → bytes. */
export function b64ToBytes(b64: string): Uint8Array {
  const std = b64.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(std + "=".repeat((4 - (std.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

/**
 * Redacted key tree of a JSON value for error messages: long strings (base64 audio, lyrics) become `<len N>`,
 * arrays are cut to their first 6 items. Safe to log.
 */
export function keyTree(v: unknown, depth = 0): unknown {
  if (depth > 8) return "<deep>";
  if (typeof v === "string") return v.length > 48 ? `<len ${v.length}>` : v;
  if (Array.isArray(v)) {
    const head = v.slice(0, 6).map((x) => keyTree(x, depth + 1));
    return v.length > 6 ? [...head, `<+${v.length - 6} more>`] : head;
  }
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, keyTree(x, depth + 1)]));
  return v;
}
export const keyTreeText = (v: unknown, max = 1500) => JSON.stringify(keyTree(v)).slice(0, max);

export type LyriaAudio =
  | { kind: "inline"; bytes: Uint8Array; mimeType: string; path: string; text?: string }
  | { kind: "uri"; uri: string; mimeType: string; path: string; text?: string };

const AUDIO_MIME = /^audio\//i;
const DATA_KEYS = ["data", "audioContent", "audio_content", "bytesBase64Encoded", "bytes_base64_encoded", "b64_json", "audioData", "audio_data"];
const URI_KEYS = ["uri", "fileUri", "file_uri", "gcsUri", "gcs_uri", "url"];
const MIME_KEYS = ["mime_type", "mimeType", "mime"];

/**
 * Find the generated audio anywhere in an Interactions (or older predict / generateContent) response.
 * Handles, in document order: `steps[].content[]` {type:"audio", data|uri, mime_type} (documented, 2026-11),
 * `outputs[]` with the same blocks, `content` as a single object, `inlineData`/`inline_data` {mimeType, data},
 * `fileData`/`file_data` {fileUri}, `predictions[].audioContent` (lyria-002), and camelCase variants.
 * Returns null when no audio is present (caller reports the redacted key tree).
 */
export function extractLyriaAudio(json: unknown): LyriaAudio | null {
  const texts: string[] = [];
  let found: LyriaAudio | null = null;
  const visit = (v: unknown, path: string, parentAudio: boolean) => {
    if (found || !v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach((x, i) => visit(x, `${path}[${i}]`, parentAudio));
      return;
    }
    const o = v as Record<string, unknown>;
    if (o.type === "text" && typeof o.text === "string") texts.push(o.text);
    const mime = MIME_KEYS.map((k) => o[k]).find((x): x is string => typeof x === "string");
    const audioish = o.type === "audio" || (mime !== undefined && AUDIO_MIME.test(mime)) || parentAudio;
    if (audioish) {
      const dataKey = DATA_KEYS.find((k) => typeof o[k] === "string" && (o[k] as string).length > 0);
      if (dataKey) {
        found = { kind: "inline", bytes: b64ToBytes(o[dataKey] as string), mimeType: mime ?? "audio/mpeg", path: `${path}.${dataKey}` };
        return;
      }
      const uriKey = URI_KEYS.find((k) => typeof o[k] === "string" && /^(gs|https?):\/\//.test(o[k] as string));
      if (uriKey) {
        found = { kind: "uri", uri: o[uriKey] as string, mimeType: mime ?? "audio/mpeg", path: `${path}.${uriKey}` };
        return;
      }
    }
    // inlineData / fileData / {audio: {...}} wrappers carry the audio one level down
    for (const [k, x] of Object.entries(o)) visit(x, `${path}.${k}`, /^(inline_?data|file_?data|audio)$/i.test(k));
  };
  visit(json, "$", false);
  const f = found as LyriaAudio | null;
  if (f && texts.length) f.text = texts.join("\n");
  return f;
}

const DONE = new Set(["completed"]);
const FAILED = new Set(["failed", "cancelled", "incomplete", "requires_action"]);

/** First audio part of a completed interaction (bytes only; URIs are fetched by generateMusic). */
export function parseLyriaResponse(json: unknown): { mp3: Uint8Array; mimeType: string; text?: string } {
  const j = (json ?? {}) as { status?: string; error?: { message?: string } };
  if (j.status && FAILED.has(j.status)) throw new LyriaError(`interaction ${j.status}${j.error?.message ? `: ${j.error.message.slice(0, 200)}` : ""}`);
  const a = extractLyriaAudio(json);
  if (!a) throw new LyriaError(`no audio in Lyria response; key tree: ${keyTreeText(json)}`);
  if (a.kind !== "inline") throw new LyriaError(`Lyria returned a URI (${a.path}); fetch it with generateMusic`);
  return { mp3: a.bytes, mimeType: a.mimeType, text: a.text };
}

export const musicKey = async (model: string, prompt: string) => `music/${await sha256Hex(`${model}|${prompt}`)}.mp3`;

/** gs://bucket/obj → Storage JSON API media URL; https stays as is. */
export function mediaUrl(uri: string): string {
  const m = /^gs:\/\/([^/]+)\/(.+)$/.exec(uri);
  return m ? `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(m[1])}/o/${encodeURIComponent(m[2])}?alt=media` : uri;
}

export async function generateMusic(opts: { project: string; model: string; prompt: string; headers: Record<string, string>; fetchImpl?: typeof fetch; timeoutMs?: number; pollMs?: number; modalities?: string[] }) {
  const f = opts.fetchImpl ?? fetch;
  const deadline = Date.now() + (opts.timeoutMs ?? 180_000);
  const headers = { ...opts.headers, "x-goog-user-project": opts.project, "content-type": "application/json" };
  const left = () => Math.max(1000, deadline - Date.now());
  const r = await f(lyriaUrl(opts.project), { method: "POST", headers, body: JSON.stringify(buildLyriaRequest(opts.model, opts.prompt, opts.modalities ?? lyriaConfig().modalities)), signal: AbortSignal.timeout(left()) });
  if (!r.ok) {
    const msg = ((await r.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? r.statusText;
    throw new LyriaError(`Lyria ${r.status}: ${String(msg).slice(0, 300)}`, r.status);
  }
  let json = (await r.json()) as { id?: string; status?: string };
  // background / long-running: poll GET interactions/{id} until it leaves in_progress
  while (json.status && !DONE.has(json.status) && !FAILED.has(json.status) && json.id) {
    if (Date.now() + (opts.pollMs ?? 3000) > deadline) throw new LyriaError(`Lyria still ${json.status} at timeout; key tree: ${keyTreeText(json)}`);
    await new Promise((res) => setTimeout(res, opts.pollMs ?? 3000));
    const g = await f(`${lyriaUrl(opts.project)}/${encodeURIComponent(json.id)}`, { headers, signal: AbortSignal.timeout(left()) });
    if (!g.ok) throw new LyriaError(`Lyria poll ${g.status}`, g.status);
    json = (await g.json()) as { id?: string; status?: string };
  }
  const st = (json as { status?: string; error?: { message?: string } });
  if (st.status && FAILED.has(st.status)) throw new LyriaError(`interaction ${st.status}${st.error?.message ? `: ${st.error.message.slice(0, 200)}` : ""}`);
  const a = extractLyriaAudio(json);
  if (!a && emptyCompleted(json as Record<string, unknown>)) throw new LyriaError(`Lyria returned an empty completed interaction (no id, no steps); try LYRIA_RESPONSE_MODALITIES=audio,text; key tree: ${keyTreeText(json)}`);
  if (!a) throw new LyriaError(`no audio in Lyria response; key tree: ${keyTreeText(json)}`);
  if (a.kind === "inline") return { mp3: a.bytes, mimeType: a.mimeType, text: a.text };
  const isGoogle = /^gs:|^https:\/\/[^/]*googleapis\.com\//.test(a.uri);
  const m = await f(mediaUrl(a.uri), { headers: isGoogle ? { authorization: opts.headers.authorization ?? "", "x-goog-user-project": opts.project } : {}, signal: AbortSignal.timeout(left()) });
  if (!m.ok) throw new LyriaError(`Lyria audio URI ${a.path} → ${m.status}`, m.status);
  return { mp3: new Uint8Array(await m.arrayBuffer()), mimeType: m.headers.get("content-type")?.split(";")[0] || a.mimeType, text: a.text };
}
