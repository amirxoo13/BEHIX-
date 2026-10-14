import type { BgId } from "./types";

const INK = "#1a120c";

function car(
  ctx: CanvasRenderingContext2D,
  kind: "peykan" | "pride" | "samand" | "hatch" | "modern",
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
  if (kind === "peykan") {
    ctx.fillStyle = "#e7d3a1";
    ctx.fillRect(-70, -28, 140, 36);
    ctx.strokeRect(-70, -28, 140, 36);
    ctx.fillStyle = "#f3e6c4";
    ctx.fillRect(-78, -8, 156, 16);
    ctx.strokeRect(-78, -8, 156, 16);
    ctx.fillStyle = "#9fd4ea";
    ctx.fillRect(-28, -48, 70, 22);
    ctx.strokeRect(-28, -48, 70, 22);
    ctx.fillStyle = "#f4efe6";
    ctx.beginPath();
    ctx.arc(-52, -18, 8, 0, Math.PI * 2);
    ctx.arc(52, -18, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (kind === "pride") {
    ctx.fillStyle = "#3f8f62";
    ctx.beginPath();
    ctx.roundRect(-62, -36, 124, 40, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d6ec9a";
    ctx.fillRect(-62, -8, 124, 10);
    ctx.fillStyle = "#b9e2f2";
    ctx.fillRect(-20, -52, 52, 18);
    ctx.strokeRect(-20, -52, 52, 18);
  } else if (kind === "samand") {
    ctx.fillStyle = "#f4f1ea";
    ctx.beginPath();
    ctx.roundRect(-78, -32, 156, 38, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#9fd4ea";
    ctx.fillRect(-24, -50, 78, 20);
    ctx.strokeRect(-24, -50, 78, 20);
  } else if (kind === "hatch") {
    ctx.fillStyle = "#c5ccd6";
    ctx.beginPath();
    ctx.roundRect(-58, -34, 112, 38, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#d5eef8";
    ctx.beginPath();
    ctx.roundRect(-8, -52, 48, 20, 6);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.fillStyle = "#f7f7f5";
    ctx.beginPath();
    ctx.roundRect(-80, -30, 160, 36, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1f2933";
    ctx.fillRect(-36, -48, 86, 18);
    ctx.strokeRect(-36, -48, 86, 18);
    ctx.fillStyle = "#e4b15a";
    ctx.fillRect(62, -22, 12, 6);
  }
  ctx.fillStyle = "#1a120c";
  ctx.beginPath();
  ctx.arc(-40, 8, 12, 0, Math.PI * 2);
  ctx.arc(40, 8, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#d7d2c8";
  ctx.beginPath();
  ctx.arc(-40, 8, 5, 0, Math.PI * 2);
  ctx.arc(40, 8, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function wrap(n: number, m: number) {
  return ((n % m) + m) % m;
}

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  id: BgId,
  w: number,
  h: number,
  scroll: number,
  time: number,
) {
  ctx.save();
  if (id === "living") living(ctx, w, h);
  else if (id === "kitchen") kitchen(ctx, w, h);
  else if (id === "yard") yard(ctx, w, h, time);
  else if (id === "cafe") cafe(ctx, w, h, time);
  else if (id === "streetDay" || id === "streetNight") street(ctx, w, h, scroll, id === "streetNight", time);
  else if (id === "park") park(ctx, w, h, scroll, time);
  else cabin(ctx, w, h, time);
  ctx.restore();
}

function ground(ctx: CanvasRenderingContext2D, w: number, h: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(0, y, w, h - y);
}

function living(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const wall = ctx.createLinearGradient(0, 0, 0, h * 0.72);
  wall.addColorStop(0, "#f6e7c8");
  wall.addColorStop(1, "#e7c48a");
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#8ec8e6";
  ctx.fillRect(w * 0.38, h * 0.08, w * 0.24, h * 0.22);
  ctx.strokeStyle = "#6b3a22";
  ctx.lineWidth = 8;
  ctx.strokeRect(w * 0.38, h * 0.08, w * 0.24, h * 0.22);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.08);
  ctx.lineTo(w * 0.5, h * 0.3);
  ctx.moveTo(w * 0.38, h * 0.19);
  ctx.lineTo(w * 0.62, h * 0.19);
  ctx.stroke();
  ctx.fillStyle = "#f4efe6";
  ctx.fillRect(w * 0.08, h * 0.1, w * 0.16, h * 0.14);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.strokeRect(w * 0.08, h * 0.1, w * 0.16, h * 0.14);
  ctx.fillStyle = "#3f8f62";
  ctx.fillRect(w * 0.09, h * 0.12, w * 0.14, h * 0.1);
  ctx.fillStyle = "#6b3a22";
  ctx.fillRect(0, h * 0.68, w, 12);
  ground(ctx, w, h, h * 0.7, "#8c2f2f");
  ctx.strokeStyle = "#e4b15a";
  ctx.lineWidth = 6;
  ctx.strokeRect(w * 0.04, h * 0.74, w * 0.92, h * 0.2);
  ctx.strokeStyle = "#2a4f8f";
  ctx.lineWidth = 3;
  ctx.strokeRect(w * 0.07, h * 0.77, w * 0.86, h * 0.14);
  for (const px of [w * 0.06, w * 0.78]) {
    ctx.fillStyle = "#7a2430";
    ctx.beginPath();
    ctx.roundRect(px, h * 0.5, w * 0.16, h * 0.18, 10);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.fillStyle = "#c5ccd6";
  ctx.fillRect(w * 0.7, h * 0.28, w * 0.18, h * 0.16);
  ctx.strokeRect(w * 0.7, h * 0.28, w * 0.18, h * 0.16);
  ctx.fillStyle = "#1a120c";
  ctx.fillRect(w * 0.72, h * 0.3, w * 0.14, h * 0.1);
  label(ctx, "بخاری", w * 0.79, h * 0.48, 18, "#1a120c");
}

function kitchen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#f3e6d0";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#efe2cf";
  for (let y = h * 0.08; y < h * 0.62; y += 28) {
    for (let x = 0; x < w; x += 56) {
      ctx.strokeStyle = "#e0cba8";
      ctx.strokeRect(x, y, 54, 26);
    }
  }
  ctx.fillStyle = "#6b3a22";
  ctx.fillRect(0, h * 0.58, w, h * 0.18);
  ctx.fillStyle = "#d7d2c8";
  ctx.fillRect(w * 0.08, h * 0.42, w * 0.28, h * 0.2);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(w * 0.08, h * 0.42, w * 0.28, h * 0.2);
  ctx.fillStyle = "#e4b15a";
  ctx.beginPath();
  ctx.ellipse(w * 0.22, h * 0.4, 28, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#8c2f2f";
  ctx.beginPath();
  ctx.arc(w * 0.22, h * 0.36, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f4efe6";
  ctx.fillRect(w * 0.62, h * 0.28, w * 0.22, h * 0.36);
  ctx.strokeRect(w * 0.62, h * 0.28, w * 0.22, h * 0.36);
  ctx.fillStyle = "#9fd4ea";
  ctx.fillRect(w * 0.66, h * 0.34, w * 0.14, h * 0.1);
  ground(ctx, w, h, h * 0.76, "#c4b39a");
  label(ctx, "آشپزخانه", w * 0.5, h * 0.12, 28, "#6b3a22");
}

function yard(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  ctx.fillStyle = "#8ec8e6";
  ctx.fillRect(0, 0, w, h * 0.55);
  ctx.fillStyle = "#c4a484";
  ctx.fillRect(0, h * 0.42, w, h * 0.2);
  ground(ctx, w, h, h * 0.62, "#c4b39a");
  ctx.fillStyle = "#3f8f62";
  ctx.beginPath();
  ctx.arc(w * 0.16, h * 0.48, w * 0.1, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#6b3a22";
  ctx.fillRect(w * 0.15, h * 0.48, 14, h * 0.2);
  ctx.fillStyle = "#7eb8d4";
  ctx.beginPath();
  ctx.ellipse(w * 0.48, h * 0.7, w * 0.16, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2a4f8f";
  ctx.stroke();
  const ripple = 1 + Math.sin(time * 2) * 0.04;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.ellipse(w * 0.48, h * 0.7, w * 0.08 * ripple, h * 0.025, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#6b3a22";
  ctx.fillRect(w * 0.78, h * 0.28, w * 0.14, h * 0.36);
  ctx.fillStyle = "#e7d3a1";
  ctx.fillRect(w * 0.8, h * 0.36, w * 0.1, h * 0.2);
  label(ctx, "حوض حیاط", w * 0.48, h * 0.78, 20, "#f4efe6");
}

function cafe(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  ctx.fillStyle = "#6b3a22";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "#8a4b2a";
  for (let y = 20; y < h * 0.62; y += 34) {
    for (let x = y % 68 === 0 ? 0 : -30; x < w; x += 72) ctx.strokeRect(x, y, 68, 30);
  }
  ctx.beginPath();
  ctx.moveTo(0, 40);
  ctx.quadraticCurveTo(w * 0.5, 110, w, 40);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  const colors = ["#c2412d", "#e4b15a", "#3f8f62", "#7eb8d4"];
  for (let i = 1; i < 9; i++) {
    const lx = (w / 9) * i;
    const ly = 40 + Math.sin((i / 9) * Math.PI) * 36;
    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = 0.75 + Math.sin(time * 4 + i) * 0.25;
    ctx.beginPath();
    ctx.arc(lx, ly + 10, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ground(ctx, w, h, h * 0.7, "#5a4632");
  ctx.fillStyle = "#e4b15a";
  ctx.beginPath();
  ctx.roundRect(w * 0.46, h * 0.48, 48, 80, 16);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = "#c2412d";
  ctx.beginPath();
  ctx.arc(w * 0.46 + 24, h * 0.46, 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  label(ctx, "قهوه‌خانه", w * 0.2, h * 0.16, 26, "#f4efe6");
}

function street(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scroll: number,
  night: boolean,
  time: number,
) {
  ctx.fillStyle = night ? "#141a28" : "#8ec8e6";
  ctx.fillRect(0, 0, w, h);
  if (night) {
    ctx.fillStyle = "#f4efe6";
    ctx.beginPath();
    ctx.arc(w * 0.84, h * 0.12, 26, 0, Math.PI * 2);
    ctx.fill();
  }
  const span = 420;
  for (let i = -1; i < w / span + 2; i++) {
    const x = i * span - wrap(scroll * 0.35, span);
    ctx.fillStyle = night ? "#1c2433" : "#e7d7c0";
    const bh = h * (0.28 + (i % 3) * 0.06);
    ctx.fillRect(x, h * 0.42 - bh, 280, bh + h * 0.2);
    ctx.fillStyle = night ? "#e4b15a" : "#f4efe6";
    for (let wy = h * 0.42 - bh + 20; wy < h * 0.4; wy += 36) {
      ctx.globalAlpha = night ? 0.45 + Math.sin(time * 2 + wy) * 0.2 : 1;
      ctx.fillRect(x + 24, wy, 28, 22);
      ctx.fillRect(x + 80, wy, 28, 22);
      ctx.fillRect(x + 150, wy, 28, 22);
      ctx.globalAlpha = 1;
    }
  }
  ctx.fillStyle = night ? "#2a241c" : "#d9d0c3";
  ctx.fillRect(0, h * 0.58, w, h * 0.12);
  ctx.fillStyle = "#3a3f46";
  ctx.fillRect(0, h * 0.68, w, h);
  ctx.strokeStyle = "#e4b15a";
  ctx.lineWidth = 4;
  ctx.setLineDash([28, 22]);
  ctx.beginPath();
  const dashOff = wrap(scroll, 50);
  ctx.moveTo(-dashOff, h * 0.82);
  ctx.lineTo(w + 50, h * 0.82);
  ctx.stroke();
  ctx.setLineDash([]);
  const cars = ["peykan", "pride", "samand", "hatch", "modern"] as const;
  const gap = 230;
  for (let i = -1; i < w / gap + 2; i++) {
    const x = i * gap - wrap(scroll, gap) + 80;
    car(ctx, cars[(i + 5) % cars.length], x, h * 0.7, Math.min(1.15, w / 900));
  }
  if (night) {
    ctx.fillStyle = "#3a3228";
    ctx.fillRect(w * 0.1, h * 0.42, 8, h * 0.2);
    ctx.fillStyle = "#e4b15a";
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.42);
    ctx.lineTo(w * 0.02, h * 0.7);
    ctx.lineTo(w * 0.2, h * 0.7);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function park(ctx: CanvasRenderingContext2D, w: number, h: number, scroll: number, time: number) {
  ctx.fillStyle = "#8ec8e6";
  ctx.fillRect(0, 0, w, h * 0.62);
  ground(ctx, w, h, h * 0.62, "#5f8f4a");
  ctx.fillStyle = "#c4b39a";
  ctx.fillRect(0, h * 0.78, w, h * 0.08);
  const span = 280;
  for (let i = -1; i < w / span + 2; i++) {
    const x = i * span - wrap(scroll * 0.5, span);
    const sway = Math.sin(time * 1.4 + i) * 6;
    ctx.fillStyle = "#6b3a22";
    ctx.fillRect(x + 70, h * 0.48, 16, h * 0.2);
    ctx.fillStyle = i % 2 === 0 ? "#2f6b3a" : "#3f8f62";
    ctx.beginPath();
    ctx.arc(x + 78 + sway, h * 0.4, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.fillStyle = "#6b3a22";
  ctx.fillRect(w * 0.62, h * 0.66, w * 0.22, 12);
  ctx.fillRect(w * 0.66, h * 0.66, 8, h * 0.12);
  ctx.fillRect(w * 0.78, h * 0.66, 8, h * 0.12);
}

function cabin(ctx: CanvasRenderingContext2D, w: number, h: number, time: number) {
  ctx.fillStyle = "#2a241c";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#8ec8e6";
  ctx.fillRect(w * 0.12, h * 0.08, w * 0.76, h * 0.42);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.strokeRect(w * 0.12, h * 0.08, w * 0.76, h * 0.42);
  ctx.fillStyle = "#6b7280";
  ctx.fillRect(w * 0.18, h * 0.56, w * 0.64, h * 0.28);
  ctx.fillStyle = "#1a120c";
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.72, Math.min(w, h) * 0.08, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.64);
  ctx.lineTo(w * 0.5, h * 0.8);
  ctx.moveTo(w * 0.44, h * 0.72);
  ctx.lineTo(w * 0.56, h * 0.72);
  ctx.stroke();
  ctx.fillStyle = "#e4b15a";
  ctx.globalAlpha = 0.8 + Math.sin(time * 6) * 0.2;
  ctx.fillRect(w * 0.7, h * 0.62, 16, 8);
  ctx.globalAlpha = 1;
  label(ctx, "داخل ماشین", w * 0.5, h * 0.9, 22, "#f4efe6");
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  ctx.fillStyle = color;
  ctx.font = `700 ${size}px Vazirmatn, Tahoma, sans-serif`;
  ctx.textAlign = "center";
  ctx.direction = "rtl";
  ctx.fillText(text, x, y);
}

export const BG_LABEL: Record<BgId, string> = {
  living: "نشیمن خانه",
  kitchen: "آشپزخانه",
  yard: "حیاط و حوض",
  cafe: "قهوه‌خانه",
  streetDay: "خیابان روز",
  streetNight: "خیابان شب",
  park: "پارک",
  car: "داخل ماشین",
};
