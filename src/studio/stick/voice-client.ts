/**
 * سمت مرورگر صداگذاری: گرفتن کلیپ از /api/tts، نگهداری روی دستگاه (IndexedDB) و رمزگشایی.
 * در اپ اندروید آدرس سرور از VITE_API_BASE می‌آید.
 */
import type { Expression } from "./face.ts";
import type { Look } from "./figure.ts";
import { readArtifact, saveArtifact } from "./project-db.ts";
import type { Directed } from "./story-direct.ts";
import { clipKey, concatClips, defaultVoices, encodeWav, LEGACY_CACHE_MODEL, mixClips, MIX_RATE, placeVoices, splitLine, stylePrompt, TTS_PREVIEW_MODEL, type Voice, type VoiceClip } from "./voice.ts";

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

/** خطای یک دیالوگ؛ بقیهٔ دیالوگ‌ها ادامه می‌دهند. fatal یعنی کل کار بایستد (سقف، سرور خاموش). */
export class LineError extends Error {
  readonly beatId: string;
  readonly fatal: boolean;
  constructor(message: string, beatId: string, fatal: boolean) {
    super(message);
    this.beatId = beatId;
    this.fatal = fatal;
  }
}

async function fetchClip(j: LineJob, text: string, signal?: AbortSignal): Promise<{ clip: VoiceClip; blob: Blob }> {
  const r = await fetch(`${API}/api/tts`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, voice: j.voice, prompt: j.prompt }), signal });
  if (!r.ok) {
    const msg = ((await r.json().catch(() => null)) as { message?: string } | null)?.message ?? `خطای سرور صدا (${r.status})`;
    throw new LineError(msg, j.beatId, r.status === 429 || r.status === 503);
  }
  const blob = await r.blob();
  return { clip: await decode(blob), blob };
}

/**
 * ساخت کلیپ‌های ناموجود (حداکثر ۳ درخواست هم‌زمان).
 * دیالوگ بلندتر از سقف سرور تکه‌تکه (سر مرز جمله/عبارت) ساخته و پشت‌هم چسبانده می‌شود.
 * خطای یک دیالوگ فقط همان را بی‌صدا می‌گذارد (failures)؛ خطای کلی (سقف، سرور، شبکه) کار تازه را متوقف می‌کند.
 * در هر حال درخواست‌های در جریان تمام می‌شوند و کلیپ‌های ساخته‌شده از دست نمی‌روند.
 */
export async function synthesize(
  jobs: LineJob[],
  onProgress: (done: number) => void,
  signal?: AbortSignal,
): Promise<{ made: Map<string, VoiceClip>; error?: unknown; failures: LineError[] }> {
  const made = new Map<string, VoiceClip>();
  const failures: LineError[] = [];
  let next = 0, done = 0, error: unknown;
  const worker = async () => {
    while (next < jobs.length && error === undefined && !signal?.aborted) {
      const j = jobs[next++];
      try {
        const parts = splitLine(j.text);
        const got: { clip: VoiceClip; blob: Blob }[] = [];
        for (const text of parts) got.push(await fetchClip(j, text, signal));
        const clip = concatClips(got.map((g) => g.clip));
        const blob = got.length === 1 ? got[0].blob : new Blob([encodeWav(clip.samples, clip.sampleRate) as BlobPart], { type: "audio/wav" });
        await saveArtifact({ id: `voice:${j.key}`, name: `${j.text.slice(0, 40)}.${/mpeg|mp3/.test(blob.type) ? "mp3" : "wav"}`, blob }).catch(() => undefined);
        made.set(j.beatId, clip);
        onProgress(++done);
      } catch (e) {
        if (e instanceof LineError && !e.fatal) failures.push(e);
        else error ??= e;
      }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  if (signal?.aborted) error = signal.reason ?? new DOMException("Aborted", "AbortError");
  // بدون خطای کلی، خطای اولین دیالوگ ناموفق نشان داده می‌شود (رفتار قبلی پنل).
  if (error === undefined && failures.length) error = new LineError(`${failures.length} دیالوگ صدا نگرفت: ${failures[0].message}`, failures[0].beatId, false);
  return { made, error, failures };
}

/** صدای ذخیره‌شدهٔ یک پروژه برای ساخت فیلم (مثلاً ساخت گروهی): تایم‌لاین صداگذاری‌شده و صدای میکس‌شده. */
export async function savedVoicing(directed: Directed, chosen: Parameters<typeof defaultVoices>[1]) {
  const cast = directed.timeline.cast;
  const jobs = await lineJobs(directed, defaultVoices(cast, chosen), Object.fromEntries(cast.map((c) => [c.id, c.look])));
  const { timeline, placed } = placeVoices(directed, await loadClips(jobs));
  return { timeline, audio: placed.length ? { data: mixClips(placed, timeline.duration, MIX_RATE), sampleRate: MIX_RATE } : undefined };
}
