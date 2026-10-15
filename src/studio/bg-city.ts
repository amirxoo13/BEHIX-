/** بیرون، قهوه‌خانه و کافه، و مکان‌های تهران — هر کدام سه طرح. */
import {
  INK,
  box,
  building,
  car,
  circle,
  cypress,
  door,
  floor,
  line,
  pendant,
  pick,
  plant,
  poly,
  rug,
  sign,
  sky,
  streetLamp,
  tree,
  wall,
  windowPane,
  wrap,
  type Ctx,
  type Look,
} from "./bg-kit.ts";

const CARS = ["peykan", "pride", "samand", "hatch", "modern", "taxi", "suv"] as const;

/** جاده با خط‌کشی و ماشین‌های در حال عبور. */
function road(ctx: Ctx, w: number, h: number, look: Look, y: number, carSet: readonly (typeof CARS)[number][]) {
  ctx.fillStyle = "#3a3f46";
  ctx.fillRect(0, y, w, h - y);
  ctx.strokeStyle = "#e4b15a";
  ctx.lineWidth = 4;
  ctx.setLineDash([28, 22]);
  ctx.beginPath();
  const off = wrap(look.scroll, 50);
  ctx.moveTo(-off, y + (h - y) * 0.55);
  ctx.lineTo(w + 50, y + (h - y) * 0.55);
  ctx.stroke();
  ctx.setLineDash([]);
  const gap = 240;
  for (let i = -1; i < w / gap + 2; i++) {
    const x = i * gap - wrap(look.scroll + look.time * 40, gap) + 80;
    car(ctx, carSet[wrap(i + 7, carSet.length)], x, y + 4, Math.min(1.1, w / 900));
  }
}

function sidewalk(ctx: Ctx, w: number, y: number, hgt: number, color = "#d9d0c3") {
  ctx.fillStyle = color;
  ctx.fillRect(0, y, w, hgt);
  line(ctx, 0, y, w, y, INK, 3);
}

/* ------------------------------ بیرون ------------------------------ */

