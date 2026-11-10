/**
 * راهنمای سبک بصری «استودیوی BEHIX» — منبع واحد قواعد.
 * رندر (draw-char.ts، backdrop.ts، render.ts) فقط از همین ثابت‌ها می‌خواند؛ نسخهٔ خواندنی در docs/style-guide.md است.
 *
 * ۱. فرم: شکل‌های تخت و هندسی نرم؛ هیچ مفصل دایره‌ای یا لولهٔ عروسکی دیده نمی‌شود.
 * ۲. خط دور: مشکی نیست؛ همیشه تُنِ تیره‌ترِ همان رنگ (LINE.tint) و نازک (LINE.w واحد بدن).
 * ۳. نور: یک منبع از بالا-چپ. هر حجم فقط یک لکهٔ سایهٔ تخت دارد (SHADE.amount) در پایین-راست.
 * ۴. تناسب: بزرگ‌سال حدود ۶ سر؛ کودک حدود ۴٫۵ سر. سیلوئت هر شخصیت با تیپ بدن، مو/سرپوش و لباس جدا می‌شود.
 * ۵. رنگ: پوست و مو از فهرست‌های زیر؛ لباس‌ها اشباع متوسط، پس‌زمینه همیشه کم‌اشباع‌تر و کم‌کنتراست‌تر از شخصیت.
 * ۶. چهره: چشم بادامی با پلک بالایی پررنگ، بینی یک لکهٔ ساده، دهان ۹ شکل (VISEMES) — در همهٔ زاویه‌ها از همین اجزا.
 * ۷. حرکت: هر تغییر ژست با انتقال وزن (لگن) شروع می‌شود، دست‌ها با تأخیر می‌رسند و کمی رد می‌کنند، بعد «مکث زنده».
 */
export const FRAME = { w: 1280, h: 720, ground: 0.86 } as const;
export const LINE = { w: 1.2, tint: 0.5 } as const;
export const SHADE = { amount: 0.17, dx: 3.2, dy: 2.4 } as const;

export const SKINS = ["#f6d7bd", "#eec3a1", "#dfa97f", "#c98d63", "#a56c45", "#7d4e31"] as const;
export const HAIRS = ["#191616", "#33241c", "#5a3a25", "#8a5a34", "#b98a4e", "#c9c4bd", "#7a2330", "#2b3550"] as const;
export const CLOTHS = [
  "#27364f", "#3f5f8a", "#5b8fb0", "#2f6f66", "#5f9a73", "#b9c27a", "#e2b659", "#d98545",
  "#c4553f", "#9a3b4f", "#b0688f", "#6d5aa6", "#f1ebe0", "#c9c2b6", "#77706a", "#2b2a2e",
] as const;

export type Rgb = [number, number, number];

export function rgb(hex: string): Rgb {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return [128, 128, 128];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hex([r, g, b]: Rgb): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** ترکیب دو رنگ؛ k=0 یعنی a و k=1 یعنی b. */
export function mix(a: string, b: string, k: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * k, x[1] + (y[1] - x[1]) * k, x[2] + (y[2] - x[2]) * k]);
}

/** تُن تیره‌تر با حفظ ته‌رنگ (کمی به سمت بنفشِ سرد می‌رود تا سایه مرده نباشد). */
export function darken(color: string, k: number): string {
  return mix(color, "#1c1430", k);
}

export function lighten(color: string, k: number): string {
  return mix(color, "#fff6e8", k);
}

/** رنگ خط دور هر سطح. */
export const outline = (fill: string) => darken(fill, LINE.tint);
/** رنگ لکهٔ سایهٔ هر سطح. */
export const shadow = (fill: string) => darken(fill, SHADE.amount);

export const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
