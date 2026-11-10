import { canExportMp4, encodeMp4, type AudioCodecChoice, type FilmOptions } from "./encode.ts";
import { loadRenderFonts } from "./fonts.ts";
import type { Timeline } from "./story-render.ts";
export type WorkerRequest =
  | {
      id: number;
      type: "start";
      timeline: Timeline;
      /** `audio.data` is transferred (not copied) into the worker. */
      options: Pick<FilmOptions, "fps" | "captions" | "format" | "audio">;
    }
  | { id: number; type: "cancel" };
export type WorkerReply =
  /** Posted once when the module has loaded; the page sends `start` (and transfers audio) only after it. */
  | { id: 0; type: "ready" }
  | { id: number; type: "progress"; progress: number }
  /** `file`: OPFS name of the finished MP4; `buffer`: in-memory fallback (transferred). */
  | { id: number; type: "result"; buffer?: ArrayBuffer; file?: string; audioCodec: AudioCodecChoice }
  /** `audio`: the transferred soundtrack handed back so a main-thread fallback can still use it. */
  | { id: number; type: "error"; message: string; unsupported: boolean; audio?: Float32Array };
const scope = globalThis as unknown as {
  postMessage: (message: WorkerReply, transfer?: Transferable[]) => void;
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
};
const jobs = new Map<number, AbortController>();
scope.onmessage = async ({ data }) => {
  if (data.type === "cancel") {
    jobs.get(data.id)?.abort();
    return;
  }
  const controller = new AbortController();
  jobs.set(data.id, controller);
  let supported = false;
  try {
    supported =
      typeof OffscreenCanvas !== "undefined" &&
      (await canExportMp4(data.options.fps, data.options.format));
    if (!supported) throw new Error("رمزگذار در Worker پشتیبانی نمی‌شود.");
    await loadRenderFonts();
    const { buffer, file, audioCodec } = await encodeMp4(data.timeline, {
      ...data.options,
      signal: controller.signal,
      onProgress: (progress) => scope.postMessage({ id: data.id, type: "progress", progress }),
    });
    scope.postMessage({ id: data.id, type: "result", buffer, file, audioCodec }, buffer ? [buffer] : []);
  } catch (error) {
    const audio = data.options.audio?.data;
    const back = audio && !supported && audio.buffer.byteLength ? audio : undefined;
    scope.postMessage(
      {
        id: data.id,
        type: "error",
        message: error instanceof Error ? error.message : String(error),
        unsupported: !supported,
        audio: back,
      },
      back ? [back.buffer as ArrayBuffer] : [],
    );
  } finally {
    jobs.delete(data.id);
  }
};
scope.postMessage({ id: 0, type: "ready" });
