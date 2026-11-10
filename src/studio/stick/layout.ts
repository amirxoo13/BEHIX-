export const FORMATS = {
  portrait: { w: 1080, h: 1920, label: "عمودی ۹:۱۶" },
  square: { w: 1080, h: 1080, label: "مربع ۱:۱" },
  landscape: { w: 1920, h: 1080, label: "افقی ۱۶:۹" },
} as const;
export type Format = keyof typeof FORMATS;
/** Places and cameras are authored in this portrait design space. */
export const DESIGN = { w: 1080, h: 1920, floor: 1340 } as const;
/** Share of the frame height a non-portrait stage shows, relative to fitting the whole design height. */
const STAGE_ZOOM = 1.3;
/**
 * Uniform design-space → frame transform: frameX = ox + k·x, frameY = oy + k·y.
 * Portrait is the identity. Square/landscape use one scale k (no stretching), anchored so the
 * design floor lands on the frame floor, centred horizontally; the renderer extends the side bands.
 */
export function stageFor(format: Format = "portrait") {
  if (format === "portrait") return { k: 1, ox: 0, oy: 0 };
  const { w, h } = FORMATS[format];
  const k = Math.min(w / DESIGN.w, (h / DESIGN.h) * STAGE_ZOOM);
  return { k, ox: (w - DESIGN.w * k) / 2, oy: (h * DESIGN.floor) / DESIGN.h - DESIGN.floor * k };
}
export function frameFor(format: Format = "portrait") {
  const { w, h } = FORMATS[format];
  return {
    w,
    h,
    floor: (h * DESIGN.floor) / DESIGN.h,
    captionY: h * 0.84,
    // figures share the stage scale so they stay in proportion with the place art
    scale: 2.4 * stageFor(format).k,
  };
}
