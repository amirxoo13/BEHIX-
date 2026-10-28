import { loadRenderFonts } from "./fonts.ts";
import { frameFor, type Format } from "./layout.ts";
import { makePaper } from "./paper.ts";
import { renderStory } from "./story-render.ts";
import type { Directed } from "./story-direct.ts";
import { thumbnailTime } from "./deliverables.ts";
export async function thumbnail(directed: Directed, format: Format): Promise<Blob> {
  return frameImage(directed, thumbnailTime(directed.cues, directed.timeline.scenes), format, false);
}

/** یک قاب دلخواه از فیلم با اندازهٔ کامل خروجی (مثل ذخیرهٔ فریم در TupiTube). */
export async function frameImage(directed: Directed, time: number, format: Format, captions: boolean): Promise<Blob> {
  await loadRenderFonts();
  const { w, h } = frameFor(format),
    canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const paper = makePaper(w, h),
    ctx = canvas.getContext("2d");
  try {
    if (!ctx) throw new Error("ساخت تصویر ممکن نشد.");
    renderStory(
      ctx,
      directed.timeline,
      Math.max(0, Math.min(time, directed.timeline.duration - 0.001)),
      paper,
      { captions, format },
    );
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("ساخت تصویر ممکن نشد."))),
        "image/png",
      ),
    );
  } finally {
    canvas.width = 1;
    canvas.height = 1;
    paper.width = 1;
    paper.height = 1;
  }
}
