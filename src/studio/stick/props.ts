/** وسایل خطی سیاه‌وسفید هم‌سبک آدمک‌ها: مبل، میز کوچک، فنجان، بشقاب شیرینی، ساعت، حباب فکر. */
import { INK, PAPER, type Ctx } from "./figure.ts";
import { rng } from "./paper.ts";

function ink(ctx: Ctx, w: number) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function shape(ctx: Ctx, w: number, fill = PAPER) {
  ctx.fillStyle = fill;
  ctx.fill();
  ink(ctx, w);
  ctx.stroke();
}

/**
 * مبل سه‌نفره از روبه‌رو. `cx` وسط، `floor` خط زمین، `seat` ارتفاع روی نشیمن از زمین، `s` مقیاس (۱ = عرض ۸۰۰).
 * پشتی پشت آدم‌ها و دسته‌ها و جلوی نشیمن جلوی پاها کشیده می‌شوند؛ پس دو تابع جدا داریم.
 */
export function sofaBack(ctx: Ctx, cx: number, floor: number, seatTop: number, s: number) {
  const w = 760 * s;
  const lw = 4.6 * s;
  const top = seatTop - 250 * s;
  // پشتی
  ctx.beginPath();
  ctx.roundRect(cx - w / 2 + 40 * s, top, w - 80 * s, seatTop - top + 10 * s, 46 * s);
  shape(ctx, lw);
  // درز کوسن‌های پشتی
  for (const k of [-1, 0, 1]) {
    if (k === 0) continue;
    ctx.beginPath();
    ctx.moveTo(cx + k * (w / 6), top + 26 * s);
    ctx.lineTo(cx + k * (w / 6), seatTop - 6 * s);
    ink(ctx, 3 * s);
    ctx.stroke();
  }
  // نشیمن
  ctx.beginPath();
  ctx.roundRect(cx - w / 2 + 50 * s, seatTop - 8 * s, w - 100 * s, 46 * s, 14 * s);
  shape(ctx, lw);
  ctx.beginPath();
  ctx.moveTo(cx, seatTop - 4 * s);
  ctx.lineTo(cx, seatTop + 36 * s);
  ink(ctx, 3 * s);
  ctx.stroke();
  void floor;
}

export function sofaFront(ctx: Ctx, cx: number, floor: number, seatTop: number, s: number) {
  const w = 760 * s;
  const lw = 4.6 * s;
  // بدنهٔ زیر نشیمن (پشت پاها نیست؛ پاها جلوی آن آویزان‌اند)
  const baseTop = seatTop + 38 * s;
  // دسته‌ها
  for (const side of [-1, 1]) {
    const x = cx + side * (w / 2 - 34 * s);
    ctx.beginPath();
    ctx.roundRect(x - 44 * s, seatTop - 110 * s, 88 * s, floor - 24 * s - (seatTop - 110 * s), 34 * s);
    shape(ctx, lw);
    // پیچ تزئینی سر دسته
    ctx.beginPath();
    ctx.arc(x, seatTop - 76 * s, 15 * s, 0, Math.PI * 2);
    ink(ctx, 3 * s);
    ctx.stroke();
  }
  // پایه‌ها
  for (const side of [-1, 1]) {
    const x = cx + side * (w / 2 - 50 * s);
    ctx.beginPath();
    ctx.moveTo(x - 10 * s, floor - 24 * s);
    ctx.lineTo(x - 6 * s, floor);
    ctx.lineTo(x + 6 * s, floor);
    ctx.lineTo(x + 10 * s, floor - 24 * s);
    shape(ctx, 3.6 * s);
  }
  void baseTop;
}

/** بدنهٔ مبل زیر نشیمن (قبل از پاها کشیده می‌شود). */
export function sofaBase(ctx: Ctx, cx: number, floor: number, seatTop: number, s: number) {
  const w = 760 * s;
  ctx.beginPath();
  ctx.roundRect(cx - w / 2 + 52 * s, seatTop + 36 * s, w - 104 * s, floor - 24 * s - (seatTop + 36 * s), 8 * s);
  shape(ctx, 4.6 * s);
}

export function sideTable(ctx: Ctx, cx: number, floor: number, s: number, cup = true) {
  const top = floor - 150 * s;
  ctx.beginPath();
  ctx.roundRect(cx - 60 * s, top, 120 * s, 14 * s, 6 * s);
  shape(ctx, 4.2 * s);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + side * 42 * s, top + 14 * s);
    ctx.lineTo(cx + side * 50 * s, floor);
    ink(ctx, 4.2 * s);
    ctx.stroke();
  }
  if (cup) mug(ctx, cx, top, s * 0.9);
}

export function mug(ctx: Ctx, cx: number, base: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(cx - 20 * s, base - 46 * s);
  ctx.lineTo(cx + 20 * s, base - 46 * s);
  ctx.lineTo(cx + 16 * s, base);
  ctx.lineTo(cx - 16 * s, base);
  ctx.closePath();
  shape(ctx, 4 * s);
  ctx.beginPath();
  ctx.arc(cx + 24 * s, base - 26 * s, 11 * s, -Math.PI / 2, Math.PI / 2);
  ink(ctx, 4 * s);
  ctx.stroke();
}

