/**
 * سمت مرورگر صداگذاری: گرفتن کلیپ از /api/tts، نگهداری روی دستگاه (IndexedDB) و رمزگشایی.
 * در اپ اندروید آدرس سرور از VITE_API_BASE می‌آید.
 */
import type { Expression } from "./face.ts";
import type { Look } from "./figure.ts";
import { readArtifact, saveArtifact } from "./project-db.ts";
import type { Directed } from "./story-direct.ts";
import { clipKey, stylePrompt, type Voice, type VoiceClip } from "./voice.ts";

const API = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";
export type LineJob = { beatId: string; text: string; voice: Voice; prompt: string; key: string };

let ctx: AudioContext | null = null;
export const audioContext = () => (ctx ??= new AudioContext());

/** کار صداگذاری هر دیالوگ (متن، صدا، لحن و کلید ذخیره). */
export async function lineJobs(directed: Directed, voices: Record<string, Voice>, looks: Record<string, Look>): Promise<LineJob[]> {
  const jobs: LineJob[] = [];
  for (const b of directed.beats) {
    if (b.kind !== "line" || !b.speaker || !voices[b.speaker]) continue;
    const mood: Expression | undefined = directed.cues.find((c) => c.beatId === b.id)?.mood;
    const prompt = stylePrompt(mood, looks[b.speaker]?.kind);
    jobs.push({ beatId: b.id, text: b.text, voice: voices[b.speaker], prompt, key: await clipKey(b.text, voices[b.speaker], prompt) });
  }
  return jobs;
}

async function decode(blob: Blob): Promise<VoiceClip> {
  const buf = await audioContext().decodeAudioData(await blob.arrayBuffer());
  return { samples: buf.getChannelData(0).slice(), sampleRate: buf.sampleRate };
}

/** کلیپ‌هایی که قبلاً روی همین دستگاه ساخته شده‌اند. */
export async function loadClips(jobs: LineJob[]): Promise<Map<string, VoiceClip>> {
  const out = new Map<string, VoiceClip>();
  await Promise.all(jobs.map(async (j) => {
    try {
      const a = await readArtifact(`voice:${j.key}`);
      if (a) out.set(j.beatId, await decode(a.blob));
    } catch {
      /* کلیپ خراب یا ناموجود: دوباره ساخته می‌شود */
    }
  }));
  return out;
}

/** ساخت کلیپ‌های ناموجود (حداکثر ۳ درخواست هم‌زمان). */
export async function synthesize(jobs: LineJob[], onProgress: (done: number) => void, signal?: AbortSignal): Promise<Map<string, VoiceClip>> {
  const out = new Map<string, VoiceClip>();
  let next = 0, done = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const j = jobs[next++];
      signal?.throwIfAborted();
      const r = await fetch(`${API}/api/tts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: j.text, voice: j.voice, prompt: j.prompt }), signal });
      if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { message?: string } | null)?.message ?? `خطای سرور صدا (${r.status})`);
      const blob = await r.blob();
      await saveArtifact({ id: `voice:${j.key}`, name: `${j.text.slice(0, 40)}.mp3`, blob }).catch(() => undefined);
      out.set(j.beatId, await decode(blob));
      onProgress(++done);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return out;
}
