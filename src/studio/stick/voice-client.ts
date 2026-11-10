/**
 * سمت مرورگر صداگذاری: گرفتن کلیپ از /api/tts، نگهداری روی دستگاه (IndexedDB) و رمزگشایی.
 * در اپ اندروید آدرس سرور از VITE_API_BASE می‌آید.
 */
import type { Expression } from "./face.ts";
import type { Look } from "./figure.ts";
import { readArtifact, saveArtifact } from "./project-db.ts";
import type { Directed } from "./story-direct.ts";
import { clipKey, defaultVoices, LEGACY_CACHE_MODEL, mixClips, MIX_RATE, placeVoices, stylePrompt, TTS_PREVIEW_MODEL, type Voice, type VoiceClip } from "./voice.ts";

const API = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ?? "";
/**
 * key = کلید مدل اصلی (3.8 Flash) که کلیپ تازه زیرش ذخیره می‌شود.
 * altKeys = کلیدهای دیگری که فقط خوانده می‌شوند: Flash-Lite (جایگزین) و MP3 قدیمی Gemini 2.5.
 */
export type LineJob = { beatId: string; text: string; voice: Voice; prompt: string; key: string; altKeys: string[] };

/** کلیدهای ذخیرهٔ یک دیالوگ روی دستگاه، به ترتیب جستجو. */
export async function jobKeys(text: string, voice: Voice, prompt: string): Promise<{ key: string; altKeys: string[] }> {
  const [key, lite, legacy] = await Promise.all([clipKey(text, voice, prompt), clipKey(text, voice, prompt, TTS_PREVIEW_MODEL), clipKey(text, voice, prompt, LEGACY_CACHE_MODEL)]);
  return { key, altKeys: [lite, legacy] };
}

let ctx: AudioContext | null = null;
export const audioContext = () => (ctx ??= new AudioContext());

/** کار صداگذاری هر دیالوگ (متن، صدا، لحن و کلید ذخیره). */
export async function lineJobs(directed: Directed, voices: Record<string, Voice>, looks: Record<string, Look>): Promise<LineJob[]> {
  const jobs: LineJob[] = [];
  for (const b of directed.beats) {
    if (b.kind !== "line" || !b.speaker || !voices[b.speaker]) continue;
    const mood: Expression | undefined = directed.cues.find((c) => c.beatId === b.id)?.mood;
    const prompt = stylePrompt(mood, looks[b.speaker]?.kind);
    jobs.push({ beatId: b.id, text: b.text, voice: voices[b.speaker], prompt, ...(await jobKeys(b.text, voices[b.speaker], prompt)) });
  }
  return jobs;
}

/** WAV (3.8) و MP3 (کلیپ‌های قدیمی) هر دو با decodeAudioData خوانده می‌شوند. */
async function decode(blob: Blob): Promise<VoiceClip> {
  const buf = await audioContext().decodeAudioData(await blob.arrayBuffer());
  return { samples: buf.getChannelData(0).slice(), sampleRate: buf.sampleRate };
}

/** کلیپ‌هایی که قبلاً روی همین دستگاه ساخته شده‌اند. */
export async function loadClips(jobs: LineJob[]): Promise<Map<string, VoiceClip>> {
  const out = new Map<string, VoiceClip>();
  await Promise.all(jobs.map(async (j) => {
    try {
      for (const k of [j.key, ...j.altKeys]) {
        const a = await readArtifact(`voice:${k}`);
        if (a) {
          out.set(j.beatId, await decode(a.blob));
          return;
        }
      }
    } catch {
      /* کلیپ خراب یا ناموجود: دوباره ساخته می‌شود */
    }
  }));
  return out;
}

/**
 * ساخت کلیپ‌های ناموجود (حداکثر ۳ درخواست هم‌زمان).
 * با اولین خطا کار تازه شروع نمی‌شود، ولی درخواست‌های در جریان تمام می‌شوند و کلیپ‌های ساخته‌شده از دست نمی‌روند.
 */
export async function synthesize(jobs: LineJob[], onProgress: (done: number) => void, signal?: AbortSignal): Promise<{ made: Map<string, VoiceClip>; error?: unknown }> {
  const made = new Map<string, VoiceClip>();
  let next = 0, done = 0, error: unknown;
  const worker = async () => {
    while (next < jobs.length && error === undefined && !signal?.aborted) {
      const j = jobs[next++];
      try {
        const r = await fetch(`${API}/api/tts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: j.text, voice: j.voice, prompt: j.prompt }), signal });
        if (!r.ok) throw new Error(((await r.json().catch(() => null)) as { message?: string } | null)?.message ?? `خطای سرور صدا (${r.status})`);
        const blob = await r.blob();
        await saveArtifact({ id: `voice:${j.key}`, name: `${j.text.slice(0, 40)}.${/mpeg|mp3/.test(blob.type) ? "mp3" : "wav"}`, blob }).catch(() => undefined);
        made.set(j.beatId, await decode(blob));
        onProgress(++done);
      } catch (e) {
        error ??= e;
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (signal?.aborted) error = signal.reason ?? new DOMException("Aborted", "AbortError");
  return { made, error };
}

/** صدای ذخیره‌شدهٔ یک پروژه برای ساخت فیلم (مثلاً ساخت گروهی): تایم‌لاین صداگذاری‌شده و صدای میکس‌شده. */
export async function savedVoicing(directed: Directed, chosen: Parameters<typeof defaultVoices>[1]) {
  const cast = directed.timeline.cast;
  const jobs = await lineJobs(directed, defaultVoices(cast, chosen), Object.fromEntries(cast.map((c) => [c.id, c.look])));
  const { timeline, placed } = placeVoices(directed, await loadClips(jobs));
  return { timeline, audio: placed.length ? { data: mixClips(placed, timeline.duration, MIX_RATE), sampleRate: MIX_RATE } : undefined };
}