export function street(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  sky(ctx, w, h, h * 0.5, look.night, look.time);
  const span = 420;
  const par = wrap(look.scroll * 0.35, span);
  if (v === 1) {
    // کوچهٔ قدیمی: دیوار آجری، درهای چوبی، بدون ترافیک
    ctx.fillStyle = "#c4a484";
    ctx.fillRect(0, h * 0.22, w, h * 0.5);
    ctx.strokeStyle = "#a8774a";
    ctx.lineWidth = 1.5;
    for (let y = h * 0.22; y < h * 0.72; y += 16) {
      for (let x = -par + ((y / 16) % 2) * 20; x < w + 40; x += 40) ctx.strokeRect(x, y, 40, 16);
    }
    for (let i = -1; i < w / span + 2; i++) {
      const x = i * span - par;
      door(ctx, x + 60, h * 0.42, 70, h * 0.3, pick(["#2a4f8f", "#3f8f62", "#7a2430"], i));
      ctx.fillStyle = "#2a4f8f";
      ctx.beginPath();
      ctx.moveTo(x + 240, h * 0.4);
      ctx.lineTo(x + 240, h * 0.33);
      ctx.arc(x + 270, h * 0.33, 30, Math.PI, 0);
      ctx.lineTo(x + 300, h * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      line(ctx, x + 270, h * 0.33 - 30, x + 270, h * 0.4, "#e4b15a", 3);
      line(ctx, x + 240, h * 0.36, x + 300, h * 0.36, "#e4b15a", 3);
      streetLamp(ctx, look, x + 350, h * 0.72, h * 0.32);
    }
    sidewalk(ctx, w, h * 0.72, h, "#b9a68c");
    car(ctx, "peykan", w * 0.86 - par * 0.2, h * 0.86, Math.min(1, w / 900));
    return;
  }
  for (let i = -1; i < w / span + 2; i++) {
    const x = i * span - par;
    const top = h * (0.12 + (wrap(i, 3) * 0.06));
    building(ctx, look, x, top, 300, h * 0.6, pick(["#e7d7c0", "#d9c3a5", "#c9d0db"], i + v), { cols: 4 });
    if (v === 2) {
      // مغازه‌های همکف با تابلو
      box(ctx, x + 10, h * 0.48, 280, h * 0.12, "#f4efe6");
      sign(ctx, pick(["نانوایی", "سوپرمارکت", "میوه‌فروشی", "کفش ملی"], i), x + 150, h * 0.465, 18, "#f4efe6", pick(["#c2412d", "#2a4f8f", "#3f8f62", "#7a2430"], i));
      look.lights.push({ kind: "rect", x: x + 14, y: h * 0.525, w: 272, h: h * 0.065, color: "#ffe4a8" });
      tree(ctx, x + 380, h * 0.62, 0.7, "#3f8f62", Math.sin(look.time + i) * 3);
    } else {
      streetLamp(ctx, look, x + 360, h * 0.62, h * 0.3);
    }
  }
  sidewalk(ctx, w, h * 0.6, h * 0.08);
  road(ctx, w, h, look, h * 0.68, CARS);
}

export function park(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  sky(ctx, w, h, h * 0.62, look.night, look.time);
  ctx.fillStyle = "#5f8f4a";
  ctx.fillRect(0, h * 0.6, w, h * 0.4);
  line(ctx, 0, h * 0.6, w, h * 0.6, "#2f6b3a", 3);
  ctx.fillStyle = "#c4b39a";
  ctx.fillRect(0, h * 0.8, w, h * 0.08);
  const span = 300;
  const par = wrap(look.scroll * 0.5, span);
  for (let i = -1; i < w / span + 2; i++) {
    const x = i * span - par;
    tree(ctx, x + 80, h * 0.62, 0.9, i % 2 ? "#2f6b3a" : "#3f8f62", Math.sin(look.time * 1.4 + i) * 5);
    streetLamp(ctx, look, x + 230, h * 0.8, h * 0.32);
  }
  if (v === 0) {
    box(ctx, w * 0.62, h * 0.7, w * 0.22, 12, "#6b3a22");
    box(ctx, w * 0.62, h * 0.64, w * 0.22, 10, "#6b3a22");
    box(ctx, w * 0.65, h * 0.7, 8, h * 0.1, "#6b3a22", { lw: 2 });
    box(ctx, w * 0.8, h * 0.7, 8, h * 0.1, "#6b3a22", { lw: 2 });
  } else if (v === 1) {
    // حوض و فواره
    ctx.fillStyle = "#7eb8d4";
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.72, w * 0.2, h * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f4efe6";
    ctx.lineWidth = 6;
    ctx.stroke();
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.25;
      const r = h * 0.12 * (0.85 + 0.15 * Math.sin(look.time * 3 + i));
      ctx.strokeStyle = "rgba(220,240,250,0.9)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * 0.5, h * 0.71);
      ctx.quadraticCurveTo(w * 0.5 + Math.cos(a) * r, h * 0.71 + Math.sin(a) * r * 1.6, w * 0.5 + Math.cos(a) * r * 1.6, h * 0.71);
      ctx.stroke();
    }
  } else {
    // زمین بازی: سرسره و تاب
    poly(ctx, [
      [w * 0.62, h * 0.62],
      [w * 0.66, h * 0.62],
      [w * 0.82, h * 0.8],
      [w * 0.78, h * 0.8],
    ], "#c2412d");
    box(ctx, w * 0.6, h * 0.5, w * 0.06, h * 0.3, "#f2c230");
    line(ctx, w * 0.14, h * 0.48, w * 0.32, h * 0.48, "#3a3f46", 6);
    line(ctx, w * 0.15, h * 0.48, w * 0.13, h * 0.8, "#3a3f46", 5);
    line(ctx, w * 0.31, h * 0.48, w * 0.33, h * 0.8, "#3a3f46", 5);
    const sw = Math.sin(look.time * 2) * 10;
    line(ctx, w * 0.23, h * 0.48, w * 0.23 + sw, h * 0.68, INK, 2);
    box(ctx, w * 0.21 + sw, h * 0.68, w * 0.04, 8, "#2a4f8f", { lw: 2 });
  }
}

