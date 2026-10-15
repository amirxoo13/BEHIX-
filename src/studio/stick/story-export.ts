/**
 * خروجی فیلم بی‌صدا از داستان (صداگذاری را بعداً یک انسان انجام می‌دهد).
 * راه اصلی: WebCodecs + mediabunny ← MP4 (H.264)، فریم‌به‌فریم و دقیق (سریع‌تر از زمان واقعی).
 * راه جایگزین برای مرورگرهای بدون WebCodecs: ضبط زندهٔ بوم با MediaRecorder.
 */
import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, canEncodeVideo } from "mediabunny";
import { makePaper } from "./paper.ts";
import { FRAME, renderStory, type Timeline } from "./story-render.ts";

export type StoryFilm = { blob: Blob; ext: "mp4" | "webm"; notice: string | null };

export type ExportOptions = { fps: 30 | 60; captions: boolean; onProgress?: (p: number) => void; signal?: AbortSignal };

/** حجم مناسب برای ۱۰۸۰×۱۹۲۰؛ برای ۶۰ فریم کمی بیشتر. */
const bitrate = (fps: number) => (fps === 60 ? 8_000_000 : 5_000_000);

export async function canExportMp4(fps: number): Promise<boolean> {
  if (typeof VideoEncoder === "undefined") return false;
  try {
    return await canEncodeVideo("avc", { width: FRAME.w, height: FRAME.h, bitrate: bitrate(fps) });
  } catch {
    return false;
  }
}

export async function exportStoryFilm(tl: Timeline, opts: ExportOptions): Promise<StoryFilm> {
  await document.fonts?.load("800 60px Vazirmatn").catch(() => undefined);
  const canvas = document.createElement("canvas");
  canvas.width = FRAME.w;
  canvas.height = FRAME.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ساخت بوم تصویر برای خروجی ممکن نشد.");
  const paper = makePaper(FRAME.w, FRAME.h, 7);
  if (await canExportMp4(opts.fps)) return encodeMp4(tl, canvas, ctx, paper, opts);
  return recordLive(tl, canvas, ctx, paper, opts);
}

async function encodeMp4(
  tl: Timeline,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  paper: HTMLCanvasElement,
  opts: ExportOptions,
): Promise<StoryFilm> {
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: "in-memory" }), target: new BufferTarget() });
  const video = new CanvasSource(canvas, { codec: "avc", bitrate: bitrate(opts.fps), keyFrameInterval: 2 });
  output.addVideoTrack(video, { frameRate: opts.fps });
  try {
    await output.start();
    const frames = Math.max(1, Math.ceil(tl.duration * opts.fps));
    for (let i = 0; i < frames; i++) {
      if (opts.signal?.aborted) throw new DOMException("لغو شد", "AbortError");
      const t = i / opts.fps;
      renderStory(ctx, tl, t, paper, { captions: opts.captions });
      await video.add(t, 1 / opts.fps);
      if (i % opts.fps === 0) opts.onProgress?.(i / frames);
    }
    await output.finalize();
  } catch (err) {
    await output.cancel().catch(() => undefined);
    throw err;
  }
  const buf = output.target.buffer;
  if (!buf) throw new Error("فایل ویدیو ساخته نشد.");
  opts.onProgress?.(1);
  return { blob: new Blob([buf], { type: "video/mp4" }), ext: "mp4", notice: null };
}

/** ضبط زنده (به اندازهٔ طول فیلم طول می‌کشد). */
async function recordLive(
  tl: Timeline,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  paper: HTMLCanvasElement,
  opts: ExportOptions,
): Promise<StoryFilm> {
  if (typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") {
    throw new Error("این مرورگر نه رمزگذار سریع ویدیو دارد و نه ضبط بوم؛ لطفاً با Chrome یا Edge تازه امتحان کنید.");
  }
  const types = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  const mime = types.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const stream = canvas.captureStream(opts.fps);
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: bitrate(opts.fps) } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
  renderStory(ctx, tl, 0, paper, { captions: opts.captions });
  rec.start(500);
  const start = performance.now();
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (opts.signal?.aborted) {
        reject(new DOMException("لغو شد", "AbortError"));
        return;
      }
      const t = (performance.now() - start) / 1000;
      renderStory(ctx, tl, Math.min(t, tl.duration), paper, { captions: opts.captions });
      opts.onProgress?.(Math.min(1, t / tl.duration));
      if (t >= tl.duration) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }).finally(() => {
    if (rec.state !== "inactive") rec.stop();
  });
  await done;
  stream.getTracks().forEach((tr) => tr.stop());
  const type = rec.mimeType || "video/webm";
  const ext = type.startsWith("video/mp4") ? "mp4" : "webm";
  return {
    blob: new Blob(chunks, { type }),
    ext,
    notice: ext === "mp4" ? "این مرورگر رمزگذار سریع ندارد؛ فیلم زنده ضبط شد." : "این مرورگر MP4 نمی‌سازد؛ خروجی WebM است. برای MP4 از Chrome یا Edge استفاده کنید.",
  };
}
