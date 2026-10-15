import { clearGrip, drawExtraHold } from "./holds.ts";
/**
 * آدمک خطی سیاه‌وسفید (سبک ویدیوهای روایی اینستاگرام): سر گرد بزرگ، بدن خطی، دست و پای خطی.
 * همه‌چیز با زاویه‌های مفصل تعریف می‌شود تا بین دو ژست به نرمی درون‌یابی شود.
 * واحدها «واحد بدن» است؛ مبدأ لگن (وسط باسن) و محور y رو به پایین.
 */
import { drawInk, limbPoints } from "./ink.ts";
import { drawFaceParams, FACES, type Expression, type FaceParams } from "./face.ts";
import { INK, PAPER, type Ctx } from "./figure-base.ts";

export { INK, PAPER, type Ctx };
export type { Expression, FaceParams };

/** اندازه‌های بدن (واحد بدن). */
export const BODY = {
  headR: 44,
  neck: 12,
  torso: 96,
  upper: 46,
  fore: 44,
  thigh: 58,
  shin: 56,
  shoulderDrop: 16,
  line: 4.6,
};

/** زاویهٔ یک دست یا پا: a = زاویهٔ بخش بالا از «رو به پایین» (مثبت = به بیرونِ بدن)، b = خم مفصل نسبت به بخش بالا. */
export type Limb = { a: number; b: number };

export type Pose = {
  /** جابه‌جایی لگن نسبت به نقطهٔ جای شخصیت (واحد بدن). */
  px: number;
  py: number;
  /** خم بالاتنه و سر (درجه، مثبت = ساعت‌گرد). */
  lean: number;
  tilt: number;
  armL: Limb;
  armR: Limb;
  legL: Limb;
  legR: Limb;
  /** کوتاه‌شدن ران (۱ = ایستاده، حدود ۰٫۴۵ = نشسته رو به دوربین). */
  thigh: number;
  /** جهت نگاه مردمک‌ها (-۱ چپ تا ۱ راست). */
  look: number;
};

export type Kind = "man" | "woman" | "boy" | "girl" | "oldMan" | "oldWoman" | "baby";

export type Hair = "tufts" | "short" | "bald" | "curly" | "long" | "bob" | "ponytail" | "scarf";

export const CLOTHES = ["classic", "tshirt", "shirt", "coat", "dress", "chador"] as const;
export type Clothing = typeof CLOTHES[number];
export type Look = {
  clothing?: Clothing;
  kind: Kind;
  hair?: Hair;
  glasses?: boolean;
  mustache?: boolean;
  beard?: boolean;
  cap?: boolean;
};

export type Hold = "none" | "phone" | "cup" | "cookie" | "book" | "bag" | "ball" | "flowers" | "remote" | "plate" | "shopping" | "umbrella" | "laptop";

export type FigureState = {
  pose: Pose;
  face: FaceParams;
  /** ۰ = چشم باز، ۱ = پلک کاملاً بسته. */
  blink: number;
  /** باز بودن دهان هنگام حرف زدن (۰ تا ۱). */
  talk: number;
  holdL?: Hold;
  holdR?: Hold;
  /** زمان صحنه (برای اشک و عرق). */
  time?: number;
};

export function isFemale(k: Kind) {
  return k === "woman" || k === "girl" || k === "oldWoman";
}

export function isChild(k: Kind) {
  return k === "boy" || k === "girl" || k === "baby";
}

export function isOld(k: Kind) {
  return k === "oldMan" || k === "oldWoman";
}

/** اندازهٔ کلی هر نوع شخصیت نسبت به بزرگسال. */
export function kindScale(k: Kind) {
  return k === "baby" ? 0.48 : isChild(k) ? 0.7 : isOld(k) ? 0.96 : 1;
}

export function defaultHair(k: Kind): Hair {
  if (k === "woman") return "long";
  if (k === "girl") return "ponytail";
  if (k === "oldWoman") return "scarf";
  if (k === "oldMan") return "bald";
  if (k === "boy") return "short";
  return "tufts";
}

const rad = (d: number) => (d * Math.PI) / 180;

function stroke(ctx: Ctx, w = BODY.line) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

function fillStroke(ctx: Ctx, fill = PAPER, w = BODY.line) {
  ctx.fillStyle = fill;
  ctx.fill();
  stroke(ctx, w);
}