export function yard(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  sky(ctx, w, h, h * 0.5, look.night, look.time);
  const wallC = pick(["#c4a484", "#e7d7c0", "#b0703d"], v);
  ctx.fillStyle = wallC;
  ctx.fillRect(0, h * 0.34, w, h * 0.28);
  if (v === 2) {
    ctx.strokeStyle = "#8a4b2a";
    ctx.lineWidth = 1.5;
    for (let y = h * 0.34; y < h * 0.62; y += 16) for (let x = ((y / 16) % 2) * 20; x < w; x += 40) ctx.strokeRect(x, y, 40, 16);
  }
  line(ctx, 0, h * 0.34, w, h * 0.34, INK, 3);
  ctx.fillStyle = "#c4b39a";
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  line(ctx, 0, h * 0.62, w, h * 0.62, INK, 3);
  door(ctx, w * 0.82, h * 0.3, w * 0.1, h * 0.32, "#2a4f8f");
  if (v === 1) {
    for (const tx of [0.12, 0.3]) tree(ctx, w * tx, h * 0.62, 0.9, "#3f8f62", Math.sin(look.time + tx * 10) * 4);
    box(ctx, w * 0.04, h * 0.6, w * 0.4, h * 0.05, "#5f8f4a", { lw: 2 });
    for (let i = 0; i < 8; i++) circle(ctx, w * (0.06 + i * 0.05), h * 0.6, 7, pick(["#c2412d", "#f2c230", "#f4efe6"], i), INK, 2);
  } else {
    tree(ctx, w * 0.14, h * 0.62, 0.8);
  }
  // حوض
  ctx.fillStyle = "#7eb8d4";
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.74, w * 0.16, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2a4f8f";
  ctx.lineWidth = 4;
  ctx.stroke();
  const ripple = 1 + Math.sin(look.time * 2) * 0.04;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.74, w * 0.08 * ripple, h * 0.025, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const fx = w * (0.44 + i * 0.05) + Math.sin(look.time + i) * 8;
    ctx.fillStyle = "#e4752d";
    ctx.beginPath();
    ctx.ellipse(fx, h * 0.74 + (i - 1) * 6, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  look.lights.push({ kind: "glow", x: w * 0.87, y: h * 0.3, r: w * 0.2, color: "#ffcf7a" });
}

export function cabin(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  ctx.fillStyle = pick(["#5a4632", "#2a241c", "#1f2933"], v);
  ctx.fillRect(0, 0, w, h);
  // شیشهٔ جلو با منظرهٔ جاده
  const wx = w * 0.1;
  const wy = h * 0.06;
  const ww = w * 0.8;
  const wh = h * 0.44;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(wx, wy, ww, wh, 30);
  ctx.clip();
  sky(ctx, w, h, wy + wh, look.night, look.time);
  ctx.fillStyle = "#3a3f46";
  poly(ctx, [
    [wx + ww * 0.3, wy + wh],
    [wx + ww * 0.7, wy + wh],
    [wx + ww * 0.52, wy + wh * 0.55],
    [wx + ww * 0.48, wy + wh * 0.55],
  ], "#3a3f46", null);
  for (let i = 0; i < 4; i++) {
    const t = wrap(look.time * 0.6 + i * 0.25, 1);
    const y = wy + wh * (0.55 + t * 0.45);
    line(ctx, w * 0.5, y, w * 0.5, y + 6 + t * 14, "#e4b15a", 2 + t * 4);
  }
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.roundRect(wx, wy, ww, wh, 30);
  ctx.stroke();
  // داشبورد و فرمان
  box(ctx, 0, h * 0.52, w, h * 0.1, pick(["#7a5a3a", "#3a3228", "#111827"], v), { lw: 4 });
  box(ctx, w * 0.18, h * 0.56, w * 0.64, h * 0.28, "#6b7280");
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(w * 0.3, h * 0.74, Math.min(w, h) * 0.09, 0, Math.PI * 2);
  ctx.stroke();
  if (v === 1) {
    // تاکسی: تابلو و تسبیح آویزان
    box(ctx, w * 0.4, h * 0.53, w * 0.2, h * 0.05, "#f2c230", { lw: 2 });
    sign(ctx, "تاکسی", w * 0.5, h * 0.555, 16, INK);
  }
  line(ctx, w * 0.5, wy, w * 0.5, wy + h * 0.12, INK, 2);
  for (let i = 0; i < 6; i++) circle(ctx, w * 0.5 + Math.sin(look.time * 2) * 6, wy + h * 0.12 + i * 7, 4, pick(["#3f8f62", "#c2412d", "#7a2430"], v), null);
  if (v === 2) {
    box(ctx, w * 0.42, h * 0.54, w * 0.16, h * 0.06, "#1f2933", { r: 6 });
    look.lights.push({ kind: "rect", x: w * 0.43, y: h * 0.545, w: w * 0.14, h: h * 0.05, color: "#7ec3ea" });
  }
  look.lights.push({ kind: "glow", x: w * 0.7, y: h * 0.58, r: w * 0.1, color: "#e4b15a" });
}

/* ------------------------- قهوه‌خانه و کافه ------------------------- */

export function teahouse(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  const fy = h * 0.66;
  // دیوار آجری قهوه‌ای
  ctx.fillStyle = pick(["#6b3a22", "#8a4b2a", "#7a4a2c"], v);
  ctx.fillRect(0, 0, w, fy);
  ctx.strokeStyle = "#8a5634";
  ctx.lineWidth = 1.5;
  for (let y = 10; y < fy; y += 30) for (let x = ((y / 30) % 2) * 34 - 30; x < w; x += 70) ctx.strokeRect(x, y, 68, 28);
  floor(ctx, w, h, fy, "#5a4632");
  // ریسه‌ی لامپ
  ctx.beginPath();
  ctx.moveTo(0, h * 0.06);
  ctx.quadraticCurveTo(w * 0.5, h * 0.16, w, h * 0.06);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  for (let i = 1; i < 10; i++) {
    const lx = (w / 10) * i;
    const ly = h * 0.06 + Math.sin((i / 10) * Math.PI) * h * 0.05;
    circle(ctx, lx, ly + 8, 7, pick(["#c2412d", "#e4b15a", "#3f8f62", "#7eb8d4"], i), INK, 1.5);
    look.lights.push({ kind: "glow", x: lx, y: ly + 8, r: 40, color: "#ffcf7a" });
  }
  // تابلوی قاجاری روی دیوار
  for (const fx of [0.12, 0.74]) {
    box(ctx, w * fx, h * 0.18, w * 0.14, h * 0.14, "#e4b15a");
    box(ctx, w * fx + 6, h * 0.18 + 6, w * 0.14 - 12, h * 0.14 - 12, pick(["#2a4f8f", "#7a2430"], fx > 0.5 ? 1 : 0), { lw: 2 });
    circle(ctx, w * (fx + 0.07), h * 0.24, h * 0.025, "#f4c99b", INK, 2);
  }
  // تخت با قالیچه و پشتی
  const tx = v === 1 ? 0.6 : 0.02;
  box(ctx, w * tx, fy - h * 0.06, w * 0.36, h * 0.06, "#6b3a22");
  for (const lx of [0.02, 0.32]) box(ctx, w * (tx + lx), fy - h * 0.0, 10, h * 0.04, "#6b3a22", { lw: 2 });
  rug(ctx, w * (tx + 0.01), fy - h * 0.085, w * 0.34, h * 0.03, "#8c2f2f", "#e4b15a");
  box(ctx, w * (tx + 0.02), fy - h * 0.16, w * 0.08, h * 0.08, "#7a2430", { r: 10 });
  // سماور
  const sx = v === 1 ? 0.2 : 0.62;
  box(ctx, w * sx, fy - h * 0.12, w * 0.2, h * 0.12, "#8a4b2a");
  box(ctx, w * (sx + 0.06), fy - h * 0.28, w * 0.08, h * 0.16, "#e4b15a", { r: 12 });
  circle(ctx, w * (sx + 0.1), fy - h * 0.3, w * 0.022, "#c2412d");
  for (let i = 0; i < 3; i++) {
    const t = wrap(look.time * 0.5 + i / 3, 1);
    ctx.globalAlpha = 1 - t;
    circle(ctx, w * (sx + 0.1) + Math.sin(t * 6) * 6, fy - h * 0.34 - t * h * 0.1, 6 + t * 8, "#f4efe6", null);
    ctx.globalAlpha = 1;
  }
  if (v !== 2) {
    // قلیان
    const qx = w * (v === 1 ? 0.5 : 0.44);
    box(ctx, qx - 14, fy - 30, 28, 30, "#2a4f8f", { r: 12 });
    line(ctx, qx, fy - 30, qx, fy - 90, INK, 5);
    box(ctx, qx - 14, fy - 100, 28, 12, "#c2412d", { lw: 2 });
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(qx, fy - 50);
    ctx.quadraticCurveTo(qx + 60, fy - 20, qx + 70, fy - 60);
    ctx.stroke();
  } else {
    for (const lx of [0.3, 0.5]) {
      line(ctx, w * lx, 0, w * lx, h * 0.24, INK, 2);
      box(ctx, w * lx - 12, h * 0.24, 24, 34, "#e4b15a", { r: 6 });
      look.lights.push({ kind: "glow", x: w * lx, y: h * 0.28, r: 90, color: "#ffcf7a" });
    }
  }
  sign(ctx, "قهوه‌خانه", w * 0.5, h * 0.24, Math.max(18, h * 0.04), "#f4efe6", "#7a2430");
}

export function coffee(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  const fy = h * 0.66;
  if (v === 0) {
    ctx.fillStyle = "#b0703d";
    ctx.fillRect(0, 0, w, fy);
    ctx.strokeStyle = "#8a4b2a";
    ctx.lineWidth = 1.5;
    for (let y = 0; y < fy; y += 18) for (let x = ((y / 18) % 2) * 22 - 22; x < w; x += 44) ctx.strokeRect(x, y, 44, 18);
    floor(ctx, w, h, fy, "#3a3f46");
  } else if (v === 1) {
    wall(ctx, w, fy, "#faf7f2", "#ede6db");
    floor(ctx, w, h, fy, "#d8bf94", "#c6a978");
  } else {
    wall(ctx, w, fy, "#e3efe3", "#c9dcc6");
    floor(ctx, w, h, fy, "#a8774a", "#93653d");
  }
  // پنجرهٔ بزرگ رو به خیابان
  windowPane(ctx, look, w * 0.04, h * 0.1, w * 0.3, h * 0.36, v === 0 ? "#1f2933" : "#a8774a");
  // بار قهوه و دستگاه اسپرسو
  box(ctx, w * 0.56, fy - h * 0.16, w * 0.42, h * 0.16, pick(["#1f2933", "#e8dccb", "#2f6b3a"], v));
  box(ctx, w * 0.54, fy - h * 0.18, w * 0.46, h * 0.03, pick(["#a8774a", "#f4efe6", "#e4b15a"], v));
  box(ctx, w * 0.62, fy - h * 0.3, w * 0.12, h * 0.12, "#c5ccd6", { r: 6 });
  box(ctx, w * 0.64, fy - h * 0.22, w * 0.03, h * 0.03, "#3a3f46", { lw: 2 });
  circle(ctx, w * 0.69, fy - h * 0.27, 6, "#c2412d", INK, 2);
  // منوی دیواری
  box(ctx, w * 0.6, h * 0.08, w * 0.3, h * 0.18, "#1f2933");
  sign(ctx, "منو", w * 0.75, h * 0.12, 18, "#f4efe6");
  for (let i = 0; i < 3; i++) line(ctx, w * 0.63, h * (0.16 + i * 0.03), w * 0.87, h * (0.16 + i * 0.03), "#f4efe6", 2);
  for (const px of [0.62, 0.76, 0.9]) pendant(ctx, look, w * px, 0, h * 0.09, pick(["#1f2933", "#f4efe6", "#e4b15a"], v), 14);
  // میز گرد و صندلی
  box(ctx, w * 0.38, fy + h * 0.04, w * 0.12, 8, "#6b3a22", { lw: 2 });
  line(ctx, w * 0.44, fy + h * 0.04, w * 0.44, fy + h * 0.16, INK, 4);
  box(ctx, w * 0.405, fy + h * 0.015, 12, 18, "#f4efe6", { lw: 2, r: 3 });
  if (v === 2) {
    for (const [px, s] of [
      [0.36, 1.3],
      [0.5, 1],
    ]) plant(ctx, w * px, fy, s, "#f4efe6");
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = "#2f6b3a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(w * (0.36 + i * 0.05), 0);
      ctx.quadraticCurveTo(w * (0.38 + i * 0.05), h * 0.08, w * (0.36 + i * 0.05), h * 0.14);
      ctx.stroke();
    }
  } else {
    plant(ctx, w * 0.5, fy, 1.1, v === 0 ? "#1f2933" : "#e4b15a");
  }
}

