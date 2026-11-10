/**
 * Voice direction: a Gemini 3.8 Flash TEXT call (with skill "tts.line" = skills/audio-voice-direction in its
 * systemInstruction) picks a voice per character and a short English style per line. The result only feeds
 * `speechMetadata.style` / `voiceConfig.voice`; skill text never reaches the TTS input.
 * Pure: request building and repair are tested in Node; the route is src/routes/api/voice-direction.ts.
 * Deterministic fallback = the client's current casting (defaultVoices) and stylePrompt(mood).
 */
import { MAX_LINE, VOICE_IDS, type Voice } from "../studio/stick/voice.ts";

export const MAX_DIRECTION_LINES = 60;
export const MAX_STYLE_WORDS = 15;
export const MAX_STYLE_CHARS = 120;

export type DirectionCast = { id: string; name?: string; kind: string; voice: Voice };
export type DirectionLine = { id: string; speaker: string; text: string; mood?: string; style: string };
export type DirectionIn = { cast: DirectionCast[]; lines: DirectionLine[] };
export type DirectionOut = { source: "gemini" | "fallback"; model?: string; cast: Record<string, Voice>; lines: { id: string; voice: Voice; style: string }[]; warning?: string };

export const DIRECTION_BASE = [
  "You are the voice director for a Persian (fa-IR) animated short.",
  "For every character pick one voice id from the allowed list that fits their age, gender and personality; keep it for all their lines.",
  `For every line write a style direction in English, at most ${MAX_STYLE_WORDS} words: emotion, pace, energy, and "colloquial Tehrani Persian" when it fits.`,
  "Never copy or translate the dialogue into the style, never write Persian in the style, and never write instructions such as 'read this' or 'say'.",
  "Return JSON only.",
].join("\n");

export function directionSchema() {
  return {
    type: "OBJECT",
    properties: {
      cast: { type: "ARRAY", items: { type: "OBJECT", properties: { id: { type: "STRING" }, voice: { type: "STRING", enum: VOICE_IDS } }, required: ["id", "voice"] } },
      lines: { type: "ARRAY", items: { type: "OBJECT", properties: { id: { type: "STRING" }, style: { type: "STRING" } }, required: ["id", "style"] } },
    },
    required: ["cast", "lines"],
  };
}

/** systemInstruction = skill text for "tts.line" (may be "") + the base rules. */
export const directionSystem = (skill: string | undefined) => (skill ? `${skill}\n\n---\n\n${DIRECTION_BASE}` : DIRECTION_BASE);

export function directionPrompt(input: DirectionIn): string {
  const cast = input.cast.map((c) => `- ${c.id}: ${c.kind}${c.name ? ` (${c.name})` : ""}, current voice ${c.voice}`).join("\n");
  const lines = input.lines.map((l) => `- ${l.id} [${l.speaker}${l.mood ? `, mood ${l.mood}` : ""}]: ${l.text.slice(0, MAX_LINE)}`).join("\n");
  return `Allowed voice ids: ${VOICE_IDS.join(", ")}.\n\nCharacters:\n${cast}\n\nLines:\n${lines}`;
}

/** A usable style: English, short, no dialogue text, no reading instructions. */
export function cleanStyle(raw: unknown, line: DirectionLine): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.replace(/\s+/g, " ").trim().replace(/[.]+$/, "");
  if (!s || s.length > MAX_STYLE_CHARS || s.split(" ").length > MAX_STYLE_WORDS) return null;
  if (/[\u0600-\u06FF]/.test(s)) return null;
  if (/\b(read|say|speak) (this|the line|it)\b/i.test(s)) return null;
  if (line.text.length > 8 && s.includes(line.text.slice(0, 8))) return null;
  return s;
}

export function fallbackDirection(input: DirectionIn, warning?: string): DirectionOut {
  const cast = Object.fromEntries(input.cast.map((c) => [c.id, c.voice]));
  return { source: "fallback", cast, lines: input.lines.map((l) => ({ id: l.id, voice: cast[l.speaker], style: l.style })), ...(warning ? { warning } : {}) };
}

/** Merge model output over the fallback field by field; anything invalid keeps the current casting/style. */
export function repairDirection(raw: unknown, input: DirectionIn, model?: string): DirectionOut {
  const base = fallbackDirection(input);
  const r = (raw && typeof raw === "object" ? raw : {}) as { cast?: { id?: unknown; voice?: unknown }[]; lines?: { id?: unknown; style?: unknown }[] };
  let used = 0;
  const cast = { ...base.cast };
  for (const c of Array.isArray(r.cast) ? r.cast : []) {
    if (typeof c?.id === "string" && c.id in cast && VOICE_IDS.includes(c.voice as Voice)) {
      cast[c.id] = c.voice as Voice;
      used++;
    }
  }
  const styles = new Map<string, unknown>();
  for (const l of Array.isArray(r.lines) ? r.lines : []) if (typeof l?.id === "string") styles.set(l.id, l.style);
  const lines = input.lines.map((l) => {
    const st = cleanStyle(styles.get(l.id), l);
    if (st) used++;
    return { id: l.id, voice: cast[l.speaker], style: st ?? l.style };
  });
  return used ? { source: "gemini", ...(model ? { model } : {}), cast, lines } : { ...base, warning: "پاسخ مدل قابل استفاده نبود؛ لحن‌ها و صداهای فعلی ماندند." };
}
