/**
 * پس‌زمینهٔ کاغذ مچاله، تماماً با کد: شبکه‌ای از مثلث‌های نامنظم که هرکدام کمی روشن‌تر یا
 * تیره‌تر از کاغذ‌اند (مثل سطح‌های چین‌خورده)، چند خط چین روشن/تیره و کمی دانه.
 * با بذر ثابت ساخته می‌شود تا هر فریم و هر بار خروجی یکسان باشد.
 */
import type { Ctx, RenderCanvas } from "./figure-base.ts";

export function makeCanvas(w: number, h: number): RenderCanvas {
  const c = typeof document === "undefined" ? new OffscreenCanvas(w, h) : document.createElement("canvas");
  c.width = w; c.height = h; return c;
}

/** عدد شبه‌تصادفی قطعی (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** کاغذ را روی یک بوم جدا می‌کشد (یک بار)؛ بعد هر فریم فقط کپی می‌شود. */
export function makePaper(w: number, h: number, seed = 7): RenderCanvas {
  const c = makeCanvas(w, h);
  // نقاشی با وضوح کم و بزرگ‌نمایی نرم، لبه‌های چین‌ها را نرم می‌کند.
  const k = 0.5;
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  const ctx = c.getContext("2d")! as Ctx;
  const r = rng(seed);
  ctx.fillStyle = "#e8e8e6";
  ctx.fillRect(0, 0, c.width, c.height);
  const cols = 9;
  const rows = 16;
  const cw = c.width / cols;
  const ch = c.height / rows;
  const pts: { x: number; y: number }[][] = [];
  for (let y = 0; y <= rows; y++) {
    pts.push([]);
    for (let x = 0; x <= cols; x++) {
      const edge = x === 0 || y === 0 || x === cols || y === rows;
      pts[y].push({
        x: x * cw + (edge ? 0 : (r() - 0.5) * cw * 0.9),
        y: y * ch + (edge ? 0 : (r() - 0.5) * ch * 0.9),
      });
    }
  }
  const tri = (a: { x: number; y: number }, b: { x: number; y: number }, d: { x: number; y: number }) => {
    const v = Math.round(233 + (r() - 0.5) * 9);
    const g = ctx.createLinearGradient(a.x, a.y, d.x, d.y);
    g.addColorStop(0, `rgb(${v + 3},${v + 3},${v + 2})`);
    g.addColorStop(1, `rgb(${v - 3},${v - 3},${v - 4})`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const p00 = pts[y][x];
      const p10 = pts[y][x + 1];
      const p01 = pts[y + 1][x];
      const p11 = pts[y + 1][x + 1];
      if (r() < 0.5) {
        tri(p00, p10, p11);
        tri(p00, p11, p01);
      } else {
        tri(p00, p10, p01);
        tri(p10, p11, p01);
      }
    }
  }
  // خط‌های چین: یک لبهٔ روشن و یک سایهٔ تیره کنار هم
  for (let i = 0; i < 14; i++) {
    const y0 = Math.floor(r() * rows);
    const x0 = Math.floor(r() * cols);
    const a = pts[y0][x0];
    const b = pts[Math.min(rows, y0 + 1 + Math.floor(r() * 2))][Math.min(cols, x0 + 1)];
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(120,120,118,0.12)";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(a.x + 1.5, a.y + 1.5);
    ctx.lineTo(b.x + 1.5, b.y + 1.5);
    ctx.stroke();
  }
  // دانهٔ ریز کاغذ
  const img = ctx.getImageData(0, 0, c.width, c.height);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 7;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const out = makeCanvas(w, h);
  out.width = w;
  out.height = h;
  const o = out.getContext("2d")! as Ctx;
  o.imageSmoothingQuality = "high";
  o.filter = "blur(1.2px)";
  o.drawImage(c, 0, 0, w, h);
  return out;
}

export function drawPaper(ctx: Ctx, paper: RenderCanvas) {
  ctx.drawImage(paper, 0, 0);
}