/* ------------------------------ تهران ------------------------------ */

export function bazaar(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  const fy = h * 0.7;
  ctx.fillStyle = "#c79a68";
  ctx.fillRect(0, 0, w, fy);
  // طاق‌های آجری پشت سر هم با نورگیر
  const span = w / 4;
  for (let i = 0; i < 5; i++) {
    const cx = i * span - wrap(look.scroll * 0.3, span);
    ctx.strokeStyle = "#8a5634";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.5);
    ctx.quadraticCurveTo(cx + span / 2, -h * 0.15, cx + span, h * 0.5);
    ctx.stroke();
    circle(ctx, cx + span / 2, h * 0.08, h * 0.025, look.night ? "#22305a" : "#fff7d6", INK, 2);
    look.lights.push({ kind: "glow", x: cx + span / 2, y: h * 0.32, r: span * 0.45, color: "#ffcf7a" });
    line(ctx, cx + span / 2, h * 0.12, cx + span / 2, h * 0.26, INK, 2);
    box(ctx, cx + span / 2 - 10, h * 0.26, 20, 26, "#e4b15a", { r: 5, lw: 2 });
  }
  // حجره‌ها در دو طرف
  for (const [sx, sw] of [
    [0, 0.3],
    [0.7, 0.3],
  ]) {
    box(ctx, w * sx, h * 0.34, w * sw, fy - h * 0.34, "#6b3a22");
    box(ctx, w * sx + 8, h * 0.38, w * sw - 16, fy - h * 0.4, "#3a2a1e", { lw: 2 });
    if (v === 0) {
      // فرش‌های آویزان
      for (let k = 0; k < 3; k++) rug(ctx, w * sx + 14 + k * (w * sw - 28) / 3, h * 0.4, (w * sw - 40) / 3, fy - h * 0.46, pick(["#8c2f2f", "#2a4f8f", "#7a2430"], k), "#e4b15a");
    } else if (v === 1) {
      // ادویه در کیسه‌ها و کپه‌های رنگی
      for (let k = 0; k < 4; k++) {
        const kx = w * sx + 20 + k * (w * sw - 40) / 4;
        box(ctx, kx, fy - h * 0.1, (w * sw - 60) / 4, h * 0.1, "#e8dccb", { r: 6 });
        poly(ctx, [
          [kx + 4, fy - h * 0.1],
          [kx + (w * sw - 60) / 8, fy - h * 0.17],
          [kx + (w * sw - 60) / 4 - 4, fy - h * 0.1],
        ], pick(["#c2412d", "#f2c230", "#8a4b2a", "#3f8f62"], k));
      }
    } else {
      // ویترین طلا
      box(ctx, w * sx + 14, h * 0.42, w * sw - 28, fy - h * 0.48, "#d5eef8", { lw: 2 });
      for (let k = 0; k < 8; k++) circle(ctx, w * sx + 30 + (k % 4) * (w * sw - 60) / 3, h * (0.48 + Math.floor(k / 4) * 0.08), 9, "#f2c230", "#a8774a", 2);
      look.lights.push({ kind: "rect", x: w * sx + 14, y: h * 0.42, w: w * sw - 28, h: fy - h * 0.48, color: "#fff1c4" });
    }
  }
  sign(ctx, pick(["راستهٔ فرش‌فروشان", "عطاری", "زرگرها"], v), w * 0.5, h * 0.42, Math.max(16, h * 0.032), "#f4efe6", "#7a2430");
  floor(ctx, w, h, fy, "#a99886");
  for (let x = 0; x < w; x += 60) line(ctx, x, fy, x - 40, h, "#8f7f6e", 2);
}

