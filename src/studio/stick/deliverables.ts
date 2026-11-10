import type { Cue } from "./story-direct.ts";
export function dialogueText(cues: Cue[], title = "داستان"): string {
  return (
    `${title}\nبرگهٔ صداپیشه — فیلم بی‌صدا\n\n` +
    cues
      .map(
        (c) =>
          `صحنه ${c.scene} | ${c.from.toFixed(2)} تا ${c.to.toFixed(2)} ثانیه\n${c.speaker}: ${c.text}`,
      )
      .join("\n\n")
  );
}
export function thumbnailTime(cues: Cue[], scenes: { start: number; end: number }[]): number {
  const first = cues[0] ?? (scenes[0] ? { from: scenes[0].start, to: scenes[0].end } : null);
  return first ? (first.from + first.to) / 2 : 0;
}
