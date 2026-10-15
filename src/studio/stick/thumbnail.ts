import { loadRenderFonts } from "./fonts.ts";
import { frameFor, type Format } from "./layout.ts";
import { makePaper } from "./paper.ts";
import { renderStory } from "./story-render.ts";
import type { Directed } from "./story-direct.ts";
import { thumbnailTime } from "./deliverables.ts";
export async function thumbnail(directed: Directed, format: Format): Promise<Blob> {
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
      thumbnailTime(directed.cues, directed.timeline.scenes),
      paper,
      { captions: false, format },
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