/** شکل برج میلاد: پایه، ساقه، کلاهک هشت‌ضلعی و دکل. */
function miladTower(ctx: Ctx, look: Look, cx: number, baseY: number, H: number) {
  const s = H / 100;
  const c = "#d7d2c8";
  poly(ctx, [
    [cx - 9 * s, baseY],
    [cx + 9 * s, baseY],
    [cx + 3.2 * s, baseY - 14 * s],
    [cx - 3.2 * s, baseY - 14 * s],
  ], c);
  box(ctx, cx - 3 * s, baseY - 62 * s, 6 * s, 48 * s, c, { lw: 2 });
  // کلاهک
  poly(ctx, [
    [cx - 4 * s, baseY - 62 * s],
    [cx + 4 * s, baseY - 62 * s],
    [cx + 9 * s, baseY - 66 * s],
    [cx + 9 * s, baseY - 71 * s],
    [cx + 5 * s, baseY - 74 * s],
    [cx - 5 * s, baseY - 74 * s],
    [cx - 9 * s, baseY - 71 * s],
    [cx - 9 * s, baseY - 66 * s],
  ], "#9fc6dc");
  for (let k = -2; k <= 2; k++) line(ctx, cx + k * 3.5 * s, baseY - 73 * s, cx + k * 3.5 * s, baseY - 63 * s, "#5f7f96", 1.5);
  box(ctx, cx - 2 * s, baseY - 92 * s, 4 * s, 18 * s, c, { lw: 2 });
  line(ctx, cx, baseY - 92 * s, cx, baseY - 100 * s, INK, Math.max(2, s * 0.8));
  circle(ctx, cx, baseY - 100 * s, Math.max(3, s), "#c2412d", null);
  look.lights.push({ kind: "glow", x: cx, y: baseY - 68 * s, r: 14 * s, color: "#bfe6ff" });
  look.lights.push({ kind: "glow", x: cx, y: baseY - 100 * s, r: 5 * s, color: "#ff6b6b" });
}