type P = { x: number; y: number };

/** نقطه‌های مفصل‌ها از روی ژست. */
export function joints(pose: Pose) {
  const pelvis = { x: pose.px, y: pose.py };
  const L = rad(pose.lean);
  const up = { x: Math.sin(L), y: -Math.cos(L) };
  const neck = { x: pelvis.x + up.x * BODY.torso, y: pelvis.y + up.y * BODY.torso };
  const shoulder = { x: neck.x - up.x * BODY.shoulderDrop, y: neck.y - up.y * BODY.shoulderDrop };
  const H = rad(pose.lean + pose.tilt);
  const headC = {
    x: neck.x + Math.sin(H) * (BODY.neck + BODY.headR),
    y: neck.y - Math.cos(H) * (BODY.neck + BODY.headR),
  };
  const limb = (from: P, l: Limb, side: number, len1: number, len2: number, k1 = 1) => {
    const a = rad(l.a);
    const ab = rad(l.a + l.b);
    const mid = { x: from.x + side * Math.sin(a) * len1 * k1, y: from.y + Math.cos(a) * len1 * k1 };
    const end = { x: mid.x + side * Math.sin(ab) * len2, y: mid.y + Math.cos(ab) * len2 };
    return { mid, end };
  };
  return {
    pelvis,
    neck,
    shoulder,
    headC,
    armL: limb(shoulder, pose.armL, -1, BODY.upper, BODY.fore),
    armR: limb(shoulder, pose.armR, 1, BODY.upper, BODY.fore),
    legL: limb({ x: pelvis.x - 9, y: pelvis.y }, pose.legL, -1, BODY.thigh, BODY.shin, pose.thigh),
    legR: limb({ x: pelvis.x + 9, y: pelvis.y }, pose.legR, 1, BODY.thigh, BODY.shin, pose.thigh),
  };
}

/** خط نرم از میان سه نقطه (مفصل گرد، نه زاویهٔ تیز). */
function limbPath(ctx: Ctx, a: P, m: P, b: P, w = BODY.line) {
  drawInk(ctx, limbPoints(a, m, b), w);
}

function foot(ctx: Ctx, at: P, side: number, kid: boolean) {
  ctx.beginPath();
  ctx.moveTo(at.x, at.y);
  ctx.quadraticCurveTo(at.x + side * 10, at.y + 3, at.x + side * (kid ? 14 : 17), at.y + 1);
  stroke(ctx, BODY.line + 0.6);
}

/* ---------- اشیای در دست ---------- */

