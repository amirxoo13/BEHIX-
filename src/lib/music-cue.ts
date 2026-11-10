/**
 * Music cue fields from a scene brief: a Gemini 3.8 Flash TEXT call with skill "music.cue"
 * (skills/audio-mix) in its systemInstruction fills {mood, style, instruments, bpm, intensity, seconds};
 * lyria.server.musicPrompt then builds the English, instrumental Lyria prompt deterministically.
 * Pure (tested); the call happens in src/routes/api/music.ts.
 */
import { englishOnly, LYRIA_MAX_SECONDS, MUSIC_MOODS, type MusicCue, type MusicMood } from "./lyria.server.ts";

export const CUE_BASE = [
  "You write background-music cue settings for a scene of a Persian animated short. The music sits under dialogue.",
  "Answer in English only. The music is instrumental (no vocals).",
  `Pick mood from: ${MUSIC_MOODS.join(", ")}. style and instruments: short English phrases (no artist names).`,
  `bpm 40-200, intensity low|medium|high (prefer low under dialogue), seconds 5-${LYRIA_MAX_SECONDS}.`,
  "Return JSON only.",
].join("\n");

export const cueSystem = (skill: string | undefined) => (skill ? `${skill}\n\n---\n\n${CUE_BASE}` : CUE_BASE);

export function cueSchema() {
  return {
    type: "OBJECT",
    properties: {
      mood: { type: "STRING", enum: [...MUSIC_MOODS] },
      style: { type: "STRING" },
      instruments: { type: "STRING" },
      bpm: { type: "INTEGER" },
      intensity: { type: "STRING", enum: ["low", "medium", "high"] },
      seconds: { type: "NUMBER" },
    },
    required: ["mood", "style", "bpm", "intensity", "seconds"],
  };
}

export const cuePrompt = (brief: string, seconds: number, mood?: MusicMood) =>
  `Scene brief (may be Persian): ${brief.slice(0, 600)}\nWanted length: ${Math.round(seconds)} s.${mood ? `\nPreferred mood: ${mood}.` : ""}`;

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/** Model output → a valid MusicCue; anything invalid keeps the fallback (requested mood/seconds). */
export function repairCue(raw: unknown, fallback: MusicCue): MusicCue {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mood = MUSIC_MOODS.includes(r.mood as MusicMood) ? (r.mood as MusicMood) : fallback.mood;
  const style = typeof r.style === "string" ? englishOnly(r.style) : "";
  const instruments = typeof r.instruments === "string" ? englishOnly(r.instruments) : "";
  const bpm = typeof r.bpm === "number" && Number.isFinite(r.bpm) ? Math.round(clamp(r.bpm, 40, 200)) : fallback.bpm;
  const intensity = r.intensity === "low" || r.intensity === "medium" || r.intensity === "high" ? r.intensity : fallback.intensity ?? "low";
  // the user's requested length wins over the model's (it must fit the scene); both capped at 184 s
  const seconds = clamp(fallback.seconds, 5, LYRIA_MAX_SECONDS);
  return { mood, seconds, intensity, ...(style ? { style } : fallback.style ? { style: fallback.style } : {}), ...(instruments ? { instruments } : {}), ...(bpm ? { bpm } : {}) };
}
