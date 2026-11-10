export const FORMATS = {
  portrait: { w: 1080, h: 1920, label: "عمودی ۹:۱۶" },
  square: { w: 1080, h: 1080, label: "مربع ۱:۱" },
  landscape: { w: 1920, h: 1080, label: "افقی ۱۶:۹" },
} as const;
export type Format = keyof typeof FORMATS;
export function frameFor(format: Format = "portrait") {
  const { w, h } = FORMATS[format];
  return {
    w,
    h,
    floor: (h * 1340) / 1920,
    captionY: h * 0.84,
    scale: format === "portrait" ? 2.4 : 1.35,
  };
}
