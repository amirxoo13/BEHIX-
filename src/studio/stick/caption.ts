/**
 * زیرنویس روایت: کادر سیاه با گوشهٔ گرد و متن سفید پررنگ وسط‌چین، حداکثر دو خط.
 * با یک «پاپ» کوتاه ظاهر می‌شود. متن RTL است.
 */
import type { Ctx } from "./figure.ts";

function wrap(ctx: Ctx, text: string, max: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > max && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** `age` زمان از ظاهر شدن زیرنویس (ثانیه). */
export function drawCaption(ctx: Ctx, text: string, w: number, cy: number, age: number) {
  if (!text.trim() || age < 0) return;
  const size = Math.round(w * 0.05);
  ctx.save();
  ctx.font = `800 ${size}px Vazirmatn, Tahoma, sans-serif`;
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrap(ctx, text, w * 0.84).slice(0, 3);
  const lh = size * 1.45;
  const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const bw = tw + size * 1.4;
  const bh = lines.length * lh + size * 0.8;
  const pop = Math.min(1, age / 0.18);
  const k = 0.86 + 0.14 * (1 - Math.pow(1 - pop, 3)) + (pop < 1 ? 0 : 0);
  ctx.globalAlpha = Math.min(1, age / 0.1);
  ctx.translate(w / 2, cy);
  ctx.scale(k, k);
  ctx.fillStyle = "#0b0b0b";
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, size * 0.4);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  lines.forEach((l, i) => ctx.fillText(l, 0, -bh / 2 + size * 0.4 + lh * (i + 0.5)));
  ctx.restore();
}
