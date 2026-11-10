import { AudioSample, AudioSampleSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, canEncodeAudio, canEncodeVideo } from "mediabunny";
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
export type EncodedFilm = { buffer: ArrayBuffer; audioCodec: AudioCodecChoice };

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
export async function encodeMp4(
  timeline: Timeline,
  opts: FilmOptions,
  canvas?: RenderCanvas,
): Promise<EncodedFilm> {
  opts.signal?.throwIfAborted();
  const { w, h } = frameFor(opts.format);
  const surface = canvas ?? makeCanvas(w, h);
  const ctx = surface.getContext("2d") as Ctx | null;
  if (!ctx) throw new Error("ساخت بوم تصویر ممکن نشد.");
  const paper = makePaper(w, h, 7);
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: "in-memory" }),
    target: new BufferTarget(),
  });
  const video = new CanvasSource(surface, {
    codec: "avc",
    bitrate: bitrate(opts.fps),
    keyFrameInterval: 2,
  });
  output.addVideoTrack(video, { frameRate: opts.fps });
  let sound: AudioSampleSource | null = null;
  const audioCodec = opts.audio?.data.length ? await storyAudioCodec(opts.audio.sampleRate) : null;
  if (audioCodec) {
    sound = new AudioSampleSource({ codec: audioCodec, bitrate: AUDIO_BITRATE });
    output.addAudioTrack(sound);
  }
  try {
    await output.start();
    if (sound && opts.audio) {
      const { data, sampleRate } = opts.audio;
      for (let i = 0; i < data.length; i += sampleRate) {
        const sample = new AudioSample({ data: data.subarray(i, i + sampleRate), format: "f32", numberOfChannels: 1, sampleRate, timestamp: i / sampleRate });
        await sound.add(sample);
        sample.close();
      }
      sound.close();
    }
    const frames = Math.max(1, Math.ceil(timeline.duration * opts.fps));
    for (let i = 0; i < frames; i++) {
      opts.signal?.throwIfAborted();
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
    await output.finalize();
    if (!output.target.buffer) throw new Error("فایل ویدیو ساخته نشد.");
    opts.onProgress?.(1);
    return { buffer: output.target.buffer, audioCodec };
  } catch (error) {
    await output.cancel().catch(() => undefined);
    throw error;
  } finally {
    surface.width = 1;
    surface.height = 1;
    paper.width = 1;
    paper.height = 1;
  }
}
