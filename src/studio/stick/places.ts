/**
 * مکان‌ها به سبک خطی سیاه‌وسفید، برای قاب عمودی ۱۰۸۰×۱۹۲۰.
 * هر مکان سه لایه دارد: پشت (دیوار، پنجره، پشتی مبل)، جلو (دستهٔ مبل، میز، داشبورد ماشین)
 * و جاهای نشستن (x روی قاب). شب: کاغذ تیره‌تر، پنجره‌ها و آسمان تاریک با ماه و ستاره و نور چراغ.
 */
import { INK, PAPER, type Ctx } from "./figure-base.ts";
import { rng } from "./paper.ts";

export type PlaceId =
  | "living"
  | "kitchen"
  | "bedroom"
  | "street"
  | "park"
  | "stadium"
  | "car"
  | "office"
  | "cafe"
  | "classroom"
  | "blank";

export type Env = {
  w: number;
  h: number;
  floor: number;
  seatTop: number;
  night: boolean;
  t: number;
  /** رنگ داخل اشیاء (روز سفید، شب خاکستری مایل به آبی). */
  fill: string;
};

export type PlaceDef = {
  id: PlaceId;
  label: string;
  aliases: string[];
  interior: boolean;
  /** جاهای نشستن (کسری از عرض قاب). */
  seats: number[];
  /** جای پیش‌فرض ایستادن چند نفر (کسری از عرض). */
  spots: number[];
  back: (ctx: Ctx, e: Env) => void;
  front?: (ctx: Ctx, e: Env) => void;
  /** در ماشین همه نشسته‌اند و پایین بدن پشت داشبورد است. */
  forceSit?: boolean;
};

export const NIGHT_FILL = "#c3c7d3";

/* ---------- ابزار ---------- */

function ink(ctx: Ctx, w: number) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

function shape(ctx: Ctx, w: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fill();
  ink(ctx, w);
  ctx.stroke();
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string, lw = 4.4) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  shape(ctx, lw, fill);
}

function ln(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, lw = 4) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ink(ctx, lw);
  ctx.stroke();
}

function circ(ctx: Ctx, x: number, y: number, r: number, fill: string, lw = 4) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  shape(ctx, lw, fill);
}