function drawHold(ctx: Ctx, hold: Hold, at: P, side: number) {
  if (hold === "none") return;
  ctx.save();
  ctx.translate(at.x, at.y);
  drawExtraHold(ctx, hold);
  if (hold === "phone") {
    // صفحهٔ گوشی رو به صورت خود شخصیت است؛ بیننده پشت گوشی را می‌بیند (قاب تیره و دوربین)
    ctx.rotate(side * -0.12);
    ctx.beginPath();
    ctx.roundRect(-13, -34, 26, 48, 6);
    fillStroke(ctx, "#2b2b2b", 3.4);
    ctx.beginPath();
    ctx.roundRect(-8, -29, 11, 16, 3.5);
    ctx.fillStyle = "#4a4a4a";
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = "#777";
    ctx.stroke();
    ctx.fillStyle = "#0e0e0e";
    for (const cy of [-25, -17.5]) {
      ctx.beginPath();
      ctx.arc(-2.5, cy, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, -1, 3, 0, Math.PI * 2);
    ctx.fillStyle = "#555";
    ctx.fill();
  } else if (hold === "cup") {
    ctx.beginPath();
    ctx.moveTo(-14, -22);
    ctx.lineTo(14, -22);
    ctx.lineTo(11, 6);
    ctx.lineTo(-11, 6);
    ctx.closePath();
    fillStroke(ctx, PAPER, 3.6);
    ctx.beginPath();
    ctx.arc(side * 17, -10, 7, -Math.PI / 2, Math.PI / 2, side < 0);
    stroke(ctx, 3.4);
  } else if (hold === "cookie") {
    ctx.beginPath();
    ctx.arc(0, -8, 12, 0.3, Math.PI * 2 - 0.3);
    ctx.lineTo(4, -8);
    ctx.closePath();
    fillStroke(ctx, PAPER, 3.4);
    for (const [x, y] of [
      [-4, -13],
      [2, -3],
      [-5, -4],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
  } else if (hold === "book") {
    ctx.rotate(side * -0.15);
    ctx.beginPath();
    ctx.rect(-26, -30, 26, 36);
    ctx.rect(0, -30, 26, 36);
    fillStroke(ctx, PAPER, 3.4);
    for (const y of [-20, -12, -4]) {
      ctx.beginPath();
      ctx.moveTo(-20, y);
      ctx.lineTo(-6, y);
      ctx.moveTo(6, y);
      ctx.lineTo(20, y);
      stroke(ctx, 1.8);
    }
  } else if (hold === "bag") {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 10);
    stroke(ctx, 3);
    ctx.beginPath();
    ctx.roundRect(-22, 10, 44, 34, 6);
    fillStroke(ctx, PAPER, 3.6);
  } else if (hold === "ball") {
    ctx.beginPath();
    ctx.arc(side * 4, -12, 16, 0, Math.PI * 2);
    fillStroke(ctx, PAPER, 3.4);
    ctx.beginPath();
    ctx.moveTo(side * 4 - 6, -18);
    ctx.lineTo(side * 4 + 5, -18);
    ctx.lineTo(side * 4 + 8, -8);
    ctx.lineTo(side * 4, -2);
    ctx.lineTo(side * 4 - 8, -8);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
  } else if (hold === "flowers") {
    for (let i = 0; i < 3; i++) {
      const fx = (i - 1) * 10;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.lineTo(fx, -26);
      stroke(ctx, 2.6);
      ctx.beginPath();
      ctx.arc(fx, -30, 7, 0, Math.PI * 2);
      fillStroke(ctx, PAPER, 2.8);
    }
  }
  ctx.restore();
}

/* ---------- مو و لوازم سر ---------- */

function hairBackLong(ctx: Ctx, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 1.02, -r * 0.1);
  ctx.bezierCurveTo(-r * 1.25, -r * 1.45, r * 1.25, -r * 1.45, r * 1.02, -r * 0.1);
  ctx.bezierCurveTo(r * 1.12, r * 0.55, r * 1.2, r * 0.95, r * 1.36, r * 1.18);
  ctx.bezierCurveTo(r * 1.1, r * 1.32, r * 0.86, r * 1.05, r * 0.78, r * 0.8);
  ctx.lineTo(-r * 0.78, r * 0.8);
  ctx.bezierCurveTo(-r * 0.86, r * 1.05, -r * 1.1, r * 1.32, -r * 1.36, r * 1.18);
  ctx.bezierCurveTo(-r * 1.2, r * 0.95, -r * 1.12, r * 0.55, -r * 1.02, -r * 0.1);
  fillStroke(ctx);
}

function hairBackBob(ctx: Ctx, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 1.04, -r * 0.1);
  ctx.bezierCurveTo(-r * 1.25, -r * 1.42, r * 1.25, -r * 1.42, r * 1.04, -r * 0.1);
  ctx.quadraticCurveTo(r * 1.15, r * 0.55, r * 0.9, r * 0.62);
  ctx.lineTo(-r * 0.9, r * 0.62);
  ctx.quadraticCurveTo(-r * 1.15, r * 0.55, -r * 1.04, -r * 0.1);
  fillStroke(ctx);
}

function ponytail(ctx: Ctx, r: number, t: number) {
  const sw = Math.sin(t * 3) * 0.08;
  ctx.beginPath();
  ctx.moveTo(r * 0.75, -r * 0.7);
  ctx.bezierCurveTo(r * (1.55 + sw), -r * 0.9, r * (1.6 + sw), r * 0.1, r * (1.25 + sw), r * 0.55);
  ctx.bezierCurveTo(r * (1.3 + sw), r * 0.05, r * 1.15, -r * 0.4, r * 0.85, -r * 0.45);
  ctx.closePath();
  fillStroke(ctx);
  ctx.beginPath();
  ctx.ellipse(r * 0.82, -r * 0.6, 5, 8, 0.6, 0, Math.PI * 2);
  fillStroke(ctx, INK, 2);
}