function skyline(ctx: Ctx, look: Look, w: number, baseY: number, seed: number) {
  for (let i = 0; i < 12; i++) {
    const bw = w / 12;
    const bh = baseY * (0.12 + (((i * 37 + seed * 11) % 7) / 7) * 0.16);
    building(ctx, look, i * bw, baseY - bh, bw - 4, baseY, pick(["#b9c0c8", "#a3acb6", "#c9ced4"], i + seed), {
      cols: 2,
      rowH: 22,
    });
  }
}

export function milad(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  sky(ctx, w, h, h * 0.62, look.night, look.time);
  // کوه‌های البرز
  poly(ctx, [
    [0, h * 0.46],
    [w * 0.18, h * 0.3],
    [w * 0.34, h * 0.42],
    [w * 0.52, h * 0.26],
    [w * 0.7, h * 0.4],
    [w * 0.88, h * 0.28],
    [w, h * 0.38],
    [w, h * 0.62],
    [0, h * 0.62],
  ], look.night ? "#2a3350" : "#9aa8bd", null);
  if (v === 2) {
    // پای برج: برج بزرگ، پیاده‌رو و سکو
    miladTower(ctx, look, w * 0.5, h * 0.72, h * 0.7);
    ctx.fillStyle = "#d9d0c3";
    ctx.fillRect(0, h * 0.66, w, h * 0.34);
    line(ctx, 0, h * 0.66, w, h * 0.66, INK, 3);
    for (const fx of [0.12, 0.88]) cypress(ctx, w * fx, h * 0.68, 0.9);
    for (const lx of [0.25, 0.75]) streetLamp(ctx, look, w * lx, h * 0.7, h * 0.26);
    return;
  }
  skyline(ctx, look, w, h * 0.62, v);
  miladTower(ctx, look, w * (v === 0 ? 0.62 : 0.4), h * 0.62, h * 0.45);
  if (v === 0) {
    ctx.fillStyle = "#5f8f4a";
    ctx.fillRect(0, h * 0.62, w, h * 0.38);
    line(ctx, 0, h * 0.62, w, h * 0.62, "#2f6b3a", 3);
    tree(ctx, w * 0.12, h * 0.66, 0.9);
    tree(ctx, w * 0.9, h * 0.66, 0.8);
    ctx.fillStyle = "#c4b39a";
    ctx.fillRect(0, h * 0.82, w, h * 0.07);
    streetLamp(ctx, look, w * 0.3, h * 0.82, h * 0.3);
  } else {
    sidewalk(ctx, w, h * 0.62, h * 0.06, "#c5ccd6");
    road(ctx, w, h, look, h * 0.68, ["samand", "pride", "suv", "taxi", "modern"]);
  }
}

