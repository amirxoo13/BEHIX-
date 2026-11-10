/**
 * Pure helpers for the /api/voice client (batched audio + VisemeTimeline). No DOM, tested in Node.
 */
import { repairTimeline, type VisemeTimeline } from "../v2/viseme-timeline.ts";

export const VOICE_BATCH = 4;

export type VoiceBatchJob = { beatId: string; text: string; voice: string; prompt: string };
export type VoiceResult = { beatId: string; audioUrl?: string; timeline?: VisemeTimeline; error?: string; fatal?: boolean };

export const voiceRequest = (jobs: VoiceBatchJob[]) => ({ lines: jobs.map((j) => ({ id: j.beatId, text: j.text, voice: j.voice, style: j.prompt })) });

/** Server reply → one result per job, in job order. Missing/garbled entries become per-line errors. */
export function parseVoiceResults(json: unknown, jobs: VoiceBatchJob[]): VoiceResult[] {
  const list = Array.isArray(json) ? (json as Record<string, unknown>[]) : [];
  const byId = new Map(list.filter((r) => r && typeof r.id === "string").map((r) => [r.id as string, r]));
  return jobs.map((j) => {
    const r = byId.get(j.beatId);
    if (!r) return { beatId: j.beatId, error: "پاسخ سرور صدا ناقص بود." };
    if (typeof r.error === "string") return { beatId: j.beatId, error: r.error, fatal: r.fatal === true };
    const timeline = repairTimeline(r.timeline);
    if (typeof r.audioUrl !== "string" || !timeline) return { beatId: j.beatId, error: "پاسخ سرور صدا ناقص بود." };
    return { beatId: j.beatId, audioUrl: r.audioUrl, timeline };
  });
}

/** Relative audio URLs are resolved against the API base (Android app); data: URLs pass through. */
export const resolveAudioUrl = (api: string, url: string) => (/^(data:|https?:)/.test(url) ? url : `${api}${url}`);