/** چتری کج روی پیشانی. */
function bangs(ctx: Ctx, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 1.0, -r * 0.12);
  ctx.arc(0, -r * 0.04, r * 1.04, Math.PI * 1.05, Math.PI * 1.95);
  ctx.lineTo(r * 1.0, -r * 0.12);
  ctx.quadraticCurveTo(r * 0.82, -r * 0.62, r * 0.5, -r * 0.3);
  ctx.quadraticCurveTo(r * 0.36, -r * 0.66, r * 0.02, -r * 0.36);
  ctx.quadraticCurveTo(-r * 0.2, -r * 0.7, -r * 0.5, -r * 0.33);
  ctx.quadraticCurveTo(-r * 0.68, -r * 0.62, -r * 1.0, -r * 0.12);
  fillStroke(ctx);
}

/** روسری: دور صورت، گره زیر چانه و دو گوشه که پایین می‌افتند. */
function scarf(ctx: Ctx, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, r * 0.78);
  ctx.bezierCurveTo(-r * 1.55, r * 0.5, -r * 1.35, -r * 1.5, 0, -r * 1.32);
  ctx.bezierCurveTo(r * 1.35, -r * 1.5, r * 1.55, r * 0.5, r * 0.62, r * 0.78);
  ctx.lineTo(r * 0.3, r * 1.25);
  ctx.lineTo(-r * 0.3, r * 1.25);
  ctx.closePath();
  fillStroke(ctx);
  // دو گوشهٔ روسری
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * r * 0.15, r * 1.1);
    ctx.lineTo(s * r * 0.55, r * 1.75);
    ctx.lineTo(s * r * 0.05, r * 1.6);
    ctx.closePath();
    fillStroke(ctx);
  }
}

/** لبهٔ روسری روی پیشانی (بعد از کشیدن صورت). */
function scarfFront(ctx: Ctx, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 0.98, -r * 0.05);
  ctx.bezierCurveTo(-r * 0.95, -r * 1.1, r * 0.95, -r * 1.1, r * 0.98, -r * 0.05);
  ctx.bezierCurveTo(r * 0.75, -r * 0.62, -r * 0.75, -r * 0.62, -r * 0.98, -r * 0.05);
  fillStroke(ctx);
}

function tufts(ctx: Ctx, r: number, n: number) {
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.22;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x * 1.05 + 4, y * 1.18, x * 1.1 + (i - 1) * 3, y * 1.32);
    stroke(ctx, 3.4);
  }
}

function shortHair(ctx: Ctx, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 1.0, -r * 0.2);
  ctx.arc(0, -r * 0.05, r * 1.06, Math.PI * 1.08, Math.PI * 1.92);
  ctx.lineTo(r * 1.0, -r * 0.2);
  ctx.lineTo(r * 0.82, -r * 0.42);
  ctx.lineTo(r * 0.6, -r * 0.55);
  ctx.lineTo(r * 0.35, -r * 0.48);
  ctx.lineTo(r * 0.1, -r * 0.6);
  ctx.lineTo(-r * 0.2, -r * 0.5);
  ctx.lineTo(-r * 0.5, -r * 0.62);
  ctx.lineTo(-r * 0.78, -r * 0.45);
  ctx.closePath();
  fillStroke(ctx);
}

function curly(ctx: Ctx, r: number) {
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (1.02 + (i / 8) * 0.96);
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98, r * 0.24, 0, Math.PI * 2);
    fillStroke(ctx, PAPER, 3.4);
  }
}

function sideHair(ctx: Ctx, r: number) {
  // موی دو طرف سر برای پیرمرد کچل
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * r * 0.98, -r * 0.35);
    ctx.quadraticCurveTo(s * r * 1.22, -r * 0.1, s * r * 1.0, r * 0.25);
    ctx.quadraticCurveTo(s * r * 1.1, -r * 0.05, s * r * 0.98, -r * 0.35);
    fillStroke(ctx, PAPER, 3);
  }
}

