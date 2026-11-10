/** Explicit conjugations; unknown words are never stemmed by deleting arbitrary suffixes. */
export function conjugations(text: string): string {
  let result = text
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\u200c/g, " ");
  const stems = [
    "نشین",
    "ایست",
    "خند",
    "کن",
    "شو",
    "رو",
    "آی",
    "پر",
    "ترس",
    "خور",
    "نوش",
    "نویس",
    "ده",
    "زن",
    "گذار",
    "انداز",
    "رس",
    "پوشان",
    "گیر",
    "خوان",
    "ران",
  ];
  for (const stem of stems)
    result = result.replace(
      new RegExp(`(^|\\s)می ?${stem}(?:ند|یم|ید|م|ی|د)(?=\\s|[،؛.!؟?]|$)`, "g"),
      `$1می ${stem}د`,
    );
  const past = [
    "رفت",
    "آمد",
    "نشست",
    "خندید",
    "کرد",
    "شد",
    "پرید",
    "ترسید",
    "خورد",
    "نوشت",
    "داد",
    "زد",
    "گذاشت",
    "رسید",
    "گرفت",
  ];
  for (const stem of past)
    result = result.replace(
      new RegExp(`(^|\\s)${stem}(?:ند|یم|ید|م|ی)(?=\\s|[،؛.!؟?]|$)`, "g"),
      `$1${stem}`,
    );
  return result;
}
export const hasNegativeVerb = (s: string) =>
  /(?:^|\s)(?:نمی[‌ ]?\S+|نکرد\S*|نشد\S*|نرفت\S*|نیامد\S*|ننشست\S*|ننشت\S*|ننوش\S*|نخورد\S*|نخند\S*|نپرید\S*)/.test(
    s,
  );
const hasVerb = (s: string) =>
  /(?:می[‌ ]?\S+|نشسته|ایستاده|وارد|خندید|رفت|آمد|نشست|کرد|شد|داد|گذاشت|دارد|داشت|پرید|زد|هورا)/.test(
    s,
  );
export function actionClauses(text: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  let start = 0;
  for (const m of text.matchAll(/\s+(?:و سپس|و بعد|سپس|بعدش|بعد|و)\s+|[،؛]\s*/g)) {
    const before = text.slice(start, m.index);
    if (!hasVerb(before)) continue;
    out.push({ text: before.trim(), start: start + before.length - before.trimStart().length });
    start = m.index + m[0].length;
  }
  const tail = text.slice(start);
  if (tail.trim())
    out.push({ text: tail.trim(), start: start + tail.length - tail.trimStart().length });
  return out;
}
export function readDelay(text: string): { seconds: number; text: string } | null {
  const digits = (s: string) =>
    s
      .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const m =
    /^(?:بعد از|پس از)\s+(چند|یک|دو|سه|چهار|پنج|[0-9۰-۹٠-٩]+(?:[.٫][0-9۰-۹٠-٩]+)?)\s+ثانیه(?:\s|[،؛:]|$)/.exec(
      text,
    );
  if (!m) return null;
  const words: Record<string, number> = { چند: 3, یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5 };
  return {
    seconds: Math.min(60, Math.max(0, words[m[1]] ?? Number(digits(m[1]).replace("٫", ".")))),
    text: text.slice(m[0].length).trim(),
  };
}
export function textId(value: string): string {
  let n = 2166136261;
  for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619);
  return (n >>> 0).toString(36);
}
