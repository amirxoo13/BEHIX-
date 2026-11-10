import { AudioSample, AudioSampleSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, StreamTarget, canEncodeAudio, canEncodeVideo } from "mediabunny";
import { cleanExports, exportDir, openSink } from "./opfs-export.ts";
import type { RenderCanvas, Ctx } from "./figure-base.ts";
import { frameFor, type Format } from "./layout.ts";
import { makeCanvas, makePaper } from "./paper.ts";
import { renderStory, type Timeline } from "./story-render.ts";
export type FilmOptions = {
  fps: 30 | 60;
  captions: boolean;
  format?: Format;
  signal?: AbortSignal;
  onProgress?: (p: number) => void;
  /** صدای میکس‌شدهٔ دیالوگ‌ها (تک‌کانال)؛ نبودنش یعنی فیلم بی‌صدا. */
  audio?: { data: Float32Array; sampleRate: number };
};
export const bitrate = (fps: number) => (fps === 60 ? 8_000_000 : 5_000_000);
export const AUDIO_BITRATE = 128_000;
/** Audio codec actually written into the MP4; null means the film has no audio track. */
export type AudioCodecChoice = "aac" | "opus" | null;
/** `file`: name of the finished MP4 in OPFS (see opfs-export.ts); `buffer`: in-memory fallback. */
export type EncodedFilm = { buffer?: ArrayBuffer; file?: string; audioCodec: AudioCodecChoice };

let aacPolyfill: Promise<void> | undefined;
async function canEncode(codec: "aac" | "opus", sampleRate: number) {
  try {
    return await canEncodeAudio(codec, { numberOfChannels: 1, sampleRate, bitrate: AUDIO_BITRATE });
  } catch {
    return false;
  }
}
/**
 * AAC when possible: native encoder first, else the lazily loaded `@mediabunny/aac-encoder` WASM
 * (same approach as src/studio/export-film.ts). Opus only when AAC is impossible; null when neither works.
 */
export async function storyAudioCodec(sampleRate: number): Promise<AudioCodecChoice> {
  if (await canEncode("aac", sampleRate)) return "aac";
  aacPolyfill ??= import("@mediabunny/aac-encoder")
    .then(({ registerAacEncoder }) => registerAacEncoder())
    .catch((error) => {
      aacPolyfill = undefined;
      throw error;
    });
  try {
    await aacPolyfill;
    if (await canEncode("aac", sampleRate)) return "aac";
  } catch {
    /* WASM unavailable: try Opus */
  }
  return (await canEncode("opus", sampleRate)) ? "opus" : null;
}
export async function canExportMp4(fps: number, format: Format = "portrait") {
  if (typeof VideoEncoder === "undefined") return false;
  const { w, h } = frameFor(format);
  try {
    return await canEncodeVideo("avc", { width: w, height: h, bitrate: bitrate(fps) });
  } catch {
    return false;
  }
}
/** Upper bound of encoded audio packets (AAC: 1024 samples/packet; Opus: 20 ms) plus a 25% margin for 'reserve'. */
function audioPacketBound(samples: number, sampleRate: number, codec: "aac" | "opus") {
  const packets = codec === "aac" ? samples / 1024 : (samples / sampleRate) * 50;
  return Math.ceil(packets * 1.25) + 64;
}

/**
 * Encode a story timeline to MP4 (H.264 + optional mono audio).
 * - `target: "auto"` streams the file into OPFS (StreamTarget, fastStart "reserve" = a normal non-fragmented MP4
 *   with the moov box up front) so memory stays flat for long films; falls back to an in-memory buffer when OPFS
 *   is unavailable. `"memory"` forces the buffer.
 * - Audio is interleaved with video one second ahead of the current frame.
 * - A caller-provided canvas is left as is; only canvases created here are released.
 */
export async function encodeMp4(
  timeline: Timeline,
  opts: FilmOptions & { target?: "auto" | "memory" },
  canvas?: RenderCanvas,
): Promise<EncodedFilm> {
  opts.signal?.throwIfAborted();
  const { w, h } = frameFor(opts.format);
  const ownCanvas = !canvas;
  const surface = canvas ?? makeCanvas(w, h);
  const ctx = surface.getContext("2d") as Ctx | null;
  if (!ctx) throw new Error("ساخت بوم تصویر ممکن نشد.");
  const paper = makePaper(w, h, 7);
  const frames = Math.max(1, Math.ceil(timeline.duration * opts.fps));
  const audio = opts.audio?.data.length ? opts.audio : undefined;
  const audioCodec = audio ? await storyAudioCodec(audio.sampleRate) : null;
  const dir = opts.target === "memory" ? null : await exportDir();
  if (dir) await cleanExports(dir);
  const sink = dir ? await openSink(dir) : null;
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: sink ? "reserve" : "in-memory" }),
    target: sink ? new StreamTarget(sink.writable, { chunked: true, chunkSize: 4 * 1024 * 1024 }) : new BufferTarget(),
  });
  const video = new CanvasSource(surface, {
    codec: "avc",
    bitrate: bitrate(opts.fps),
    keyFrameInterval: 2,
  });
  output.addVideoTrack(video, { frameRate: opts.fps, maximumPacketCount: frames + 64 });
  let sound: AudioSampleSource | null = null;
  if (audio && audioCodec) {
    sound = new AudioSampleSource({ codec: audioCodec, bitrate: AUDIO_BITRATE });
    output.addAudioTrack(sound, { maximumPacketCount: audioPacketBound(audio.data.length, audio.sampleRate, audioCodec) });
  }
  let pushed = 0;
  /** Feed audio up to `until` seconds, in 1 s samples. */
  const feedAudio = async (until: number) => {
    if (!sound || !audio) return;
    const end = Math.min(audio.data.length, Math.ceil(until * audio.sampleRate));
    while (pushed < end) {
      const next = Math.min(end, pushed + audio.sampleRate);
      const sample = new AudioSample({ data: audio.data.subarray(pushed, next), format: "f32", numberOfChannels: 1, sampleRate: audio.sampleRate, timestamp: pushed / audio.sampleRate });
      await sound.add(sample);
      sample.close();
      pushed = next;
    }
  };
  try {
    await output.start();
    for (let i = 0; i < frames; i++) {
      opts.signal?.throwIfAborted();
      if (i % opts.fps === 0) await feedAudio(i / opts.fps + 1);
      renderStory(ctx, timeline, i / opts.fps, paper, opts);
      await video.add(
        i / opts.fps,
        Math.min(1 / opts.fps, Math.max(0.001, timeline.duration - i / opts.fps)),
      );
      if (i % opts.fps === 0) {
        opts.onProgress?.(i / frames);
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }
    await feedAudio(Number.POSITIVE_INFINITY);
    sound?.close();
    await output.finalize();
    opts.onProgress?.(1);
    if (sink) {
      await sink.finish();
      return { file: sink.name, audioCodec };
    }
    const buffer = (output.target as BufferTarget).buffer;
    if (!buffer) throw new Error("فایل ویدیو ساخته نشد.");
    return { buffer, audioCodec };
  } catch (error) {
    await output.cancel().catch(() => undefined);
    await sink?.discard();
    if (error instanceof DOMException && error.name === "QuotaExceededError")
      throw new Error("فضای ذخیره‌سازی دستگاه برای این فیلم کافی نیست؛ فضا آزاد کنید یا قاب/نرمی کمتری انتخاب کنید.");
    throw error;
  } finally {
    if (ownCanvas) {
      surface.width = 1;
      surface.height = 1;
    }
    paper.width = 1;
    paper.height = 1;
  }
}
