/**
 * شناسهٔ «کار» هر فراخوانی Gemini در بخش شخصیت‌ها (برای مهارت‌های درون‌برنامه‌ای، skills/<id>/SKILL.md).
 * هر محل فراخوانی شناسهٔ خودش را دارد؛ بارگذار مهارت‌ها (src/ai/skills.ts، شاخهٔ story) بعداً
 * از راه گزینهٔ اختیاری `system` متن مهارت را به systemInstruction اضافه می‌کند.
 * تا آن زمان `system` داده نمی‌شود و رفتار دقیقاً مثل قبل است.
 */
export const CHAR_TASKS = {
  /** studio-media.server.ts createCharacter: برگهٔ سه‌زاویهٔ شخصیت (مدل تصویر). */
  generate: "char.generate",
  /** studio-media.server.ts createKeyframe: فریم کلیدی با برگه‌های مرجع (مدل تصویر). */
  keyframe: "char.keyframe",
  /** puppet-build.server.ts createPuppet: تصویر مرجع تمام‌قد عروسک (مدل تصویر). */
  refpose: "rig.refpose",
  /** puppet-build.server.ts measureJoints: مختصات ۲۲ مفصل به JSON (gemini-3.8-flash). */
  joints: "rig.joints",
} as const;
export type CharTask = (typeof CHAR_TASKS)[keyof typeof CHAR_TASKS];

/** متن افزودنی systemInstruction برای یک کار؛ undefined یعنی بدون systemInstruction (رفتار قبلی). */
export type SystemFor = (task: CharTask) => string | undefined;
export type AiOpts = { system?: SystemFor };

/** بخش systemInstruction بدنهٔ generateContent، فقط اگر متنی هست. */
export function systemPart(text: string | undefined): { systemInstruction?: { parts: { text: string }[] } } {
  const t = text?.trim();
  return t ? { systemInstruction: { parts: [{ text: t }] } } : {};
}
