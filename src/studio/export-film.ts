import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  canEncodeAudio,
  canEncodeVideo,
} from "mediabunny";
import {
  openRecordBus,
  pickVideoMime,
  renderMixOffline,
  resumeAudio,
  setRecordDest,
  stopAll,
  type MixCue,
} from "./audio";
import { preloadHeads } from "./draw-actor";
import { canvasSize, locate, renderFrame, totalDuration } from "./frame";
import { finishPlayback, resetArmed, setPlayDone, useStudio } from "./store";
import { buildMouthTrack, monoOf, mouthAt, type MouthTrack } from "./lipsync";
import type { Shot } from "./types";

/** Result of rendering a film; the frontend (T09) shares or downloads it. */
export type FilmResult = {
  blob: Blob;
  mime: string;
  ext: "mp4" | "webm";
  /** Which path produced it: offline WebCodecs (fast) or live MediaRecorder. */
  method: "webcodecs" | "mediarecorder";
  /** Codecs actually written, e.g. "avc1,mp4a.40.2"; null when the browser did not say. */
  codecs: string | null;
  /** Persian note when the fallback path was used, else null. */
  notice: string | null;
};

const FPS = 30;
const SAMPLE_RATE = 48_000;
const LIVE = "این مرورگر رمزگذار سریع ویدیو (WebCodecs) را ندارد؛ فیلم به‌صورت زنده ضبط شد.";

/** Describe a MediaRecorder result from its real mime/codecs (T08-v2, MEDIUM-1). */
export function describeRecorded(type: string): Pick<FilmResult, "mime" | "ext" | "codecs" | "notice"> {
  const mime = type || "video/webm";
  const m = /codecs="?([^";]+)"?/i.exec(mime);
  const codecs = m ? m[1].replace(/\s+/g, "") : null;
  const isMp4 = mime.toLowerCase().startsWith("video/mp4");
  const h264 = codecs ? /(^|,)(avc1|avc3|h264)/i.test(codecs) : false;
  const aac = codecs ? /mp4a/i.test(codecs) : false;
  if (isMp4 && h264 && aac) return { mime, ext: "mp4", codecs, notice: `${LIVE} خروجی MP4 (H.264 + AAC) است.` };
  if (isMp4 && h264) {
    return { mime, ext: "mp4", codecs, notice: `${LIVE} خروجی MP4 با تصویر H.264 و صدای Opus است؛ بعضی برنامه‌ها ممکن است صدای آن را پخش نکنند.` };
  }
  if (isMp4) {
    return { mime, ext: "mp4", codecs, notice: `${LIVE} فایل MP4 است ولی رمزگذاری آن ${codecs ?? "نامشخص"} است و ممکن است اینستاگرام یا تلگرام آن را نپذیرند.` };
  }
  return { mime, ext: "webm", codecs, notice: `${LIVE} خروجی WebM است و ممکن است اینستاگرام آن را نپذیرد.` };
}

let aacPolyfill = false;

/**
 * True when this browser can encode H.264 + AAC through WebCodecs. When the
 * native AAC encoder is missing (desktop Linux Chrome, iOS < 26) the ~1 MB WASM
 * `@mediabunny/aac-encoder` is lazy-loaded and registered once.
 */
export async function canRenderMp4(w: number, h: number): Promise<boolean> {
  if (typeof VideoEncoder === "undefined" || typeof AudioEncoder === "undefined") return false;
  if (typeof OfflineAudioContext === "undefined") return false;
  try {
    const aacOpts = { numberOfChannels: 2, sampleRate: SAMPLE_RATE, bitrate: 128_000 };
    if (!(await canEncodeVideo("avc", { width: w, height: h, bitrate: 4_000_000 }))) return false;
    if (await canEncodeAudio("aac", aacOpts)) return true;
    if (!aacPolyfill) {
      const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
      registerAacEncoder();
      aacPolyfill = true;
    }
    return await canEncodeAudio("aac", aacOpts);
  } catch {
    return false;
  }
}

