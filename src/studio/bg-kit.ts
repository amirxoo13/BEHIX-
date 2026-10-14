/**
 * ابزارهای مشترک نقاشی پس‌زمینه‌ها (همان سبک تخت با خط دور تیره).
 * هر صحنه نسخهٔ «روز» را می‌کشد و چراغ‌هایش را در `look.lights` ثبت می‌کند؛
 * در حالت شب، draw-bg.ts یک لایهٔ تاریک رویش می‌کشد و بعد چراغ‌ها را روشن می‌کند.
 */
export type Ctx = CanvasRenderingContext2D;

export const INK = "#1a120c";

export type Light =
  | { kind: "glow"; x: number; y: number; r: number; color: string }
  | { kind: "rect"; x: number; y: number; w: number; h: number; color: string };

export type Look = {
  variant: number;
  night: boolean;
  time: number;
  scroll: number;
  lights: Light[];
};

export function wrap(n: number, m: number) {
  return ((n % m) + m) % m;
}

export function pick<T>(arr: readonly T[], i: number): T {
  return arr[wrap(i, arr.length)];
}

export function box(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  opts: { stroke?: string | null; lw?: number; r?: number } = {},
) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  if (opts.r) ctx.roundRect(x, y, w, h, opts.r);
  else ctx.rect(x, y, w, h);
  ctx.fill();
  if (opts.stroke !== null) {
    ctx.strokeStyle = opts.stroke ?? INK;
    ctx.lineWidth = opts.lw ?? 3;
    ctx.stroke();
  }
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string, stroke: string | null = INK, lw = 3) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color = INK, lw = 3) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function poly(ctx: Ctx, pts: [number, number][], fill: string, stroke: string | null = INK, lw = 3) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/** آسمان با خورشید یا ماه و ستاره. */
export function sky(ctx: Ctx, w: number, h: number, horizon: number, night: boolean, time = 0) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  if (night) {
    g.addColorStop(0, "#0b1022");
    g.addColorStop(1, "#22305a");
  } else {
    g.addColorStop(0, "#7ec3ea");
    g.addColorStop(1, "#cfe9f5");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, horizon);
  if (night) {
    ctx.fillStyle = "#f4efe6";
    for (let i = 0; i < 40; i++) {
      const x = (i * 137.5) % w;
      const y = ((i * 71.3) % (horizon * 0.8)) + 4;
      ctx.globalAlpha = 0.4 + 0.4 * Math.abs(Math.sin(time * 1.3 + i));
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    circle(ctx, w * 0.84, horizon * 0.22, Math.min(w, h) * 0.04, "#f4efe6", null);
    circle(ctx, w * 0.84 + 9, horizon * 0.22 - 5, Math.min(w, h) * 0.035, "#22305a", null);
  } else {
    circle(ctx, w * 0.86, horizon * 0.22, Math.min(w, h) * 0.05, "#ffd86b", null);
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.85;
    for (const [cx, cy, s] of [
      [0.18, 0.22, 1],
      [0.5, 0.12, 0.8],
      [0.68, 0.3, 0.6],
    ] as const) {
      const x = w * cx + wrap(time * 6, w * 0.2);
      const y = horizon * cy;
      const r = Math.min(w, h) * 0.035 * s;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.arc(x + r * 1.1, y - r * 0.4, r * 1.2, 0, Math.PI * 2);
      ctx.arc(x + r * 2.2, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** پنجره با قاب و میله‌های صلیبی؛ داخلش آسمانِ روز یا شب. */
export function windowPane(
  ctx: Ctx,
  look: Look,
  x: number,
  y: number,
  w: number,
  h: number,
  frame = "#6b3a22",
  curtains?: string,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, look.night ? "#0b1022" : "#7ec3ea");
  g.addColorStop(1, look.night ? "#2a3a6a" : "#d6eef8");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  if (look.night) circle(ctx, x + w * 0.7, y + h * 0.3, Math.min(w, h) * 0.12, "#f4efe6", null);
  else {
    // ساختمان‌های دور پشت پنجره
    ctx.fillStyle = "#b9c8d6";
    for (let i = 0; i < 4; i++) ctx.fillRect(x + (w / 4) * i + 4, y + h * (0.55 + (i % 2) * 0.12), w / 4 - 8, h);
  }
  ctx.restore();
  ctx.strokeStyle = frame;
  ctx.lineWidth = Math.max(5, w * 0.04);
  ctx.strokeRect(x, y, w, h);
  line(ctx, x + w / 2, y, x + w / 2, y + h, frame, Math.max(4, w * 0.025));
  line(ctx, x, y + h / 2, x + w, y + h / 2, frame, Math.max(4, w * 0.025));
  if (curtains) {
    for (const side of [0, 1]) {
      const cx = side ? x + w - w * 0.08 : x - w * 0.14;
      poly(ctx, [
        [cx, y - h * 0.08],
        [cx + w * 0.22, y - h * 0.08],
        [cx + w * (side ? 0.12 : 0.1), y + h * 1.05],
        [cx - w * 0.02, y + h * 1.05],
      ], curtains, INK, 2);
    }
    box(ctx, x - w * 0.18, y - h * 0.12, w * 1.36, h * 0.06, "#6b3a22", { lw: 2 });
  }
}

/** لایهٔ تاریکِ شب؛ بعد از آن چراغ‌ها روشن می‌شوند. */
export function applyNight(ctx: Ctx, w: number, h: number, look: Look, strength: number) {
  ctx.fillStyle = `rgba(10, 14, 36, ${strength})`;
  ctx.fillRect(0, 0, w, h);
  for (const l of look.lights) {
    if (l.kind === "rect") {
      ctx.fillStyle = l.color;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(l.x, l.y, l.w, l.h);
      ctx.globalAlpha = 1;
    } else {
      const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      g.addColorStop(0, l.color);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = g;
      ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      ctx.restore();
    }
  }
}

/** چراغ آویز سقفی (روز خاموش، شب نور می‌دهد). */
export function pendant(ctx: Ctx, look: Look, x: number, y: number, len: number, shade: string, size = 22) {
  line(ctx, x, 0, x, y + len - size * 0.6, INK, 2);
  poly(ctx, [
    [x - size, y + len],
    [x + size, y + len],
    [x + size * 0.45, y + len - size * 0.7],
    [x - size * 0.45, y + len - size * 0.7],
  ], shade);
  look.lights.push({ kind: "glow", x, y: y + len + size, r: size * 7, color: "#ffd98a" });
}

export function plant(ctx: Ctx, x: number, y: number, s: number, pot = "#c2412d") {
  for (let i = -2; i <= 2; i++) {
    ctx.fillStyle = i % 2 ? "#3f8f62" : "#2f6b3a";
    ctx.beginPath();
    ctx.ellipse(x + i * 7 * s, y - 36 * s - Math.abs(i) * -6 * s, 8 * s, 22 * s, i * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  poly(ctx, [
    [x - 16 * s, y - 20 * s],
    [x + 16 * s, y - 20 * s],
    [x + 11 * s, y],
    [x - 11 * s, y],
  ], pot);
}

export function door(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  box(ctx, x, y, w, h, color);
  box(ctx, x + w * 0.12, y + h * 0.08, w * 0.76, h * 0.36, "rgba(255,255,255,0.12)", { lw: 2 });
  box(ctx, x + w * 0.12, y + h * 0.52, w * 0.76, h * 0.4, "rgba(255,255,255,0.12)", { lw: 2 });
  circle(ctx, x + w * 0.82, y + h * 0.52, Math.max(3, w * 0.05), "#e4b15a", INK, 2);
}

/** فرش ایرانی ساده با حاشیه و ترنج. */
export function rug(ctx: Ctx, x: number, y: number, w: number, h: number, base: string, edge: string) {
  box(ctx, x, y, w, h, base, { lw: 2 });
  ctx.strokeStyle = edge;
  ctx.lineWidth = Math.max(4, h * 0.08);
  ctx.strokeRect(x + h * 0.12, y + h * 0.12, w - h * 0.24, h - h * 0.24);
  ctx.fillStyle = edge;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w * 0.12, h * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4efe6";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h / 2, w * 0.05, h * 0.09, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function tiles(ctx: Ctx, x: number, y: number, w: number, h: number, size: number, base: string, grout: string) {
  ctx.fillStyle = base;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = grout;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let tx = x; tx <= x + w; tx += size) {
    ctx.moveTo(tx, y);
    ctx.lineTo(tx, y + h);
  }
  for (let ty = y; ty <= y + h; ty += size) {
    ctx.moveTo(x, ty);
    ctx.lineTo(x + w, ty);
  }
  ctx.stroke();
}

/** دیوار ساده با گرادیان ملایم و قرنیز. */
export function wall(ctx: Ctx, w: number, floorY: number, top: string, bottom: string) {
  const g = ctx.createLinearGradient(0, 0, 0, floorY);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, floorY);
}

export function floor(ctx: Ctx, w: number, h: number, y: number, color: string, plank?: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, y, w, h - y);
  if (plank) {
    ctx.strokeStyle = plank;
    ctx.lineWidth = 2;
    for (let py = y + 14; py < h; py += 22) line(ctx, 0, py, w, py, plank, 2);
  }
  line(ctx, 0, y, w, y, INK, 4);
}

export function sign(ctx: Ctx, text: string, x: number, y: number, size: number, fg: string, bg?: string) {
  ctx.font = `700 ${size}px Vazirmatn, Tahoma, sans-serif`;
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (bg) {
    const tw = ctx.measureText(text).width;
    box(ctx, x - tw / 2 - size * 0.5, y - size * 0.75, tw + size, size * 1.5, bg, { lw: 2, r: 6 });
  }
  ctx.fillStyle = fg;
  ctx.fillText(text, x, y);
  ctx.textBaseline = "alphabetic";
}

/** درخت گرد (پارک، حیاط، بلوار). */
export function tree(ctx: Ctx, x: number, baseY: number, s: number, leaf = "#3f8f62", sway = 0) {
  box(ctx, x - 8 * s, baseY - 90 * s, 16 * s, 90 * s, "#6b3a22");
  circle(ctx, x + sway, baseY - 120 * s, 50 * s, leaf);
  circle(ctx, x - 30 * s + sway, baseY - 95 * s, 32 * s, leaf);
  circle(ctx, x + 32 * s + sway, baseY - 98 * s, 30 * s, leaf);
}

/** سرو (بلوارها و باغ ایرانی). */
export function cypress(ctx: Ctx, x: number, baseY: number, s: number) {
  box(ctx, x - 4 * s, baseY - 20 * s, 8 * s, 20 * s, "#6b3a22", { lw: 2 });
  ctx.fillStyle = "#2f6b3a";
  ctx.beginPath();
  ctx.ellipse(x, baseY - 80 * s, 18 * s, 64 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** نمای ساختمان با پنجره‌هایی که شب روشن می‌شوند. */
export function building(
  ctx: Ctx,
  look: Look,
  x: number,
  topY: number,
  w: number,
  baseY: number,
  color: string,
  opts: { cols?: number; glass?: boolean; rowH?: number } = {},
) {
  box(ctx, x, topY, w, baseY - topY, color);
  const cols = opts.cols ?? Math.max(2, Math.round(w / 46));
  const rowH = opts.rowH ?? 40;
  const cw = w / cols;
  let k = 0;
  for (let y = topY + 14; y < baseY - rowH * 0.8; y += rowH) {
    for (let c = 0; c < cols; c++) {
      const wx = x + c * cw + cw * 0.22;
      const ww = cw * 0.56;
      const wh = rowH * 0.55;
      box(ctx, wx, y, ww, wh, opts.glass ? "#9fc6dc" : "#cfe3ee", { lw: 2 });
      if ((k++ * 7) % 5 < 3) look.lights.push({ kind: "rect", x: wx, y, w: ww, h: wh, color: "#ffd98a" });
    }
  }
}

/** چراغ برق خیابان. */
export function streetLamp(ctx: Ctx, look: Look, x: number, baseY: number, hgt: number) {
  box(ctx, x - 4, baseY - hgt, 8, hgt, "#3a3f46", { lw: 2 });
  box(ctx, x - 4, baseY - hgt, 34, 6, "#3a3f46", { lw: 2 });
  box(ctx, x + 20, baseY - hgt + 4, 16, 10, "#f4efe6", { lw: 2 });
  look.lights.push({ kind: "glow", x: x + 28, y: baseY - hgt + 30, r: hgt * 0.7, color: "#ffd98a" });
}

export function car(
  ctx: Ctx,
  kind: "peykan" | "pride" | "samand" | "hatch" | "modern" | "taxi" | "suv",
  x: number,
  y: number,
  s: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.lineJoin = "round";
  const body: Record<string, [string, string]> = {
    peykan: ["#e7d3a1", "#9fd4ea"],
    pride: ["#3f8f62", "#b9e2f2"],
    samand: ["#f4f1ea", "#9fd4ea"],
    hatch: ["#c5ccd6", "#d5eef8"],
    modern: ["#f7f7f5", "#1f2933"],
    taxi: ["#f2c230", "#9fd4ea"],
    suv: ["#1f2933", "#4b5563"],
  };
  const [c, glass] = body[kind];
  const tall = kind === "suv" ? 10 : 0;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.roundRect(-78, -32 - tall, 156, 38 + tall, kind === "peykan" ? 2 : 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.roundRect(-34, -52 - tall, 78, 22, 6);
  ctx.fill();
  ctx.stroke();
  if (kind === "taxi") {
    box(ctx, -12, -64, 28, 10, "#f4efe6", { lw: 2 });
    ctx.fillStyle = "#1a120c";
    ctx.fillRect(-78, -14, 156, 4);
  }
  ctx.fillStyle = "#e4b15a";
  ctx.fillRect(66, -22 - tall, 10, 6);
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-44, 8, 13, 0, Math.PI * 2);
  ctx.arc(44, 8, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d7d2c8";
  ctx.beginPath();
  ctx.arc(-44, 8, 5, 0, Math.PI * 2);
  ctx.arc(44, 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