function capOn(ctx: Ctx, r: number) {
  ctx.beginPath();
  ctx.moveTo(-r * 1.0, -r * 0.3);
  ctx.bezierCurveTo(-r * 1.0, -r * 1.35, r * 1.0, -r * 1.35, r * 1.0, -r * 0.3);
  ctx.closePath();
  fillStroke(ctx);
  ctx.beginPath();
  ctx.moveTo(r * 0.2, -r * 0.32);
  ctx.quadraticCurveTo(r * 1.1, -r * 0.42, r * 1.55, -r * 0.2);
  ctx.quadraticCurveTo(r * 1.0, -r * 0.15, r * 0.2, -r * 0.2);
  ctx.closePath();
  fillStroke(ctx);
  ctx.beginPath();
  ctx.arc(0, -r * 1.07, 4, 0, Math.PI * 2);
  fillStroke(ctx, INK, 2);
}

function glasses(ctx: Ctx) {
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * 15, -4, 12, 0, Math.PI * 2);
    stroke(ctx, 3);
  }
  ctx.beginPath();
  ctx.moveTo(-3, -6);
  ctx.quadraticCurveTo(0, -9, 3, -6);
  stroke(ctx, 3);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 27, -6);
    ctx.lineTo(s * 40, -10);
    stroke(ctx, 3);
  }
}

function mustache(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.quadraticCurveTo(-12, 7, -20, 16);
  ctx.quadraticCurveTo(-10, 14, 0, 16);
  ctx.quadraticCurveTo(10, 14, 20, 16);
  ctx.quadraticCurveTo(12, 7, 0, 12);
  fillStroke(ctx, INK, 2.4);
}

function beard(ctx: Ctx, r: number) {
  // ریش کوتاه دور چانه، زیر دهان
  ctx.beginPath();
  ctx.moveTo(-r * 0.86, r * 0.36);
  ctx.quadraticCurveTo(-r * 0.78, r * 1.18, 0, r * 1.22);
  ctx.quadraticCurveTo(r * 0.78, r * 1.18, r * 0.86, r * 0.36);
  ctx.quadraticCurveTo(r * 0.6, r * 0.82, r * 0.25, r * 0.8);
  ctx.quadraticCurveTo(0, r * 0.9, -r * 0.25, r * 0.8);
  ctx.quadraticCurveTo(-r * 0.6, r * 0.82, -r * 0.86, r * 0.36);
  fillStroke(ctx);
  for (const [x, y] of [
    [-0.45, 0.92],
    [0.42, 0.95],
    [0, 1.06],
  ]) {
    ctx.beginPath();
    ctx.moveTo(r * x - 3, r * y - 3);
    ctx.lineTo(r * x + 3, r * y + 3);
    stroke(ctx, 2);
  }
}

function wrinkles(ctx: Ctx, r: number) {
  for (const y of [-0.62, -0.5]) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.32, r * y);
    ctx.quadraticCurveTo(0, r * (y - 0.06), r * 0.32, r * y);
    stroke(ctx, 2);
  }
}

/* ---------- کل بدن ---------- */

/**
 * کشیدن آدمک. (x, y) جای لگن در صحنه است و `scale` اندازه (اندازهٔ بچه‌ها خودکار کوچک‌تر می‌شود).
 * ترتیب لایه‌ها: پا، پیراهن/بدن، مو پشت، سر، چهره، مو جلو، دست‌ها و اشیای دست.
 */