function buildCues(): MixCue[] {
  const s = useStudio.getState();
  const cues: MixCue[] = [];
  let at = 0;
  for (const shot of s.shots) {
    const url = shot.speaker !== "none" ? s.audioUrls[shot.id] : undefined;
    cues.push({ at, end: at + shot.duration, sfx: shot.sfx, url, pitch: shot.pitch });
    at += shot.duration;
  }
  return cues;
}

/** T11: برای هر نمای دارای صدای ضبط‌شده، مسیر دهان را یک‌بار از AudioBuffer دیکدشده می‌سازد. */
async function buildShotTracks(shots: Shot[], urls: Record<string, string>): Promise<Map<string, MouthTrack>> {
  const out = new Map<string, MouthTrack>();
  const ctx = new OfflineAudioContext(1, 1, SAMPLE_RATE);
  for (const shot of shots) {
    const url = shot.speaker !== "none" ? urls[shot.id] : undefined;
    if (!url) continue;
    try {
      const buf = await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer());
      out.set(shot.id, buildMouthTrack(monoOf(buf), buf.sampleRate, FPS));
    } catch (err) {
      console.warn("[export] lip-sync track failed; using text mouth", err);
    }
  }
  return out;
}

/** Offline, faster-than-real-time render: draw every frame, encode MP4. */
async function renderWebCodecs(onProgress?: (p: number) => void, signal?: AbortSignal): Promise<FilmResult> {
  const s = useStudio.getState();
  const total = totalDuration(s.shots);
  const { w, h } = canvasSize(s.aspect);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ساخت بوم تصویر برای خروجی ممکن نشد.");

  const mix = await renderMixOffline(buildCues(), total, SAMPLE_RATE);
  const tracks = await buildShotTracks(s.shots, s.audioUrls);
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  const video = new CanvasSource(canvas, { codec: "avc", bitrate: 4_000_000, keyFrameInterval: 2 });
  const audio = new AudioBufferSource({ codec: "aac", bitrate: 128_000 });
  output.addVideoTrack(video, { frameRate: FPS });
  output.addAudioTrack(audio);
  try {
    await output.start();
    const frames = Math.max(1, Math.ceil(total * FPS));
    const noPulse = { a: 0, b: 0 };
    for (let i = 0; i < frames; i++) {
      signal?.throwIfAborted();
      const t = i / FPS;
      const loc = locate(s.shots, t) ?? { index: s.shots.length - 1, local: s.shots.at(-1)?.duration ?? 0 };
      const shot = s.shots[loc.index];
      renderFrame(ctx, shot, {
        now: t * 1000,
        local: loc.local,
        dt: 1 / FPS,
        aspect: s.aspect,
        showRig: s.showRig,
        pulses: noPulse,
        speakingLive: false,
        // صدا با playbackRate=pitch پخش می‌شود؛ پس زمان فایل = زمان نما × pitch.
        audioMouth: mouthAt(tracks.get(shot.id), loc.local * (shot.pitch || 1)),
      });
      await video.add(t, Math.min(1 / FPS, total - t));
      if (onProgress && i % FPS === 0) onProgress(i / frames);
    }
    signal?.throwIfAborted();
    await audio.add(mix);
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => undefined);
    throw err;
  } finally {
    canvas.width = 1; canvas.height = 1;
  }
  const buf = output.target.buffer;
  if (!buf) throw new Error("فایل ویدیو ساخته نشد.");
  onProgress?.(1);
  return { blob: new Blob([buf], { type: "video/mp4" }), mime: "video/mp4", ext: "mp4", method: "webcodecs", codecs: "avc1,mp4a.40.2", notice: null };
}

