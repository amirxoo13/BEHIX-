/** داخل ساختمان: پذیرایی، آشپزخانه، اتاق خواب، حمام، دستشویی، پارکینگ — هر کدام سه طرح. */
import {
  INK,
  box,
  car,
  circle,
  door,
  floor,
  line,
  pendant,
  pick,
  plant,
  poly,
  rug,
  tiles,
  wall,
  windowPane,
  type Ctx,
  type Look,
} from "./bg-kit.ts";

const FLOOR = 0.66;

function lamp(ctx: Ctx, look: Look, x: number, y: number, s: number, shade = "#e4b15a") {
  box(ctx, x - 3 * s, y - 70 * s, 6 * s, 70 * s, "#6b3a22", { lw: 2 });
  poly(ctx, [
    [x - 22 * s, y - 70 * s],
    [x + 22 * s, y - 70 * s],
    [x + 14 * s, y - 100 * s],
    [x - 14 * s, y - 100 * s],
  ], shade);
  look.lights.push({ kind: "glow", x, y: y - 80 * s, r: 160 * s, color: "#ffcf7a" });
}

function frame(ctx: Ctx, x: number, y: number, w: number, h: number, inner: string) {
  box(ctx, x, y, w, h, "#e4b15a");
  box(ctx, x + w * 0.1, y + h * 0.1, w * 0.8, h * 0.8, inner, { lw: 2 });
}

export function living(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  const fy = h * FLOOR;
  const [wt, wb, fl] = pick(
    [
      ["#f6e7c8", "#e7c48a", "#8c2f2f"],
      ["#e8f0e6", "#c9dcc6", "#a8774a"],
      ["#e6e9ef", "#c9d0db", "#d8cbb6"],
    ],
    v,
  );
  wall(ctx, w, fy, wt, wb);
  floor(ctx, w, h, fy, fl, v === 1 ? "#93653d" : undefined);
  windowPane(ctx, look, w * 0.4, h * 0.1, w * 0.2, h * 0.26, "#6b3a22", pick(["#7a2430", "#2a4f8f", "#e8e2d6"], v));
  if (v === 0) {
    // پشتی و تشک سنتی دور اتاق + سماور روی طاقچه
    rug(ctx, w * 0.06, fy + h * 0.08, w * 0.88, h * 0.22, "#8c2f2f", "#e4b15a");
    for (const px of [0.03, 0.15, 0.75, 0.87]) {
      box(ctx, w * px, fy - h * 0.12, w * 0.1, h * 0.14, "#7a2430", { r: 12 });
      line(ctx, w * px + 8, fy - h * 0.05, w * px + w * 0.1 - 8, fy - h * 0.05, "#e4b15a", 3);
    }
    box(ctx, w * 0.66, h * 0.32, w * 0.3, 10, "#6b3a22");
    box(ctx, w * 0.72, h * 0.2, w * 0.06, h * 0.12, "#c5ccd6", { r: 6 });
    circle(ctx, w * 0.75, h * 0.19, w * 0.015, "#c5ccd6");
    frame(ctx, w * 0.08, h * 0.12, w * 0.16, h * 0.16, "#3f8f62");
  } else if (v === 1) {
    rug(ctx, w * 0.12, fy + h * 0.06, w * 0.76, h * 0.2, "#2a4f8f", "#e4b15a");
    for (const [px, pw] of [
      [0.03, 0.2],
      [0.77, 0.2],
    ]) {
      box(ctx, w * px, fy - h * 0.18, w * pw, h * 0.1, "#7a2430", { r: 14 });
      box(ctx, w * px, fy - h * 0.1, w * pw, h * 0.1, "#8f2f3a", { r: 8 });
    }
    lamp(ctx, look, w * 0.26, fy, 1);
    frame(ctx, w * 0.7, h * 0.12, w * 0.18, h * 0.16, "#c2412d");
    plant(ctx, w * 0.66, fy, 1.1);
  } else {
    // مدرن: کاناپهٔ ال، تلویزیون دیواری، قفسه
    box(ctx, w * 0.05, h * 0.16, w * 0.26, h * 0.18, "#1f2933", { r: 4 });
    box(ctx, w * 0.065, h * 0.175, w * 0.23, h * 0.15, "#2b3a4a", { lw: 1 });
    look.lights.push({ kind: "rect", x: w * 0.065, y: h * 0.175, w: w * 0.23, h: h * 0.15, color: "#7ec3ea" });
    box(ctx, w * 0.05, fy - h * 0.08, w * 0.26, h * 0.08, "#f4efe6");
    box(ctx, w * 0.7, fy - h * 0.16, w * 0.28, h * 0.08, "#9aa3ad", { r: 10 });
    box(ctx, w * 0.7, fy - h * 0.09, w * 0.28, h * 0.09, "#7c8590", { r: 6 });
    box(ctx, w * 0.42, fy + h * 0.1, w * 0.16, h * 0.05, "#e4b15a", { r: 4 });
    pendant(ctx, look, w * 0.5, 0, h * 0.06, "#1f2933", 18);
    plant(ctx, w * 0.66, fy, 1);
    rug(ctx, w * 0.3, fy + h * 0.16, w * 0.4, h * 0.12, "#d6cbbb", "#9aa3ad");
  }
  if (v !== 0) look.lights.push({ kind: "glow", x: w * 0.5, y: h * 0.3, r: w * 0.25, color: "#ffcf7a" });
}