export function drawFigure(ctx: Ctx, look: Look, st: FigureState, x: number, y: number, scale: number) {
  let pose = st.pose;
  const original = joints(pose);
  for (const [key, side, hold] of [["armL", -1, st.holdL ?? "none"], ["armR", 1, st.holdR ?? "none"]] as const) {
    const adjusted = clearGrip(hold, original[key].end, original.headC, original.shoulder, side);
    if (adjusted) pose = { ...pose, [key]: adjusted };
  }
  const j = joints(pose);
  const kid = isChild(look.kind);
  const female = isFemale(look.kind);
  const hair = look.clothing === "chador" ? "scarf" : look.hair ?? defaultHair(look.kind);
  const t = st.time ?? 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // پاها
  for (const [leg, side] of [
    [j.legL, -1],
    [j.legR, 1],
  ] as const) {
    const hip = { x: j.pelvis.x + side * (female ? 14 : 9), y: j.pelvis.y + (female ? 10 : 0) };
    limbPath(ctx, hip, leg.mid, leg.end);
    foot(ctx, leg.end, side, kid);
  }

  // بدن
  const L = rad(st.pose.lean);
  const down = { x: -Math.sin(L), y: Math.cos(L) };
  const across = { x: Math.cos(L), y: Math.sin(L) };
  if (look.clothing === "chador") {
    ctx.beginPath();
    ctx.moveTo(j.headC.x - 37, j.headC.y + 12);
    ctx.quadraticCurveTo(j.pelvis.x - 72, j.pelvis.y - 40, j.legL.mid.x - 20, j.legL.mid.y + 18);
    ctx.quadraticCurveTo(j.pelvis.x, j.legL.mid.y + 34, j.legR.mid.x + 20, j.legR.mid.y + 18);
    ctx.quadraticCurveTo(j.pelvis.x + 72, j.pelvis.y - 40, j.headC.x + 37, j.headC.y + 12);
    ctx.closePath();
    fillStroke(ctx, "#333");
  } else if (look.clothing === "dress" || (female && (!look.clothing || look.clothing === "classic"))) {
    // پیراهن مثلثی از سرشانه تا زیر لگن
    const top = { x: j.shoulder.x - down.x * 8, y: j.shoulder.y - down.y * 8 };
    const sitting = st.pose.thigh < 0.7;
    ctx.beginPath();
    ctx.moveTo(top.x - across.x * 11, top.y - across.y * 11);
    ctx.lineTo(top.x + across.x * 11, top.y + across.y * 11);
    if (sitting) {
      // نشسته: دامن تا روی زانوها پهن می‌شود و فقط ساق‌ها از زیرش پیداست
      const kL = { x: j.legL.mid.x - 14, y: j.legL.mid.y + 10 };
      const kR = { x: j.legR.mid.x + 14, y: j.legR.mid.y + 10 };
      ctx.lineTo(j.pelvis.x + across.x * 30, j.pelvis.y + across.y * 30 - 4);
      ctx.lineTo(kR.x, kR.y);
      ctx.quadraticCurveTo(j.pelvis.x, Math.max(kL.y, kR.y) + 12, kL.x, kL.y);
      ctx.lineTo(j.pelvis.x - across.x * 30, j.pelvis.y - across.y * 30 - 4);
    } else {
      const hem = { x: j.pelvis.x + down.x * 42, y: j.pelvis.y + down.y * 42 };
      ctx.lineTo(hem.x + across.x * 56, hem.y + across.y * 56);
      ctx.lineTo(hem.x - across.x * 56, hem.y - across.y * 56);
    }
    ctx.closePath();
    fillStroke(ctx);
  } else {
    ctx.beginPath();
    ctx.moveTo(j.pelvis.x, j.pelvis.y);
    ctx.lineTo(j.neck.x, j.neck.y);
    stroke(ctx);
  }
  if (look.clothing && ["tshirt", "shirt", "coat"].includes(look.clothing)) {
    const coat = look.clothing === "coat";
    const bottom = j.pelvis.y + (coat ? 28 : 8);
    ctx.beginPath();
    ctx.moveTo(j.shoulder.x - 20, j.shoulder.y - 8);
    ctx.lineTo(j.shoulder.x + 20, j.shoulder.y - 8);
    ctx.lineTo(j.pelvis.x + 24, bottom);
    ctx.lineTo(j.pelvis.x - 24, bottom);
    ctx.closePath(); fillStroke(ctx, coat ? "#dedede" : PAPER);
    if (look.clothing !== "tshirt") {
      ctx.beginPath(); ctx.moveTo(j.shoulder.x, j.shoulder.y + 8); ctx.lineTo(j.pelvis.x, bottom); stroke(ctx, 2);
      for (let y = j.shoulder.y + 24; y < bottom; y += 18) {
        ctx.beginPath(); ctx.arc(j.pelvis.x + 5, y, 1.8, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
      }
    }
  }
  // گردن تا زیر سر
  {
    const H = rad(st.pose.lean + st.pose.tilt);
    ctx.beginPath();
    ctx.moveTo(j.neck.x, j.neck.y);
    ctx.lineTo(j.neck.x + Math.sin(H) * (BODY.neck + 4), j.neck.y - Math.cos(H) * (BODY.neck + 4));
    stroke(ctx);
  }

  // سر
  ctx.save();
  ctx.translate(j.headC.x, j.headC.y);
  ctx.rotate(rad(st.pose.lean + st.pose.tilt));
  const r = BODY.headR * (kid ? 1.08 : 1);
  if (hair === "long") hairBackLong(ctx, r);
  else if (hair === "bob") hairBackBob(ctx, r);
  else if (hair === "ponytail") ponytail(ctx, r, t);
  else if (hair === "scarf") scarf(ctx, r);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  fillStroke(ctx);
  if (look.beard) beard(ctx, r);
  if (isOld(look.kind)) wrinkles(ctx, r);
  drawFaceParams(ctx, st.face, { look: st.pose.look, blink: st.blink, talk: st.talk, lashes: female, time: t });
  if (look.mustache || look.kind === "oldMan") mustache(ctx);
  if (look.glasses || look.kind === "oldWoman") glasses(ctx);
  if (hair === "long" || hair === "bob" || hair === "ponytail") bangs(ctx, r);
  else if (hair === "scarf") scarfFront(ctx, r);
  else if (hair === "short") shortHair(ctx, r);
  else if (hair === "curly") curly(ctx, r);
  else if (hair === "tufts" && !look.cap) tufts(ctx, r, 3);
  if (look.kind === "oldMan" && hair === "bald") sideHair(ctx, r);
  if (look.cap) capOn(ctx, r);
  ctx.restore();

  // دست‌ها (زن: از گوشه‌های بالای پیراهن شروع می‌شوند تا روی پیراهن خط نیفتد)
  const sw = female ? 11 : 0;
  for (const [arm, side, hold] of [
    [j.armL, -1, st.holdL ?? "none"],
    [j.armR, 1, st.holdR ?? "none"],
  ] as const) {
    const o = { x: across.x * sw * side, y: across.y * sw * side };
    const sh = { x: j.shoulder.x + o.x, y: j.shoulder.y + o.y };
    const end = { x: arm.end.x + o.x, y: arm.end.y + o.y };
    limbPath(ctx, sh, { x: arm.mid.x + o.x, y: arm.mid.y + o.y }, end);
    drawHold(ctx, hold, end, side);
    if (hold !== "none") {
      ctx.beginPath(); ctx.arc(end.x, end.y, 3.6, 0, Math.PI * 2); fillStroke(ctx, PAPER, 1.8);
    }
  }

  ctx.restore();
}

/** حالت چهره از روی اسم. */
export function faceOf(e: Expression): FaceParams {
  return FACES[e];
}

/* ---------- درون‌یابی ژست ---------- */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpLimb = (a: Limb, b: Limb, t: number): Limb => ({ a: lerp(a.a, b.a, t), b: lerp(a.b, b.b, t) });

export function mixPose(a: Pose, b: Pose, t: number): Pose {
  return {
    px: lerp(a.px, b.px, t),
    py: lerp(a.py, b.py, t),
    lean: lerp(a.lean, b.lean, t),
    tilt: lerp(a.tilt, b.tilt, t),
    armL: lerpLimb(a.armL, b.armL, t),
    armR: lerpLimb(a.armR, b.armR, t),
    legL: lerpLimb(a.legL, b.legL, t),
    legR: lerpLimb(a.legR, b.legR, t),
    thigh: lerp(a.thigh, b.thigh, t),
    look: lerp(a.look, b.look, t),
  };
}

/** نرمی شروع و پایان حرکت. */
export function ease(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
}

/**
 * نرمی با «پیش‌حرکت و جاافتادن» (anticipation + overshoot): کمی عقب، بعد کمی جلوتر از هدف و برگشت.
 * همان اصلی که در انیمیشن دستی حرکت را زنده نشان می‌دهد.
 */
export function easeLively(t: number, amount = 1): number {
  const u = Math.min(1, Math.max(0, t));
  const c1 = 1.4 * amount;
  const c3 = c1 + 1;
  // easeInOutBack
  return u < 0.5
    ? (Math.pow(2 * u, 2) * ((c3 * 1.2 + 1) * 2 * u - c3 * 1.2)) / 2
    : (Math.pow(2 * u - 2, 2) * ((c3 * 1.2 + 1) * (u * 2 - 2) + c3 * 1.2) + 2) / 2;
}
