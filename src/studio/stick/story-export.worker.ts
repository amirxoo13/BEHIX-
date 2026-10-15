import { canExportMp4, encodeMp4, type FilmOptions } from "./encode.ts";
import { loadRenderFonts } from "./fonts.ts";
import type { Timeline } from "./story-render.ts";
export type WorkerRequest =
  | {
      id: number;
      type: "start";
      timeline: Timeline;
      options: Pick<FilmOptions, "fps" | "captions" | "format">;
    }
  | { id: number; type: "cancel" };
export type WorkerReply =
  | { id: number; type: "progress"; progress: number }
  | { id: number; type: "result"; buffer: ArrayBuffer }
  | { id: number; type: "error"; message: string; unsupported: boolean };
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
    const buffer = await encodeMp4(data.timeline, {
      ...data.options,
      signal: controller.signal,
      onProgress: (progress) => scope.postMessage({ id: data.id, type: "progress", progress }),
    });
    scope.postMessage({ id: data.id, type: "result", buffer }, [buffer]);
  } catch (error) {
    scope.postMessage({
      id: data.id,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
      unsupported: !supported,
    });
  } finally {
    jobs.delete(data.id);
  }
};