/** شکل برج آزادی: چهار پایهٔ خمیده، طاق بزرگ میانی، بدنهٔ بالایی با پنجره‌های کوچک. */
function azadiTower(ctx: Ctx, cx: number, baseY: number, H: number) {
  const W = H * 0.9;
  const c = "#ece5d8";
  ctx.fillStyle = c;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - W / 2, baseY);
  ctx.quadraticCurveTo(cx - W * 0.2, baseY - H * 0.45, cx - W * 0.17, baseY - H * 0.82);
  ctx.lineTo(cx - W * 0.12, baseY - H);
  ctx.lineTo(cx + W * 0.12, baseY - H);
  ctx.lineTo(cx + W * 0.17, baseY - H * 0.82);
  ctx.quadraticCurveTo(cx + W * 0.2, baseY - H * 0.45, cx + W / 2, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // طاق اصلی (جناغی)
  ctx.fillStyle = "#7eb8d4";
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.2, baseY);
  ctx.quadraticCurveTo(cx - W * 0.16, baseY - H * 0.42, cx, baseY - H * 0.58);
  ctx.quadraticCurveTo(cx + W * 0.16, baseY - H * 0.42, cx + W * 0.2, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // خطوط فیروزه‌ای و پنجره‌های بالایی
  ctx.strokeStyle = "#2a8f8f";
  ctx.lineWidth = 2;
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + k * W * 0.34, baseY);
    ctx.quadraticCurveTo(cx + k * W * 0.18, baseY - H * 0.45, cx + k * W * 0.08, baseY - H * 0.62);
    ctx.stroke();
  }
  for (let k = -2; k <= 2; k++) box(ctx, cx + k * W * 0.045 - W * 0.015, baseY - H * 0.92, W * 0.03, H * 0.06, "#2a8f8f", { lw: 1.5, r: 3 });
}

export function azadi(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  sky(ctx, w, h, h * 0.66, look.night, look.time);
  const baseY = h * (v === 2 ? 0.6 : 0.66);
  const H = h * (v === 0 ? 0.58 : v === 1 ? 0.48 : 0.36);
  if (v === 2) skyline(ctx, look, w, baseY, 2);
  azadiTower(ctx, w * 0.5, baseY, H);
  look.lights.push({ kind: "glow", x: w * 0.5, y: baseY - H * 0.5, r: H * 0.8, color: "#ffe6b0" });
  ctx.fillStyle = v === 2 ? "#3a3f46" : "#d9d0c3";
  ctx.fillRect(0, baseY, w, h - baseY);
  line(ctx, 0, baseY, w, baseY, INK, 3);
  if (v === 0) {
    ctx.fillStyle = "#5f8f4a";
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.86, w * 0.42, h * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (const fx of [0.12, 0.88]) streetLamp(ctx, look, w * fx, h * 0.78, h * 0.3);
  } else if (v === 1) {
    ctx.fillStyle = "#7eb8d4";
    ctx.fillRect(w * 0.1, h * 0.74, w * 0.8, h * 0.08);
    line(ctx, w * 0.1, h * 0.74, w * 0.9, h * 0.74, INK, 3);
    for (let i = 0; i < 9; i++) {
      const fx = w * (0.14 + i * 0.09);
      const fh = h * (0.13 + 0.03 * Math.sin(look.time * 3 + i));
      ctx.strokeStyle = "rgba(220,240,250,0.95)";
      ctx.lineWidth = 3;
      line(ctx, fx, h * 0.76, fx, h * 0.76 - fh, "rgba(220,240,250,0.95)", 5);
      look.lights.push({ kind: "glow", x: fx, y: h * 0.74, r: 26, color: "#9fd4ea" });
    }
  } else {
    road(ctx, w, h, look, h * 0.7, ["samand", "pride", "taxi", "peykan", "suv"]);
  }
}

export function saadatabad(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  sky(ctx, w, h, h * 0.6, look.night, look.time);
  const baseY = h * 0.6;
  const par = wrap(look.scroll * 0.3, w);
  if (v === 1) {
    // برج‌های مسکونی بلند با بالکن
    for (let i = 0; i < 4; i++) {
      const x = i * w * 0.26 - par * 0.2 + w * 0.02;
      const top = h * (0.04 + (i % 2) * 0.08);
      building(ctx, look, x, top, w * 0.2, baseY, pick(["#e7e1d6", "#d6dbe2", "#efe3cf", "#cfd8dc"], i), { cols: 3, rowH: 30 });
      for (let y = top + 30; y < baseY - 20; y += 30) line(ctx, x, y + 18, x + w * 0.2, y + 18, "#7c8590", 2);
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const x = i * w * 0.36 - par * 0.3;
      building(ctx, look, x, h * (0.1 + (i % 2) * 0.06), w * 0.3, baseY, pick(["#e7e1d6", "#cfd8dc", "#efe3cf"], i), {
        cols: 4,
        rowH: 34,
        glass: true,
      });
      if (v === 2) {
        // مغازه و کافهٔ همکف
        box(ctx, x + 6, baseY - h * 0.1, w * 0.3 - 12, h * 0.1, "#f4efe6");
        sign(ctx, pick(["کافه", "پوشاک", "شیرینی"], i), x + w * 0.15, baseY - h * 0.115, 16, "#f4efe6", pick(["#1f2933", "#7a2430", "#2f6b3a"], i));
        look.lights.push({ kind: "rect", x: x + 10, y: baseY - h * 0.065, w: w * 0.3 - 20, h: h * 0.06, color: "#ffe4a8" });
      }
    }
  }
  sidewalk(ctx, w, baseY, h * 0.06);
  if (v === 0) {
    // بلوار با سروها در بخش میانی
    ctx.fillStyle = "#3a3f46";
    ctx.fillRect(0, h * 0.66, w, h * 0.34);
    box(ctx, 0, h * 0.76, w, h * 0.05, "#5f8f4a", { lw: 2 });
    for (let i = 0; i < 7; i++) cypress(ctx, i * w * 0.16 + w * 0.05 - wrap(look.scroll * 0.6, w * 0.16), h * 0.78, 0.55);
    for (let i = 0; i < 3; i++) car(ctx, pick(["suv", "modern", "samand"], i), wrap(i * w * 0.4 - look.time * 60, w + 200) - 100, h * 0.72, Math.min(0.9, w / 1000));
  } else {
    road(ctx, w, h, look, h * 0.66, ["suv", "modern", "samand", "hatch"]);
  }
  for (const lx of [0.2, 0.7]) streetLamp(ctx, look, w * lx, h * 0.66, h * 0.28);
}