export function kitchen(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  const fy = h * FLOOR;
  if (v === 0) {
    // قدیمی: کاشی آبی، سماور، اجاق گاز، قفسه‌ی چوبی
    wall(ctx, w, fy, "#f3e6d0", "#e8d4b4");
    tiles(ctx, 0, h * 0.34, w, fy - h * 0.34, 26, "#cfe3ee", "#7eb8d4");
    floor(ctx, w, h, fy, "#c4b39a");
    windowPane(ctx, look, w * 0.42, h * 0.08, w * 0.16, h * 0.2);
    box(ctx, 0, fy - h * 0.14, w * 0.36, h * 0.14, "#6b3a22");
    box(ctx, w * 0.64, fy - h * 0.14, w * 0.36, h * 0.14, "#6b3a22");
    box(ctx, w * 0.06, fy - h * 0.2, w * 0.16, h * 0.06, "#d7d2c8");
    for (const bx of [0.1, 0.18]) circle(ctx, w * bx, fy - h * 0.2, 8, "#3a3f46");
    // سماور
    box(ctx, w * 0.76, fy - h * 0.3, w * 0.06, h * 0.16, "#e4b15a", { r: 10 });
    circle(ctx, w * 0.79, fy - h * 0.32, w * 0.018, "#c2412d");
    box(ctx, w * 0.68, h * 0.12, w * 0.26, h * 0.14, "#8a4b2a");
    for (const jx of [0.71, 0.77, 0.83, 0.89]) box(ctx, w * jx, h * 0.16, w * 0.03, h * 0.08, "#e4b15a", { lw: 2, r: 4 });
  } else if (v === 1) {
    // مدرن سفید: کابینت بالا و پایین، هود، یخچال
    wall(ctx, w, fy, "#f7f7f5", "#e9eaec");
    tiles(ctx, 0, h * 0.34, w, h * 0.18, 18, "#ffffff", "#d7dbe0");
    floor(ctx, w, h, fy, "#cfd4da", "#bfc5cc");
    for (let x = 0.02; x < 0.62; x += 0.12) {
      box(ctx, w * x, h * 0.08, w * 0.11, h * 0.24, "#f4f4f2");
      box(ctx, w * x, fy - h * 0.14, w * 0.11, h * 0.14, "#f4f4f2");
      line(ctx, w * (x + 0.08), fy - h * 0.1, w * (x + 0.08), fy - h * 0.05, INK, 3);
    }
    box(ctx, 0, fy - h * 0.16, w * 0.62, h * 0.03, "#3a3f46", { lw: 2 });
    poly(ctx, [
      [w * 0.27, h * 0.32],
      [w * 0.39, h * 0.32],
      [w * 0.36, h * 0.24],
      [w * 0.3, h * 0.24],
    ], "#9aa3ad");
    box(ctx, w * 0.74, h * 0.12, w * 0.16, fy - h * 0.12, "#e3e6ea", { r: 6 });
    line(ctx, w * 0.74, h * 0.34, w * 0.9, h * 0.34, INK, 2);
    line(ctx, w * 0.76, h * 0.2, w * 0.76, h * 0.28, INK, 4);
    windowPane(ctx, look, w * 0.62, h * 0.1, w * 0.1, h * 0.18, "#9aa3ad");
    look.lights.push({ kind: "glow", x: w * 0.3, y: h * 0.36, r: w * 0.18, color: "#fff1c4" });
  } else {
    // اوپن با جزیره و چراغ آویز
    wall(ctx, w, fy, "#efe6da", "#ddd0bd");
    floor(ctx, w, h, fy, "#a8774a", "#93653d");
    box(ctx, 0, h * 0.1, w * 0.3, h * 0.2, "#2f6b3a");
    box(ctx, 0, fy - h * 0.14, w * 0.3, h * 0.14, "#2f6b3a");
    tiles(ctx, 0, h * 0.3, w * 0.3, fy - h * 0.44, 22, "#f4efe6", "#d9cbb5");
    windowPane(ctx, look, w * 0.38, h * 0.08, w * 0.24, h * 0.22, "#3a3f46");
    box(ctx, w * 0.64, fy - h * 0.12, w * 0.32, h * 0.12, "#6b3a22");
    box(ctx, w * 0.62, fy - h * 0.15, w * 0.36, h * 0.04, "#f4efe6");
    for (const sx of [0.68, 0.8, 0.92]) {
      box(ctx, w * sx - 10, fy - h * 0.06, 20, 8, "#1f2933", { lw: 2 });
      line(ctx, w * sx, fy - h * 0.06, w * sx, fy, INK, 3);
    }
    for (const px of [0.7, 0.8, 0.9]) pendant(ctx, look, w * px, 0, h * 0.18, "#e4b15a", 16);
    plant(ctx, w * 0.34, fy, 0.9);
  }
}