/** Previous real-time path (captureStream + MediaRecorder), kept as fallback. */
async function renderMediaRecorder(canvas: HTMLCanvasElement, signal?: AbortSignal): Promise<FilmResult> {
  signal?.throwIfAborted();
  await resumeAudio();
  if (typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") {
    throw new Error("این مرورگر از ضبط تصویر صحنه پشتیبانی نمی‌کند.");
  }
  const mime = pickVideoMime();
  const dest = openRecordBus();
  let stream: MediaStream | undefined;
  let recorder: MediaRecorder | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let stopTimeout: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  let hidden = () => {};
  try {
    stream = canvas.captureStream(FPS);
    const mixed = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(mixed, mime ? { mimeType: mime } : undefined);
    recorder = rec;
    const chunks: Blob[] = [];
    const blob = await new Promise<Blob>((resolve, reject) => {
      let complete = false;
      const fail = (error: unknown) => reject(error);
      cancel = () => fail(new DOMException("ساخت فیلم لغو شد.", "AbortError"));
      hidden = () => {
        if (document.hidden) fail(new Error("صفحه هنگام ضبط پنهان شد؛ دوباره خروجی بگیرید."));
      };
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onerror = () => fail(new Error("مرورگر نتوانست فیلم را ضبط کند."));
      rec.onstop = () => {
        if (!complete) { fail(new Error("ضبط پیش از پایان فیلم متوقف شد.")); return; }
        const type = rec.mimeType || chunks[0]?.type;
        if (!type || !chunks.length) { fail(new Error("فایل ویدیویی تولید نشد.")); return; }
        resolve(new Blob(chunks, { type }));
      };
      for (const track of mixed.getTracks()) track.onended = () => fail(new Error("مسیر ضبط قطع شد."));
      signal?.addEventListener("abort", cancel, { once: true });
      document.addEventListener("visibilitychange", hidden);
      if (signal?.aborted) { cancel(); return; }
      if (document.hidden) { hidden(); return; }
      setPlayDone(() => {
        complete = true;
        stopTimeout = setTimeout(() => fail(new Error("مرورگر پایان ضبط را تأیید نکرد.")), 5000);
        if (rec.state !== "inactive") rec.stop();
      });
      timeout = setTimeout(() => fail(new Error("زمان ضبط پایان یافت؛ پخش صحنه متوقف شده است.")),
        (totalDuration(useStudio.getState().shots) + 15) * 1000);
      rec.start();
      resetArmed();
      useStudio.getState().setPlaying(true, performance.now());
    });
    return { blob, method: "mediarecorder", ...describeRecorded(blob.type) };
  } finally {
    clearTimeout(timeout);
    clearTimeout(stopTimeout);
    signal?.removeEventListener("abort", cancel);
    document.removeEventListener("visibilitychange", hidden);
    setPlayDone(null);
    finishPlayback();
    stopAll();
    if (recorder) {
      recorder.onstop = null; recorder.onerror = null; recorder.ondataavailable = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    for (const track of [...(stream?.getTracks() ?? []), ...dest.stream.getTracks()]) {
      track.onended = null;
      track.stop();
    }
    setRecordDest(null);
  }
}

/**
 * Render the current project to a video Blob without downloading it.
 * Uses offline WebCodecs (H.264 + AAC MP4) when available, else MediaRecorder.
 * `canvas` is the live stage canvas, only needed by the fallback path.
 */
export async function renderFilm(
  canvas: HTMLCanvasElement,
  opts: { onProgress?: (p: number) => void; forceFallback?: boolean; signal?: AbortSignal } = {},
): Promise<FilmResult> {
  opts.signal?.throwIfAborted();
  if (useStudio.getState().exporting) throw new Error("یک خروجی دیگر در حال ساخت است.");
  if (useStudio.getState().playing) finishPlayback();
  stopAll();
  useStudio.getState().setExporting(true);
  try {
    // سرهای عکسی شخصیت‌های سفارشی قبل از اولین فریم کامل بارگذاری می‌شوند.
    await preloadHeads(useStudio.getState().characters);
    const { w, h } = canvasSize(useStudio.getState().aspect);
    if (!opts.forceFallback && (await canRenderMp4(w, h))) {
      try {
        return await renderWebCodecs(opts.onProgress, opts.signal);
      } catch (err) {
        opts.signal?.throwIfAborted();
        console.warn("[export] WebCodecs path failed, falling back to MediaRecorder", err);
      }
    }
    return await renderMediaRecorder(canvas, opts.signal);
  } finally {
    useStudio.getState().setExporting(false);
  }
}