/** چنار تنومند (خیابان‌های شمال تهران). */
function plane(ctx: Ctx, x: number, baseY: number, s: number, sway: number) {
  box(ctx, x - 12 * s, baseY - 150 * s, 24 * s, 150 * s, "#c9b89a");
  for (let k = 0; k < 4; k++) circle(ctx, x - 6 * s + (k % 2) * 10 * s, baseY - (40 + k * 30) * s, 4 * s, "#9a8a6e", null);
  circle(ctx, x + sway, baseY - 180 * s, 70 * s, "#4f8f3a");
  circle(ctx, x - 50 * s + sway, baseY - 150 * s, 48 * s, "#3f7f32");
  circle(ctx, x + 52 * s + sway, baseY - 152 * s, 46 * s, "#5a9a45");
}

export function fereshteh(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  sky(ctx, w, h, h * 0.6, look.night, look.time);
  const baseY = h * 0.62;
  if (v === 1) {
    // برج شیشه‌ای
    for (let i = 0; i < 2; i++) {
      const x = w * (0.08 + i * 0.5);
      box(ctx, x, h * 0.04, w * 0.36, baseY - h * 0.04, "#7fa7c4");
      for (let y = h * 0.06; y < baseY; y += 22) line(ctx, x, y, x + w * 0.36, y, "#5f87a4", 2);
      for (let c = 1; c < 6; c++) line(ctx, x + (w * 0.36 * c) / 6, h * 0.04, x + (w * 0.36 * c) / 6, baseY, "#5f87a4", 2);
      look.lights.push({ kind: "rect", x: x + 4, y: h * 0.3, w: w * 0.36 - 8, h: h * 0.08, color: "#ffe4a8" });
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      poly(ctx, [
        [x + w * 0.04, h * 0.04],
        [x + w * 0.12, h * 0.04],
        [x + w * 0.02, baseY],
        [x - w * 0.0, baseY],
      ], "rgba(255,255,255,0.25)", null);
    }
  } else if (v === 2) {
    // دیوار ویلا با پیچک و در ورودی
    box(ctx, 0, h * 0.3, w, baseY - h * 0.3, "#e7e1d6");
    for (let i = 0; i < 26; i++) circle(ctx, (i * 53) % w, h * (0.3 + ((i * 17) % 9) * 0.03), 16, i % 2 ? "#3f7f32" : "#4f8f3a", null);
    box(ctx, w * 0.42, h * 0.34, w * 0.16, baseY - h * 0.34, "#1f2933");
    for (let k = 1; k < 6; k++) line(ctx, w * 0.42 + (w * 0.16 * k) / 6, h * 0.34, w * 0.42 + (w * 0.16 * k) / 6, baseY, "#3a3f46", 2);
    for (const lx of [0.4, 0.6]) {
      box(ctx, w * lx - 8, h * 0.3, 16, 22, "#e4b15a", { r: 4, lw: 2 });
      look.lights.push({ kind: "glow", x: w * lx, y: h * 0.31, r: 70, color: "#ffcf7a" });
    }
  } else {
    building(ctx, look, w * 0.02, h * 0.16, w * 0.3, baseY, "#efe3cf", { cols: 4, rowH: 36, glass: true });
    building(ctx, look, w * 0.66, h * 0.1, w * 0.32, baseY, "#d6dbe2", { cols: 4, rowH: 36, glass: true });
    box(ctx, w * 0.06, baseY - h * 0.1, w * 0.22, h * 0.1, "#1f2933");
    sign(ctx, "بوتیک", w * 0.17, baseY - h * 0.115, 16, "#e4b15a");
    look.lights.push({ kind: "rect", x: w * 0.07, y: baseY - h * 0.09, w: w * 0.2, h: h * 0.08, color: "#ffe4a8" });
  }
  sidewalk(ctx, w, baseY, h * 0.05, "#cfc6b8");
  // جوی آب و چنارها
  ctx.fillStyle = "#7eb8d4";
  ctx.fillRect(0, h * 0.67, w, h * 0.02);
  const span = w / 2;
  for (let i = 0; i < 4; i++) plane(ctx, i * span + span * 0.1 - wrap(look.scroll * 0.4, span), h * 0.67, 0.5, Math.sin(look.time + i) * 3);
  road(ctx, w, h, look, h * 0.69, ["suv", "modern", "suv", "hatch"]);
}