export function bedroom(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  const fy = h * FLOOR;
  const [wt, wb, fl, bed, blanket] = pick(
    [
      ["#ede3f2", "#d5c4e0", "#a8774a", "#6b3a22", "#7a6bff"],
      ["#f3eadb", "#e2d3b8", "#c4b39a", "#8a4b2a", "#3f8f62"],
      ["#e3f1fb", "#c3def0", "#e4d2a8", "#e4b15a", "#c2412d"],
    ],
    v,
  );
  wall(ctx, w, fy, wt, wb);
  floor(ctx, w, h, fy, fl, v === 0 ? "#93653d" : undefined);
  windowPane(ctx, look, w * 0.42, h * 0.08, w * 0.18, h * 0.24, "#f4efe6", v === 2 ? "#f2c230" : "#e8e2d6");
  // تخت در سمت چپ
  const bw = v === 0 ? 0.34 : 0.26;
  box(ctx, w * 0.02, fy - h * 0.3, w * 0.04, h * 0.3, bed);
  box(ctx, w * 0.02, fy - h * 0.12, w * bw, h * 0.12, bed);
  box(ctx, w * 0.04, fy - h * 0.18, w * (bw - 0.03), h * 0.08, "#f4efe6", { r: 8 });
  box(ctx, w * 0.1, fy - h * 0.17, w * (bw - 0.09), h * 0.07, blanket, { r: 8 });
  box(ctx, w * 0.05, fy - h * 0.22, w * 0.06, h * 0.05, "#ffffff", { r: 8 });
  if (v === 0) box(ctx, w * 0.05, fy - h * 0.165, w * 0.06, h * 0.05, "#ffffff", { r: 8 });
  // میز کنار تخت و آباژور
  box(ctx, w * (bw + 0.04), fy - h * 0.1, w * 0.08, h * 0.1, "#8a4b2a");
  {
    const lx = w * (bw + 0.08);
    const ly = fy - h * 0.1;
    box(ctx, lx - 3, ly - 30, 6, 30, INK, { lw: 1 });
    poly(ctx, [
      [lx - 18, ly - 30],
      [lx + 18, ly - 30],
      [lx + 11, ly - 54],
      [lx - 11, ly - 54],
    ], "#f2c230");
    look.lights.push({ kind: "glow", x: lx, y: ly - 40, r: w * 0.22, color: "#ffcf7a" });
  }
  // کمد لباس در راست
  box(ctx, w * 0.76, h * 0.14, w * 0.2, fy - h * 0.14, pick(["#8a4b2a", "#e8e2d6", "#7eb8d4"], v));
  line(ctx, w * 0.86, h * 0.14, w * 0.86, fy, INK, 3);
  circle(ctx, w * 0.845, h * 0.4, 4, "#e4b15a", INK, 2);
  circle(ctx, w * 0.875, h * 0.4, 4, "#e4b15a", INK, 2);
  if (v === 2) {
    // اتاق بچه: ستاره روی دیوار و توپ
    for (const [sx, sy] of [
      [0.66, 0.14],
      [0.7, 0.24],
      [0.36, 0.18],
    ]) circle(ctx, w * sx, h * sy, 7, "#f2c230", INK, 2);
    circle(ctx, w * 0.64, fy + h * 0.1, h * 0.04, "#c2412d");
  } else {
    rug(ctx, w * 0.36, fy + h * 0.1, w * 0.3, h * 0.14, pick(["#7a2430", "#2a4f8f", "#c2412d"], v), "#e4b15a");
  }
}