function text(ctx: Ctx, s: string, x: number, y: number, size: number, color = INK) {
  ctx.font = `800 ${size}px Vazirmatn, Tahoma, sans-serif`;
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** نور گرم چراغ در شب. */
function glow(ctx: Ctx, x: number, y: number, r: number, alpha = 0.55) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255,248,220,${alpha})`);
  g.addColorStop(1, "rgba(255,248,220,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** آسمان شب داخل یک مستطیل (پنجره یا بالای قاب بیرونی): تیره، ستاره و ماه. */
function nightSky(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, moon = true) {
  ctx.fillStyle = "#3d4253";
  ctx.fillRect(x, y, w, h);
  const r = rng(seed);
  ctx.fillStyle = "#f4f4f0";
  for (let i = 0; i < Math.max(4, (w * h) / 9000); i++) {
    ctx.beginPath();
    ctx.arc(x + r() * w, y + r() * h * 0.85, 1.2 + r() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (moon) {
    const mx = x + w * 0.72;
    const my = y + h * 0.3;
    const mr = Math.min(w, h) * 0.12;
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fillStyle = "#f6f3e4";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(mx + mr * 0.45, my - mr * 0.2, mr * 0.85, 0, Math.PI * 2);
    ctx.fillStyle = "#3d4253";
    ctx.fill();
  }
}

/** آسمان روز: چند ابر خطی و خورشید. */
function daySky(ctx: Ctx, x: number, y: number, w: number, h: number, e: Env, sun = true) {
  const cloud = (cx: number, cy: number, s: number) => {
    ctx.beginPath();
    ctx.arc(cx - 30 * s, cy, 22 * s, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(cx, cy - 16 * s, 30 * s, Math.PI, 0);
    ctx.arc(cx + 34 * s, cy, 22 * s, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
    shape(ctx, 3.6, e.fill);
  };
  const drift = (e.t * 6) % (w + 200);
  cloud(x + ((w * 0.25 + drift) % (w + 200)) - 100, y + h * 0.35, 1);
  cloud(x + ((w * 0.75 + drift * 0.7) % (w + 200)) - 100, y + h * 0.6, 0.75);
  if (sun) {
    circ(ctx, x + w * 0.85, y + h * 0.25, Math.min(w, h) * 0.08, e.fill, 3.6);
  }
}

function windowFrame(ctx: Ctx, e: Env, x: number, y: number, w: number, h: number, seed: number, curtains = true) {
  if (e.night) nightSky(ctx, x, y, w, h, seed);
  else {
    ctx.fillStyle = "#f7f7f5";
    ctx.fillRect(x, y, w, h);
    daySky(ctx, x, y, w, h, e, false);
  }
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ink(ctx, 5);
  ctx.stroke();
  ln(ctx, x + w / 2, y, x + w / 2, y + h, 4);
  ln(ctx, x, y + h / 2, x + w, y + h / 2, 4);
  rr(ctx, x - 14, y + h, w + 28, 16, 4, e.fill, 4);
  if (curtains) {
    for (const s of [-1, 1]) {
      const cx = s < 0 ? x - 10 : x + w + 10;
      ctx.beginPath();
      ctx.moveTo(cx, y - 20);
      ctx.quadraticCurveTo(cx + s * -60, y + h * 0.5, cx + s * -18, y + h + 30);
      ctx.lineTo(cx + s * 26, y + h + 30);
      ctx.lineTo(cx + s * 26, y - 20);
      ctx.closePath();
      shape(ctx, 4, e.fill);
    }
    ln(ctx, x - 50, y - 22, x + w + 50, y - 22, 5);
  }
}

function wallClock(ctx: Ctx, e: Env, cx: number, cy: number) {
  circ(ctx, cx, cy, 54, e.fill, 4.4);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ln(ctx, cx + Math.cos(a) * 40, cy + Math.sin(a) * 40, cx + Math.cos(a) * 46, cy + Math.sin(a) * 46, 3);
  }
  const hand = (a: number, len: number, w: number) => ln(ctx, cx, cy, cx + Math.sin(a) * len, cy - Math.cos(a) * len, w);
  hand(e.t * 0.8, 36, 3);
  hand(1.9 + e.t * 0.07, 24, 4.4);
}

function frame(ctx: Ctx, e: Env, x: number, y: number, w: number, h: number) {
  rr(ctx, x, y, w, h, 3, e.fill, 4.4);
  ctx.beginPath();
  ctx.moveTo(x + 14, y + h - 14);
  ctx.lineTo(x + w * 0.4, y + h * 0.45);
  ctx.lineTo(x + w * 0.6, y + h * 0.65);
  ctx.lineTo(x + w * 0.75, y + h * 0.35);
  ctx.lineTo(x + w - 14, y + h - 14);
  ink(ctx, 3);
  ctx.stroke();
  circ(ctx, x + w * 0.25, y + h * 0.3, 9, e.fill, 3);
}

function floorLine(ctx: Ctx, e: Env, y: number) {
  ln(ctx, 0, y, e.w, y, 4);
}

function plant(ctx: Ctx, e: Env, x: number, base: number, s = 1) {
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(x + i * 14 * s, base - 90 * s - Math.abs(i) * -10 * s, 14 * s, 42 * s, i * 0.35, 0, Math.PI * 2);
    shape(ctx, 3.6, e.fill);
  }
  ctx.beginPath();
  ctx.moveTo(x - 34 * s, base - 60 * s);
  ctx.lineTo(x + 34 * s, base - 60 * s);
  ctx.lineTo(x + 24 * s, base);
  ctx.lineTo(x - 24 * s, base);
  ctx.closePath();
  shape(ctx, 4, e.fill);
}

function floorLamp(ctx: Ctx, e: Env, x: number, floor: number) {
  ln(ctx, x, floor, x, floor - 380, 5);
  ctx.beginPath();
  ctx.ellipse(x, floor, 40, 9, 0, 0, Math.PI * 2);
  shape(ctx, 4, e.fill);
  ctx.beginPath();
  ctx.moveTo(x - 60, floor - 380);
  ctx.lineTo(x + 60, floor - 380);
  ctx.lineTo(x + 38, floor - 470);
  ctx.lineTo(x - 38, floor - 470);
  ctx.closePath();
  shape(ctx, 4.4, e.night ? "#fff8dc" : e.fill);
  if (e.night) glow(ctx, x, floor - 400, 260, 0.5);
}

/* ---------- مبل، صندلی، میز ---------- */

/** مبل از روبه‌رو: پشتی و نشیمن (لایهٔ پشت). */
function sofaBack(ctx: Ctx, e: Env, cx: number, s: number) {
  const w = 760 * s;
  const top = e.seatTop - 250 * s;
  rr(ctx, cx - w / 2 + 40 * s, top, w - 80 * s, e.seatTop - top + 10 * s, 46 * s, e.fill);
  for (const k of [-1, 1]) ln(ctx, cx + k * (w / 6), top + 26 * s, cx + k * (w / 6), e.seatTop - 6 * s, 3);
  rr(ctx, cx - w / 2 + 50 * s, e.seatTop - 8 * s, w - 100 * s, 46 * s, 14 * s, e.fill);
  rr(ctx, cx - w / 2 + 52 * s, e.seatTop + 36 * s, w - 104 * s, e.floor - 24 * s - (e.seatTop + 36 * s), 8 * s, e.fill);
}

/** دسته‌ها و پایه‌های مبل (لایهٔ جلو). */
function sofaFront(ctx: Ctx, e: Env, cx: number, s: number) {
  const w = 760 * s;
  for (const side of [-1, 1]) {
    const x = cx + side * (w / 2 - 34 * s);
    rr(ctx, x - 44 * s, e.seatTop - 110 * s, 88 * s, e.floor - 24 * s - (e.seatTop - 110 * s), 34 * s, e.fill);
    ctx.beginPath();
    ctx.arc(x, e.seatTop - 76 * s, 15 * s, 0, Math.PI * 2);
    ink(ctx, 3);
    ctx.stroke();
    const lx = cx + side * (w / 2 - 50 * s);
    ctx.beginPath();
    ctx.moveTo(lx - 10 * s, e.floor - 24 * s);
    ctx.lineTo(lx - 6 * s, e.floor);
    ctx.lineTo(lx + 6 * s, e.floor);
    ctx.lineTo(lx + 10 * s, e.floor - 24 * s);
    shape(ctx, 3.6, e.fill);
  }
}

/** صندلی ساده از روبه‌رو: پشتی (پشت آدم) */
function chairBack(ctx: Ctx, e: Env, x: number) {
  rr(ctx, x - 70, e.seatTop - 200, 140, 200, 18, e.fill);
  rr(ctx, x - 80, e.seatTop - 6, 160, 22, 8, e.fill);
}

/** پایه‌های صندلی (جلو). */
function chairFront(ctx: Ctx, e: Env, x: number) {
  rr(ctx, x - 80, e.seatTop - 6, 160, 22, 8, e.fill);
  for (const s of [-1, 1]) ln(ctx, x + s * 66, e.seatTop + 16, x + s * 72, e.floor, 5);
}

/** میز جلوی آدم‌ها: سطح میز و دو پایه. */
function tableFront(ctx: Ctx, e: Env, cx: number, w: number, top: number) {
  rr(ctx, cx - w / 2, top, w, 22, 8, e.fill);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * (w / 2 - 40), top + 22);
    ctx.lineTo(cx + s * (w / 2 - 30), e.floor);
    ink(ctx, 6);
    ctx.stroke();
  }
}

function mug(ctx: Ctx, e: Env, cx: number, base: number, steam = true) {
  ctx.beginPath();
  ctx.moveTo(cx - 20, base - 46);
  ctx.lineTo(cx + 20, base - 46);
  ctx.lineTo(cx + 16, base);
  ctx.lineTo(cx - 16, base);
  ctx.closePath();
  shape(ctx, 4, e.fill);
  ctx.beginPath();
  ctx.arc(cx + 24, base - 26, 11, -Math.PI / 2, Math.PI / 2);
  ink(ctx, 4);
  ctx.stroke();
  if (steam) {
    ctx.globalAlpha = 0.7;
    for (const k of [-1, 1]) {
      ctx.beginPath();
      const x = cx + k * 8;
      ctx.moveTo(x, base - 52);
      for (let i = 1; i <= 6; i++) ctx.lineTo(x + Math.sin(e.t * 4 + i + k) * 5, base - 52 - i * 7);
      ink(ctx, 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/* ---------- ساختمان و خیابان ---------- */

function building(ctx: Ctx, e: Env, x: number, top: number, w: number, base: number, seed: number) {
  rr(ctx, x, top, w, base - top, 4, e.fill);
  const r = rng(seed);
  const cols = Math.max(2, Math.round(w / 90));
  const cw = w / cols;
  for (let y = top + 30; y < base - 130; y += 110) {
    for (let c = 0; c < cols; c++) {
      const wx = x + c * cw + cw * 0.22;
      const lit = e.night && r() < 0.55;
      ctx.beginPath();
      ctx.rect(wx, y, cw * 0.56, 64);
      shape(ctx, 3.4, e.night ? (lit ? "#fff3c4" : "#555b6d") : "#f7f7f5");
      ln(ctx, wx + cw * 0.28, y, wx + cw * 0.28, y + 64, 2.4);
      if (lit) glow(ctx, wx + cw * 0.28, y + 32, 70, 0.35);
    }
  }
}

function streetLamp(ctx: Ctx, e: Env, x: number, base: number) {
  ln(ctx, x, base, x, base - 560, 6);
  ln(ctx, x, base - 560, x + 70, base - 560, 6);
  rr(ctx, x + 50, base - 556, 44, 24, 6, e.night ? "#fff8dc" : e.fill, 4);
  if (e.night) {
    glow(ctx, x + 72, base - 530, 300, 0.45);
  }
}

function tree(ctx: Ctx, e: Env, x: number, base: number, s = 1) {
  ctx.beginPath();
  ctx.moveTo(x - 16 * s, base);
  ctx.lineTo(x - 10 * s, base - 200 * s);
  ctx.lineTo(x + 10 * s, base - 200 * s);
  ctx.lineTo(x + 16 * s, base);
  ctx.closePath();
  shape(ctx, 4, e.fill);
  ctx.beginPath();
  const cy = base - 290 * s;
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const a2 = ((i + 0.5) / n) * Math.PI * 2;
    const px = x + Math.cos(a) * 120 * s;
    const py = cy + Math.sin(a) * 105 * s;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.quadraticCurveTo(x + Math.cos(a2 - Math.PI / n) * 160 * s, cy + Math.sin(a2 - Math.PI / n) * 140 * s, px, py);
  }
  ctx.closePath();
  shape(ctx, 4.4, e.fill);
}

function bench(ctx: Ctx, e: Env, cx: number, w: number) {
  rr(ctx, cx - w / 2, e.seatTop - 160, w, 26, 8, e.fill);
  rr(ctx, cx - w / 2, e.seatTop - 110, w, 26, 8, e.fill);
  rr(ctx, cx - w / 2 - 10, e.seatTop - 4, w + 20, 26, 8, e.fill);
}

function benchFront(ctx: Ctx, e: Env, cx: number, w: number) {
  rr(ctx, cx - w / 2 - 10, e.seatTop - 4, w + 20, 26, 8, e.fill);
  for (const s of [-1, 1]) ln(ctx, cx + s * (w / 2 - 30), e.seatTop + 22, cx + s * (w / 2 - 24), e.floor, 7);
}

/** اندازهٔ شیشهٔ جلوی ماشین (پشت آن داخل ماشین دیده می‌شود). */
function carGlass() {
  return { x: 70, y: 300, w: W - 140, h: 820 };
}

/* ---------- تعریف مکان‌ها ---------- */

const W = 1080;

export const PLACES: Record<PlaceId, PlaceDef> = {
  living: {
    id: "living",
    label: "پذیرایی خانه",
    aliases: ["پذیرایی", "خانه", "خونه", "هال", "نشیمن", "اتاق نشیمن", "سالن"],
    interior: true,
    seats: [0.33, 0.5, 0.67],
    spots: [0.25, 0.75, 0.5],
    back: (ctx, e) => {
      floorLine(ctx, e, e.floor - 30);
      windowFrame(ctx, e, 120, 470, 240, 300, 3);
      frame(ctx, e, 640, 520, 170, 130);
      wallClock(ctx, e, 900, 470);
      floorLamp(ctx, e, 1000, e.floor);
      // فرش
      ctx.beginPath();
      ctx.ellipse(W / 2, e.floor + 40, 380, 50, 0, 0, Math.PI * 2);
      shape(ctx, 4, e.fill);
      ctx.beginPath();
      ctx.ellipse(W / 2, e.floor + 40, 330, 36, 0, 0, Math.PI * 2);
      ink(ctx, 2.6);
      ctx.stroke();
      sofaBack(ctx, e, W / 2, 1.3);
    },
    front: (ctx, e) => sofaFront(ctx, e, W / 2, 1.3),
  },
  kitchen: {
    id: "kitchen",
    label: "آشپزخانه",
    aliases: ["آشپزخانه", "آشپزخونه", "مطبخ"],
    interior: true,
    seats: [0.28, 0.72],
    spots: [0.3, 0.7, 0.5],
    back: (ctx, e) => {
      const ctop = e.floor - 330;
      // کابینت‌های بالا
      for (let i = 0; i < 4; i++) rr(ctx, 280 + i * 150, 380, 140, 200, 6, e.fill);
      for (let i = 0; i < 4; i++) circ(ctx, 280 + i * 150 + (i % 2 ? 20 : 120), 560, 5, INK, 1);
      // پنجره بالای سینک
      windowFrame(ctx, e, 60, 400, 180, 220, 9, false);
      // یخچال
      rr(ctx, 860, ctop - 340, 190, e.floor - (ctop - 340), 14, e.fill);
      ln(ctx, 860, ctop - 60, 1050, ctop - 60, 4);
      ln(ctx, 880, ctop - 220, 880, ctop - 130, 6);
      ln(ctx, 880, ctop + 20, 880, ctop + 110, 6);
      // کابینت پایین و اجاق
      rr(ctx, 30, ctop, 820, e.floor - ctop, 6, e.fill);
      ln(ctx, 30, ctop + 30, 850, ctop + 30, 4);
      for (let i = 1; i < 5; i++) ln(ctx, 30 + i * 164, ctop + 30, 30 + i * 164, e.floor, 3);
      // قابلمه با بخار روی اجاق
      rr(ctx, 560, ctop - 70, 130, 70, 10, e.fill);
      ln(ctx, 540, ctop - 60, 710, ctop - 60, 5);
      mug(ctx, e, 300, ctop, false);
      if (e.night) glow(ctx, 540, 360, 300, 0.4);
      // میز غذاخوری پشت صندلی‌ها
      chairBack(ctx, e, W * 0.28);
      chairBack(ctx, e, W * 0.72);
    },
    front: (ctx, e) => {
      chairFront(ctx, e, W * 0.28);
      chairFront(ctx, e, W * 0.72);
      tableFront(ctx, e, W / 2, 300, e.seatTop - 60);
      mug(ctx, e, W / 2 - 60, e.seatTop - 60);
      ctx.beginPath();
      ctx.ellipse(W / 2 + 60, e.seatTop - 66, 52, 12, 0, 0, Math.PI * 2);
      shape(ctx, 4, e.fill);
    },
  },
  bedroom: {
    id: "bedroom",
    label: "اتاق خواب",
    aliases: ["اتاق خواب", "اتاق‌خواب", "تخت خواب", "اتاقش", "اتاق"],
    interior: true,
    seats: [0.38, 0.6],
    spots: [0.25, 0.75, 0.5],
    back: (ctx, e) => {
      floorLine(ctx, e, e.floor - 30);
      windowFrame(ctx, e, 720, 430, 240, 300, 5);
      frame(ctx, e, 120, 470, 150, 190);
      // تخت: تاج تخت، تشک، پتو
      const cx = W * 0.49;
      rr(ctx, cx - 300, e.seatTop - 330, 600, 340, 40, e.fill);
      rr(ctx, cx - 260, e.seatTop - 150, 200, 80, 30, e.fill);
      rr(ctx, cx + 60, e.seatTop - 150, 200, 80, 30, e.fill);
      rr(ctx, cx - 320, e.seatTop - 10, 640, 70, 16, e.fill);
      rr(ctx, cx - 320, e.seatTop + 60, 640, e.floor - e.seatTop - 70, 10, e.fill);
      // میز کنار تخت و آباژور
      rr(ctx, 860, e.floor - 200, 150, 200, 8, e.fill);
      ln(ctx, 935, e.floor - 200, 935, e.floor - 290, 5);
      ctx.beginPath();
      ctx.moveTo(885, e.floor - 290);
      ctx.lineTo(985, e.floor - 290);
      ctx.lineTo(960, e.floor - 360);
      ctx.lineTo(910, e.floor - 360);
      ctx.closePath();
      shape(ctx, 4, e.night ? "#fff8dc" : e.fill);
      if (e.night) glow(ctx, 935, e.floor - 320, 240, 0.5);
    },
    front: (ctx, e) => {
      const cx = W * 0.49;
      rr(ctx, cx - 320, e.seatTop - 10, 640, 70, 16, e.fill);
    },
  },
  street: {
    id: "street",
    label: "خیابان",
    aliases: ["خیابان", "خیابون", "کوچه", "پیاده‌رو", "سر کوچه", "بیرون"],
    interior: false,
    seats: [],
    spots: [0.3, 0.7, 0.5],
    back: (ctx, e) => {
      if (e.night) nightSky(ctx, 0, 0, e.w, e.floor - 400, 21);
      else daySky(ctx, 0, 200, e.w, 400, e);
      building(ctx, e, -20, 560, 360, e.floor - 120, 4);
      building(ctx, e, 360, 700, 330, e.floor - 120, 8);
      building(ctx, e, 710, 520, 400, e.floor - 120, 12);
      // مغازه با تابلو
      rr(ctx, 400, e.floor - 330, 250, 210, 6, e.night ? "#e8e2c8" : e.fill);
      rr(ctx, 380, e.floor - 400, 290, 66, 10, e.fill);
      text(ctx, "سوپرمارکت", 525, e.floor - 366, 40);
      if (e.night) glow(ctx, 525, e.floor - 220, 260, 0.35);
      // پیاده‌رو و جدول
      ln(ctx, 0, e.floor - 120, e.w, e.floor - 120, 4);
      ln(ctx, 0, e.floor + 60, e.w, e.floor + 60, 5);
      for (let x = 30; x < e.w; x += 140) ln(ctx, x, e.floor - 120, x - 40, e.floor + 60, 2.4);
      // خط وسط خیابان
      for (let x = 0; x < e.w; x += 180) ln(ctx, x + 20, e.floor + 200, x + 110, e.floor + 200, 7);
      streetLamp(ctx, e, 120, e.floor - 60);
      tree(ctx, e, 980, e.floor - 40, 0.8);
    },
  },
  park: {
    id: "park",
    label: "پارک",
    aliases: ["پارک", "بوستان", "باغ", "فضای سبز"],
    interior: false,
    seats: [0.4, 0.6],
    spots: [0.25, 0.75, 0.5],
    back: (ctx, e) => {
      if (e.night) nightSky(ctx, 0, 0, e.w, e.floor - 300, 31);
      else daySky(ctx, 0, 250, e.w, 400, e);
      ln(ctx, 0, e.floor - 260, e.w, e.floor - 260, 4);
      tree(ctx, e, 130, e.floor - 220, 1.05);
      tree(ctx, e, 950, e.floor - 200, 1.15);
      // بوته‌ها
      for (const x of [300, 780]) {
        ctx.beginPath();
        ctx.arc(x - 40, e.floor - 270, 40, Math.PI, 0);
        ctx.arc(x + 20, e.floor - 285, 52, Math.PI, 0);
        ctx.arc(x + 80, e.floor - 270, 36, Math.PI, 0);
        ctx.closePath();
        shape(ctx, 4, e.fill);
      }
      streetLamp(ctx, e, 560, e.floor - 250);
      // مسیر
      ctx.beginPath();
      ctx.moveTo(380, e.floor - 260);
      ctx.quadraticCurveTo(300, e.floor, 120, e.floor + 200);
      ctx.moveTo(700, e.floor - 260);
      ctx.quadraticCurveTo(780, e.floor, 960, e.floor + 200);
      ink(ctx, 4);
      ctx.stroke();
      // چمن
      const r = rng(5);
      for (let i = 0; i < 40; i++) {
        const gx = r() * e.w;
        const gy = e.floor - 240 + r() * 520;
        ln(ctx, gx, gy, gx - 4, gy - 12, 2.4);
        ln(ctx, gx + 6, gy, gx + 8, gy - 14, 2.4);
      }
      bench(ctx, e, W / 2, 420);
    },
    front: (ctx, e) => benchFront(ctx, e, W / 2, 420),
  },
  stadium: {
    id: "stadium",
    label: "ورزشگاه",
    aliases: ["ورزشگاه", "استادیوم", "زمین فوتبال", "ورزشگاه آزادی", "سکو", "سکوها"],
    interior: false,
    seats: [0.3, 0.5, 0.7],
    spots: [0.3, 0.7, 0.5],
    back: (ctx, e) => {
      if (e.night) nightSky(ctx, 0, 0, e.w, 520, 41, false);
      else daySky(ctx, 0, 120, e.w, 300, e);
      // پروژکتورها
      for (const x of [120, 960]) {
        ln(ctx, x, 560, x, 200, 6);
        rr(ctx, x - 70, 150, 140, 70, 8, e.night ? "#fff8dc" : e.fill);
        for (let i = 0; i < 3; i++) circ(ctx, x - 40 + i * 40, 185, 12, e.night ? "#ffffff" : e.fill, 3);
        if (e.night) glow(ctx, x, 190, 420, 0.5);
      }
      // سکوها با تماشاگران (سرهای گرد)
      const r = rng(9);
      for (let row = 0; row < 6; row++) {
        const y = 520 + row * 70;
        ln(ctx, 0, y + 40, e.w, y + 40, 3);
        for (let x = 20 + (row % 2) * 25; x < e.w; x += 50) {
          const bob = Math.sin(e.t * 6 + x * 0.05 + row) * (r() < 0.3 ? 6 : 1.5);
          circ(ctx, x, y + 14 + bob, 15, e.fill, 2.6);
          if (r() < 0.12) ln(ctx, x, y + 26 + bob, x + 14, y - 14 + bob, 3);
        }
      }
      // تابلوهای کنار زمین
      rr(ctx, 0, 940, e.w, 90, 4, e.fill);
      text(ctx, "گل!", 220, 985, 46);
      text(ctx, "فوتبال", 560, 985, 46);
      text(ctx, "تیم ما", 880, 985, 46);
      // زمین چمن
      ln(ctx, 0, e.floor - 200, e.w, e.floor - 200, 4);
      ctx.beginPath();
      ctx.ellipse(W / 2, e.floor - 60, 260, 70, 0, Math.PI, 0);
      ink(ctx, 4);
      ctx.stroke();
      ln(ctx, W / 2, e.floor - 200, W / 2, e.floor + 200, 4);
      // دروازه
      ctx.beginPath();
      ctx.moveTo(900, e.floor - 60);
      ctx.lineTo(900, e.floor - 330);
      ctx.lineTo(1080, e.floor - 330);
      ink(ctx, 7);
      ctx.stroke();
      for (let i = 1; i < 6; i++) ln(ctx, 900 + i * 30, e.floor - 330, 900 + i * 30, e.floor - 60, 1.6);
      for (let i = 1; i < 8; i++) ln(ctx, 900, e.floor - 330 + i * 34, 1080, e.floor - 330 + i * 34, 1.6);
    },
  },
  car: {
    id: "car",
    label: "داخل ماشین",
    aliases: ["داخل ماشین", "توی ماشین", "تو ماشین", "ماشین", "خودرو", "تاکسی", "اتومبیل", "پشت فرمان"],
    interior: true,
    seats: [0.32, 0.68],
    spots: [0.32, 0.68],
    forceSit: true,
    // دوربین بیرون ماشین، روبه‌روی شیشهٔ جلو: آدم‌ها را از جلو می‌بینیم و پشت سرشان شیشهٔ عقب و جاده‌ای است که دور می‌شود.
    back: (ctx, e) => {
      const g = carGlass();
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(g.x, g.y, g.w, g.h, [90, 90, 20, 20]);
      ctx.clip();
      ctx.fillStyle = e.night ? "#9fa3b2" : "#ececea";
      ctx.fillRect(g.x, g.y, g.w, g.h);
      // سقف داخل
      ln(ctx, g.x, 420, g.x + g.w, 420, 3);
      // شیشهٔ عقب و جاده‌ای که پشت ماشین دور می‌شود
      const rx = 250;
      const ry = 440;
      const rw = W - 500;
      const rh = 230;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 40);
      ctx.clip();
      if (e.night) nightSky(ctx, rx, ry, rw, rh, 51, false);
      else {
        ctx.fillStyle = "#f7f7f5";
        ctx.fillRect(rx, ry, rw, rh);
        daySky(ctx, rx, ry, rw, rh * 0.5, e, false);
      }
      const hz = ry + rh * 0.45;
      ln(ctx, rx, hz, rx + rw, hz, 2.6);
      ctx.beginPath();
      ctx.moveTo(W / 2 - 10, hz);
      ctx.lineTo(rx + 30, ry + rh);
      ctx.moveTo(W / 2 + 10, hz);
      ctx.lineTo(rx + rw - 30, ry + rh);
      ink(ctx, 3);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        // از نزدیک (پایین) به افق می‌رود: یعنی ماشین جلو می‌رود
        const k = (1 - ((e.t * 0.8 + i / 4) % 1)) ** 2;
        const y = hz + k * (ry + rh - hz);
        ln(ctx, W / 2, y, W / 2, y + 4 + k * 26, 2 + k * 4);
      }
      for (let i = 0; i < 3; i++) {
        const k = (1 - ((e.t * 0.45 + i / 3) % 1)) ** 2;
        for (const sd of [-1, 1]) {
          const x = W / 2 + sd * (40 + k * 330);
          const base = hz + k * (rh * 0.5);
          if (e.night) {
            ln(ctx, x, base, x, base - 18 - k * 110, 1.5 + k * 3);
            glow(ctx, x, base - 18 - k * 110, 24 + k * 60, 0.5);
          } else tree(ctx, e, x, base, 0.08 + k * 0.32);
        }
      }
      ctx.restore();
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 40);
      ink(ctx, 6);
      ctx.stroke();
      // صندلی عقب
      rr(ctx, 170, 660, W - 340, 260, 40, e.fill);
      for (const k of [-1, 1]) ln(ctx, W / 2 + k * 120, 690, W / 2 + k * 120, 900, 3);
      // پشتی و پشت‌سری صندلی‌های جلو (پشت آدم‌ها)
      for (const x of [W * 0.32, W * 0.68]) {
        for (const k of [-1, 1]) ln(ctx, x + k * 34, 700, x + k * 34, 760, 5);
        rr(ctx, x - 78, 610, 156, 100, 32, e.fill);
        rr(ctx, x - 128, 740, 256, 480, 54, e.fill);
      }
      ctx.restore();
    },
    front: (ctx, e) => {
      const g = carGlass();
      const body = e.night ? "#d9dbe3" : PAPER;
      // داشبورد (داخل ماشین، پشت شیشه، جلوی بدن‌ها)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(g.x, g.y, g.w, g.h, [90, 90, 20, 20]);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(g.x, 1080);
      ctx.quadraticCurveTo(W / 2, 1030, g.x + g.w, 1080);
      ctx.lineTo(g.x + g.w, g.y + g.h);
      ctx.lineTo(g.x, g.y + g.h);
      ctx.closePath();
      shape(ctx, 5, e.night ? "#8d92a6" : "#d6d6d2");
      // فرمان از پشت (راننده‌ی ایرانی سمت چپ ماشین است؛ از روبه‌رو سمت راست قاب)
      const sx = W * 0.68;
      const sy = 1030;
      ln(ctx, sx, sy, sx, 1110, 12);
      ctx.beginPath();
      ctx.ellipse(sx, sy, 150, 52, 0, 0, Math.PI * 2);
      ink(ctx, 11);
      ctx.stroke();
      // آینهٔ وسط از پشت با آویز تکان‌خورنده
      ln(ctx, W / 2, g.y, W / 2, g.y + 40, 6);
      rr(ctx, W / 2 - 90, g.y + 36, 180, 50, 16, "#3a3a3a", 4);
      const sw = Math.sin(e.t * 2.3) * 0.22;
      const hx = W / 2 + Math.sin(sw) * 80;
      const hy = g.y + 86 + Math.cos(sw) * 80;
      ln(ctx, W / 2, g.y + 86, hx, hy, 2.4);
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(-sw);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(16, 22);
      ctx.lineTo(8, 22);
      ctx.lineTo(18, 40);
      ctx.lineTo(-18, 40);
      ctx.lineTo(-8, 22);
      ctx.lineTo(-16, 22);
      ctx.closePath();
      shape(ctx, 3, e.fill);
      ctx.restore();
      // بازتاب نور روی شیشه
      ctx.globalAlpha = e.night ? 0.12 : 0.35;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(g.x + 40, g.y + 260);
      ctx.lineTo(g.x + 150, g.y + 40);
      ctx.lineTo(g.x + 200, g.y + 40);
      ctx.lineTo(g.x + 90, g.y + 260);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // جادهٔ زیر ماشین: خط‌های وسط از جلوی دوربین به زیر ماشین می‌روند (ماشین جلو می‌رود)
      const bottom = g.y + g.h;
      const bumper = bottom + 300;
      ctx.fillStyle = e.night ? "#7f8496" : "#e4e4e1";
      ctx.fillRect(0, bumper - 20, W, e.h - bumper + 20);
      for (const k of [-1, 1]) ln(ctx, W / 2 + k * 470, bumper, W / 2 + k * 620, e.h, 5);
      for (let i = 0; i < 3; i++) {
        const u = (e.t * 0.9 + i / 3) % 1;
        const y0 = e.h - u * (e.h - bumper);
        ln(ctx, W / 2, y0, W / 2, Math.max(bumper, y0 - 90 + u * 40), 10 - u * 4);
      }
      // بدنهٔ ماشین دور شیشه: سقف، ستون‌ها، کاپوت، برف‌پاک‌کن، چراغ‌ها و سپر
      ctx.beginPath();
      ctx.moveTo(0, 230);
      ctx.quadraticCurveTo(W / 2, 170, W, 230);
      ctx.lineTo(W, bumper);
      ctx.quadraticCurveTo(W / 2, bumper + 30, 0, bumper);
      ctx.closePath();
      ctx.roundRect(g.x, g.y, g.w, g.h, [90, 90, 20, 20]);
      ctx.fillStyle = body;
      ctx.fill("evenodd");
      ink(ctx, 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(g.x, g.y, g.w, g.h, [90, 90, 20, 20]);
      ink(ctx, 10);
      ctx.stroke();
      for (const [x1, x2] of [
        [g.x + 90, W / 2 - 40],
        [W / 2 + 20, g.x + g.w - 110],
      ]) {
        ln(ctx, x1, bottom + 14, x2, bottom - 8, 7);
      }
      // خط‌های کاپوت
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(W / 2 + k * 170, bottom + 40);
        ctx.quadraticCurveTo(W / 2 + k * 190, bottom + 110, W / 2 + k * 215, bottom + 160);
        ink(ctx, 3);
        ctx.stroke();
      }
      ln(ctx, 30, bottom + 170, W - 30, bottom + 170, 4);
      // چراغ‌ها و جلوپنجره
      for (const k of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(W / 2 + k * 370, bottom + 225, 100, 36, 0, 0, Math.PI * 2);
        shape(ctx, 5, e.night ? "#fff6cf" : PAPER);
        if (e.night) glow(ctx, W / 2 + k * 370, bottom + 225, 130, 0.45);
      }
      rr(ctx, W / 2 - 200, bottom + 196, 400, 58, 20, e.night ? "#9da2b3" : "#e3e3df");
      for (let i = 1; i < 6; i++) ln(ctx, W / 2 - 200 + i * 66, bottom + 202, W / 2 - 200 + i * 66, bottom + 248, 2.5);
    },
  },
  office: {
    id: "office",
    label: "اداره",
    aliases: ["اداره", "دفتر", "شرکت", "محل کار", "اتاق کار", "دفتر کار"],
    interior: true,
    seats: [0.32, 0.68],
    spots: [0.25, 0.75, 0.5],
    back: (ctx, e) => {
      floorLine(ctx, e, e.floor - 30);
      // پنجره با کرکره
      windowFrame(ctx, e, 380, 420, 320, 300, 13, false);
      for (let y = 440; y < 600; y += 22) ln(ctx, 384, y, 696, y, 2.2);
      // قفسه و گلدان
      rr(ctx, 60, 420, 220, 30, 4, e.fill);
      for (let i = 0; i < 5; i++) rr(ctx, 70 + i * 40, 330, 30, 90, 3, e.fill, 3);
      plant(ctx, e, 950, e.floor - 30, 1.1);
      wallClock(ctx, e, 900, 470);
      for (const x of [W * 0.32, W * 0.68]) {
        rr(ctx, x - 85, e.seatTop - 220, 170, 220, 30, e.fill);
        rr(ctx, x - 90, e.seatTop - 6, 180, 26, 10, e.fill);
      }
      if (e.night) glow(ctx, W / 2, 300, 380, 0.35);
    },
    front: (ctx, e) => {
      const top = e.seatTop - 50;
      rr(ctx, 70, top, 940, 30, 6, e.fill);
      rr(ctx, 90, top + 30, 900, e.floor - top - 30, 4, e.fill);
      ln(ctx, 540, top + 30, 540, e.floor, 3);
      // مانیتور و کاغذ
      rr(ctx, 160, top - 170, 210, 140, 10, e.night ? "#e8f0ff" : e.fill);
      ln(ctx, 265, top - 30, 265, top, 6);
      rr(ctx, 210, top - 8, 110, 10, 4, e.fill, 3);
      rr(ctx, 700, top - 14, 140, 16, 3, e.fill, 3);
      mug(ctx, e, 900, top);
    },
  },
  cafe: {
    id: "cafe",
    label: "کافه",
    aliases: ["کافه", "کافی‌شاپ", "کافی شاپ", "رستوران", "قهوه‌خانه", "چایخانه"],
    interior: true,
    seats: [0.27, 0.73],
    spots: [0.3, 0.7, 0.5],
    back: (ctx, e) => {
      floorLine(ctx, e, e.floor - 30);
      // پیشخوان و قهوه‌ساز
      rr(ctx, 40, 760, 1000, 40, 6, e.fill);
      rr(ctx, 60, 800, 960, 200, 4, e.fill);
      rr(ctx, 740, 620, 170, 140, 12, e.fill);
      circ(ctx, 825, 690, 26, e.fill, 4);
      // تابلوی منو
      rr(ctx, 160, 420, 300, 250, 10, "#3a3a3a", 5);
      text(ctx, "منو", 310, 470, 48, "#f4f4f0");
      for (let i = 0; i < 4; i++) ln(ctx, 200, 520 + i * 36, 420, 520 + i * 36, 3);
      ctx.strokeStyle = "#f4f4f0";
      // چراغ‌های آویز
      for (const x of [300, 540, 780]) {
        ln(ctx, x, 0, x, 300, 3);
        ctx.beginPath();
        ctx.moveTo(x - 50, 360);
        ctx.lineTo(x + 50, 360);
        ctx.lineTo(x + 20, 300);
        ctx.lineTo(x - 20, 300);
        ctx.closePath();
        shape(ctx, 4, e.night ? "#fff8dc" : e.fill);
        if (e.night) glow(ctx, x, 380, 220, 0.45);
      }
      for (const x of [W * 0.27, W * 0.73]) chairBack(ctx, e, x);
    },
    front: (ctx, e) => {
      for (const x of [W * 0.27, W * 0.73]) chairFront(ctx, e, x);
      // میز گرد وسط
      const top = e.seatTop - 50;
      ctx.beginPath();
      ctx.ellipse(W / 2, top, 170, 26, 0, 0, Math.PI * 2);
      shape(ctx, 4.6, e.fill);
      ln(ctx, W / 2, top + 26, W / 2, e.floor - 10, 8);
      ctx.beginPath();
      ctx.ellipse(W / 2, e.floor - 6, 70, 12, 0, 0, Math.PI * 2);
      shape(ctx, 4, e.fill);
      mug(ctx, e, W / 2 - 50, top - 4);
      mug(ctx, e, W / 2 + 60, top - 4);
    },
  },
  classroom: {
    id: "classroom",
    label: "کلاس",
    aliases: ["کلاس", "مدرسه", "دانشگاه", "کلاس درس", "سر کلاس"],
    interior: true,
    seats: [0.3, 0.7],
    spots: [0.3, 0.7, 0.5],
    back: (ctx, e) => {
      floorLine(ctx, e, e.floor - 30);
      rr(ctx, 120, 380, 840, 420, 10, "#3a3d3a", 6);
      text(ctx, "درس امروز", 540, 450, 54, "#f4f4f0");
      ctx.strokeStyle = "#f4f4f0";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(220, 560);
      ctx.lineTo(420, 560);
      ctx.moveTo(220, 620);
      ctx.lineTo(560, 620);
      ctx.moveTo(620, 560);
      ctx.quadraticCurveTo(700, 500, 780, 620);
      ctx.stroke();
      rr(ctx, 100, 800, 880, 20, 4, e.fill);
      wallClock(ctx, e, 1010, 300);
      for (const x of [W * 0.3, W * 0.7]) chairBack(ctx, e, x);
    },
    front: (ctx, e) => {
      for (const x of [W * 0.3, W * 0.7]) {
        chairFront(ctx, e, x);
        tableFront(ctx, e, x, 260, e.seatTop - 46);
        rr(ctx, x - 60, e.seatTop - 60, 120, 14, 3, e.fill, 3);
      }
    },
  },
  blank: {
    id: "blank",
    label: "زمینهٔ ساده",
    aliases: [],
    interior: false,
    seats: [],
    spots: [0.3, 0.7, 0.5],
    back: (ctx, e) => {
      ln(ctx, 60, e.floor + 4, e.w - 60, e.floor + 4, 3);
    },
  },
};

export const PLACE_IDS = Object.keys(PLACES) as PlaceId[];

/** حالت شب روی کاغذ: کاغذ تیره‌تر. */
export function nightPaper(ctx: Ctx, w: number, h: number) {
  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = "#8d92a6";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export { PAPER };