/** بخار بالای فنجان، متحرک. */
export function steam(ctx: Ctx, cx: number, top: number, s: number, t: number) {
  ink(ctx, 3 * s);
  ctx.globalAlpha = 0.7;
  for (const k of [-1, 1]) {
    ctx.beginPath();
    const x = cx + k * 8 * s;
    ctx.moveTo(x, top);
    for (let i = 1; i <= 6; i++) {
      ctx.lineTo(x + Math.sin(t * 4 + i + k) * 5 * s, top - i * 7 * s);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function plateOfCookies(ctx: Ctx, cx: number, y: number, s: number) {
  ctx.beginPath();
  ctx.ellipse(cx, y, 48 * s, 11 * s, 0, 0, Math.PI * 2);
  shape(ctx, 3.8 * s);
  for (const dx of [-16, 14]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx * s, y - 7 * s, 15 * s, 6 * s, 0, 0, Math.PI * 2);
    shape(ctx, 3.2 * s);
  }
}

export function wallClock(ctx: Ctx, cx: number, cy: number, s: number, t: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, 58 * s, 0, Math.PI * 2);
  shape(ctx, 4.4 * s);
  ctx.beginPath();
  ctx.arc(cx, cy, 50 * s, 0, Math.PI * 2);
  ink(ctx, 2.4 * s);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 42 * s, cy + Math.sin(a) * 42 * s);
    ctx.lineTo(cx + Math.cos(a) * 47 * s, cy + Math.sin(a) * 47 * s);
    ink(ctx, 3 * s);
    ctx.stroke();
  }
  const hand = (a: number, len: number, w: number) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(a) * len * s, cy - Math.cos(a) * len * s);
    ink(ctx, w * s);
    ctx.stroke();
  };
  hand(t * 0.8, 36, 3);
  hand(1.9 + t * 0.07, 24, 4.4);
}

/**
 * حباب فکر بالای سر، با «فکرهای درهم» داخلش که با `amount` (۰ تا ۱) بیشتر می‌شوند.
 * (hx, hy) بالای سرِ صاحب فکر است.
 */
export function thoughtBubble(
  ctx: Ctx,
  hx: number,
  hy: number,
  cx: number,
  cy: number,
  s: number,
  grow: number,
  amount: number,
  t: number,
) {
  if (grow <= 0) return;
  const g = Math.min(1, grow);
  // دایره‌های کوچک
  const steps = [0.25, 0.5, 0.72];
  steps.forEach((k, i) => {
    if (g < k) return;
    const x = hx + (cx - hx) * k * 0.7;
    const y = hy + (cy - hy) * k * 0.7;
    ctx.beginPath();
    ctx.arc(x, y, (7 + i * 6) * s, 0, Math.PI * 2);
    shape(ctx, 4 * s);
  });
  if (g < 0.8) return;
  const k = Math.min(1, (g - 0.8) / 0.2);
  const rw = 250 * s * (0.6 + 0.4 * k);
  const rh = 150 * s * (0.6 + 0.4 * k);
  // ابر: دایره‌های روی بیضی
  ctx.beginPath();
  const n = 11;
  for (let i = 0; i <= n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const x0 = cx + Math.cos(a0) * rw;
    const y0 = cy + Math.sin(a0) * rh;
    const am = (a0 + a1) / 2;
    const bx = cx + Math.cos(am) * rw * 1.28;
    const by = cy + Math.sin(am) * rh * 1.28;
    const x1 = cx + Math.cos(a1) * rw;
    const y1 = cy + Math.sin(a1) * rh;
    if (i === 0) ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(bx, by, x1, y1);
  }
  ctx.closePath();
  shape(ctx, 4.4 * s);
  // فکرهای درهم: یک «کلاف» پیچ‌درپیچ وسط ابر که با `amount` شلوغ‌تر می‌شود، و چند علامت سؤال.
  const r = rng(11);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rw * 0.95, rh * 0.9, 0, 0, Math.PI * 2);
  ctx.clip();
  const loops = 2 + Math.floor(amount * 7);
  ctx.beginPath();
  let first = true;
  for (let i = 0; i < loops; i++) {
    const ox = cx + (r() - 0.5) * rw * 0.5;
    const oy = cy + (r() - 0.5) * rh * 0.45;
    const rad = (48 + r() * 36) * s;
    const ph = r() * 6 + t * 0.8;
    for (let a = 0; a < Math.PI * 2.2; a += 0.18) {
      const x = ox + Math.cos(a + ph) * rad;
      const y = oy + Math.sin(a * 1.15 + ph) * rad * 0.62;
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else ctx.lineTo(x, y);
    }
  }
  ink(ctx, 3.4 * s);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `800 ${Math.round(84 * s)}px Vazirmatn, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const qs = Math.min(3, Math.floor(amount * 4));
  const spots = [
    [-0.62, -0.25],
    [0.62, -0.18],
    [0.0, 0.52],
  ];
  for (let i = 0; i < qs; i++) {
    const [px, py] = spots[i];
    ctx.save();
    ctx.translate(cx + px * rw, cy + py * rh + Math.sin(t * 3 + i) * 6 * s);
    ctx.rotate((i - 1) * 0.25);
    ctx.fillText("؟", 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