export function bathroom(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  const fy = h * FLOOR;
  const [tile, grout] = pick(
    [
      ["#e3f1f8", "#9fc6dc"],
      ["#f4efe6", "#d6cbbb"],
      ["#7eb8d4", "#2a4f8f"],
    ],
    v,
  );
  tiles(ctx, 0, 0, w, fy, 30, tile, grout);
  tiles(ctx, 0, fy, w, h - fy, 36, "#c5ccd6", "#9aa3ad");
  line(ctx, 0, fy, w, fy, INK, 4);
  // آینهٔ بخارگرفته و روشویی در راست
  box(ctx, w * 0.74, h * 0.14, w * 0.16, h * 0.2, "#d5eef8", { r: 8 });
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(w * 0.76, h * 0.22, w * 0.12, h * 0.08);
  box(ctx, w * 0.73, fy - h * 0.2, w * 0.18, h * 0.05, "#ffffff", { r: 10 });
  box(ctx, w * 0.8, fy - h * 0.15, w * 0.04, h * 0.15, "#ffffff");
  look.lights.push({ kind: "glow", x: w * 0.82, y: h * 0.1, r: w * 0.2, color: "#fff1c4" });
  if (v === 0) {
    // دوش با پرده
    line(ctx, w * 0.02, h * 0.12, w * 0.34, h * 0.12, "#9aa3ad", 5);
    poly(ctx, [
      [w * 0.02, h * 0.12],
      [w * 0.16, h * 0.12],
      [w * 0.14, fy],
      [w * 0.02, fy],
    ], "#7a6bff", INK, 2);
    box(ctx, w * 0.22, h * 0.16, w * 0.03, h * 0.02, "#9aa3ad", { lw: 2 });
    for (let i = 0; i < 6; i++) {
      const y = h * 0.2 + ((look.time * 120 + i * 37) % (fy - h * 0.2));
      line(ctx, w * 0.21 + i * 4, y, w * 0.21 + i * 4, y + 10, "#7eb8d4", 2);
    }
  } else if (v === 1) {
    // وان
    box(ctx, w * 0.02, fy - h * 0.14, w * 0.36, h * 0.14, "#ffffff", { r: 18 });
    for (let i = 0; i < 5; i++) circle(ctx, w * (0.08 + i * 0.06), fy - h * 0.15, 9 + (i % 2) * 4, "#f4efe6", "#9fc6dc", 2);
    box(ctx, w * 0.3, fy - h * 0.24, w * 0.02, h * 0.1, "#9aa3ad", { lw: 2 });
    plant(ctx, w * 0.5, fy, 0.8, "#f4efe6");
  } else {
    // حمام ایرانی: دوش دیواری، کف‌شور، تشت و لیف
    box(ctx, w * 0.18, h * 0.14, w * 0.03, h * 0.02, "#9aa3ad", { lw: 2 });
    line(ctx, w * 0.195, h * 0.16, w * 0.195, h * 0.32, "#9aa3ad", 4);
    circle(ctx, w * 0.4, fy + h * 0.15, w * 0.02, "#9aa3ad", INK, 2);
    box(ctx, w * 0.04, fy - h * 0.06, w * 0.14, h * 0.06, "#c2412d", { r: 6 });
    box(ctx, w * 0.5, h * 0.4, w * 0.1, h * 0.03, "#e4b15a", { r: 4 });
    windowPane(ctx, look, w * 0.44, h * 0.06, w * 0.12, h * 0.12, "#f4efe6");
  }
}

