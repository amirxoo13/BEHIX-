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
import { canvasSize, locate, renderFrame, totalDuration } from "./frame";
import { finishPlayback, resetArmed, setPlayDone, useStudio } from "./store";

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

/** Offline, faster-than-real-time render: draw every frame, encode MP4. */
async function renderWebCodecs(onProgress?: (p: number) => void): Promise<FilmResult> {
  const s = useStudio.getState();
  const total = totalDuration(s.shots);
  const { w, h } = canvasSize(s.aspect);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ساخت بوم تصویر برای خروجی ممکن نشد.");

  const mix = await renderMixOffline(buildCues(), total, SAMPLE_RATE);
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
      });
      await video.add(t, 1 / FPS);
      if (onProgress && i % FPS === 0) onProgress(i / frames);
    }
    await audio.add(mix);
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => undefined);
    throw err;
  }
  const buf = output.target.buffer;
  if (!buf) throw new Error("فایل ویدیو ساخته نشد.");
  onProgress?.(1);
  return { blob: new Blob([buf], { type: "video/mp4" }), mime: "video/mp4", ext: "mp4", method: "webcodecs", codecs: "avc1,mp4a.40.2", notice: null };
}

/** Previous real-time path (captureStream + MediaRecorder), kept as fallback. */
async function renderMediaRecorder(canvas: HTMLCanvasElement): Promise<FilmResult> {
  await resumeAudio();
  if (typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") {
    throw new Error("این مرورگر نه رمزگذار سریع ویدیو دارد و نه ضبط تصویر صحنه؛ ساخت فیلم ممکن نیست.");
  }
  const mime = pickVideoMime();
  const dest = openRecordBus();
  let blob: Blob;
  let recordedType = "";
  try {
    const canvasStream = canvas.captureStream(FPS);
    const mixed = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(mixed, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    const stopped = new Promise<Blob>((resolve) => {
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || mime || "video/webm" }));
    });
    rec.start();
    // The recorder's own mimeType names the codecs it really chose.
    recordedType = rec.mimeType;
    resetArmed();
    useStudio.getState().setPlaying(true, performance.now());
    await new Promise<void>((resolve) => setPlayDone(resolve));
    await new Promise((r) => setTimeout(r, 200));
    if (rec.state !== "inactive") rec.stop();
    stopAll();
    blob = await stopped;
  } finally {
    setRecordDest(null);
  }
  return { blob, method: "mediarecorder", ...describeRecorded(recordedType || mime) };
}

/**
 * Render the current project to a video Blob without downloading it.
 * Uses offline WebCodecs (H.264 + AAC MP4) when available, else MediaRecorder.
 * `canvas` is the live stage canvas, only needed by the fallback path.
 */
export async function renderFilm(
  canvas: HTMLCanvasElement,
  opts: { onProgress?: (p: number) => void; forceFallback?: boolean } = {},
): Promise<FilmResult> {
  if (useStudio.getState().playing) finishPlayback();
  stopAll();
  useStudio.getState().setExporting(true);
  try {
    const { w, h } = canvasSize(useStudio.getState().aspect);
    if (!opts.forceFallback && (await canRenderMp4(w, h))) {
      try {
        return await renderWebCodecs(opts.onProgress);
      } catch (err) {
        console.warn("[export] WebCodecs path failed, falling back to MediaRecorder", err);
      }
    }
    return await renderMediaRecorder(canvas);
  } finally {
    useStudio.getState().setExporting(false);
  }
}

/** Backward-compatible: render, then trigger a download. Returns the extension. */
export async function exportFilm(canvas: HTMLCanvasElement): Promise<"mp4" | "webm"> {
  const film = await renderFilm(canvas);
  const a = document.createElement("a");
  const href = URL.createObjectURL(film.blob);
  a.href = href;
  a.download = `behix-${Date.now()}.${film.ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // BUG-03: آزاد کردن حافظه پس از شروع دانلود.
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
  return film.ext;
}
