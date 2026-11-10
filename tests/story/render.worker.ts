import { renderStory } from "../../src/studio/stick/story-render.ts";
import { makePaper } from "../../src/studio/stick/paper.ts";
import { loadRenderFonts } from "../../src/studio/stick/fonts.ts";
const scope = globalThis as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (data: unknown, transfer: Transferable[]) => void;
};
scope.onmessage = async ({ data }) => {
  await loadRenderFonts();
  const canvas = new OffscreenCanvas(1080, 1920),
    ctx = canvas.getContext("2d")!;
  renderStory(ctx, data.timeline, data.time, makePaper(1080, 1920), { captions: true });
  const pixels = ctx.getImageData(0, 0, 1080, 1920).data.buffer;
  scope.postMessage(pixels, [pixels]);
};