export function toilet(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  const fy = h * FLOOR;
  tiles(ctx, 0, 0, w, fy, 28, pick(["#f4efe6", "#e3f1f8", "#efe6da"], v), "#c9c0b0");
  tiles(ctx, 0, fy, w, h - fy, 34, "#9aa3ad", "#7c8590");
  line(ctx, 0, fy, w, fy, INK, 4);
  door(ctx, w * 0.04, h * 0.1, w * 0.16, fy - h * 0.1, "#e8e2d6");
  windowPane(ctx, look, w * 0.44, h * 0.06, w * 0.12, h * 0.12, "#f4efe6");
  look.lights.push({ kind: "glow", x: w * 0.5, y: h * 0.06, r: w * 0.24, color: "#fff1c4" });
  if (v === 0) {
    // توالت ایرانی (زمینی) و آفتابه
    box(ctx, w * 0.36, fy + h * 0.06, w * 0.16, h * 0.06, "#ffffff", { r: 14 });
    box(ctx, w * 0.4, fy + h * 0.075, w * 0.08, h * 0.03, "#c5ccd6", { r: 8, lw: 2 });
    // آفتابهٔ پلاستیکی
    const ax = w * 0.6;
    const ay = fy + h * 0.12;
    box(ctx, ax - 18, ay - 44, 36, 44, "#c2412d", { r: 10 });
    line(ctx, ax + 16, ay - 30, ax + 40, ay - 46, INK, 6);
    line(ctx, ax + 16, ay - 30, ax + 40, ay - 46, "#c2412d", 3);
    box(ctx, ax - 10, ay - 52, 20, 10, "#c2412d", { r: 4, lw: 2 });
  } else if (v === 1) {
    // فرنگی
    box(ctx, w * 0.42, fy - h * 0.22, w * 0.1, h * 0.12, "#ffffff", { r: 6 });
    box(ctx, w * 0.38, fy - h * 0.1, w * 0.16, h * 0.04, "#ffffff", { r: 10 });
    box(ctx, w * 0.42, fy - h * 0.06, w * 0.08, h * 0.06, "#ffffff");
    circle(ctx, w * 0.62, h * 0.36, w * 0.025, "#f4efe6");
  }
  // روشویی و آینه (در طرح ۳ بزرگ‌تر)
  const big = v === 2 ? 1.5 : 1;
  box(ctx, w * 0.74, h * 0.14, w * 0.14 * big, h * 0.18 * big, "#d5eef8", { r: 8 });
  box(ctx, w * 0.72, fy - h * 0.2, w * 0.18 * big, h * 0.05, "#ffffff", { r: 10 });
  box(ctx, w * 0.79, fy - h * 0.15, w * 0.04, h * 0.15, "#ffffff");
  if (v === 2) plant(ctx, w * 0.62, fy, 0.9);
}

export function parking(ctx: Ctx, w: number, h: number, look: Look) {
  const v = look.variant;
  const fy = h * 0.62;
  if (v === 1) {
    // حیاط پارکینگ روباز
    const g = ctx.createLinearGradient(0, 0, 0, h * 0.4);
    g.addColorStop(0, look.night ? "#0b1022" : "#7ec3ea");
    g.addColorStop(1, look.night ? "#22305a" : "#cfe9f5");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h * 0.4);
    box(ctx, 0, h * 0.3, w, fy - h * 0.3, "#d9cbb5", { stroke: null });
    for (let x = 0; x < w; x += 60) box(ctx, x, h * 0.3, 60, 22, "#c4a484", { lw: 1 });
  } else {
    wall(ctx, w, fy, v === 0 ? "#9aa3ad" : "#c5ccd6", v === 0 ? "#7c8590" : "#aab2bd");
    if (v === 2) {
      // کرکرهٔ فلزی
      box(ctx, w * 0.6, h * 0.12, w * 0.32, fy - h * 0.12, "#b9c0c8");
      for (let y = h * 0.14; y < fy; y += 12) line(ctx, w * 0.6, y, w * 0.92, y, "#7c8590", 2);
    }
  }
  ctx.fillStyle = "#6b7280";
  ctx.fillRect(0, fy, w, h - fy);
  line(ctx, 0, fy, w, fy, INK, 4);
  // خط‌کشی جای پارک
  for (let x = 0.05; x < 1; x += 0.3) {
    poly(ctx, [
      [w * x, fy + 6],
      [w * x + 8, fy + 6],
      [w * (x - 0.04) + 8, h],
      [w * (x - 0.04), h],
    ], "#f2c230", null);
  }
  if (v !== 1) {
    // ستون‌ها و چراغ مهتابی سقف
    for (const px of [0.18, 0.82]) {
      box(ctx, w * px - 16, 0, 32, fy, "#c5ccd6");
      poly(ctx, [
        [w * px - 16, fy - 40],
        [w * px + 16, fy - 40],
        [w * px + 16, fy - 20],
        [w * px - 16, fy - 20],
      ], "#f2c230", INK, 2);
    }
    for (const lx of [0.3, 0.7]) {
      box(ctx, w * lx - 40, 10, 80, 10, "#f4efe6", { lw: 2 });
      look.lights.push({ kind: "glow", x: w * lx, y: 40, r: w * 0.28, color: "#e9f4ff" });
    }
  }
  car(ctx, pick(["samand", "pride", "suv"], v), w * 0.5, fy + 4, Math.min(1.2, w / 820));
  car(ctx, pick(["hatch", "peykan", "modern"], v), w * 0.06, fy + 4, Math.min(1.2, w / 820));
}
