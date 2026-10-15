/**
 * چهرهٔ پارامتری: هر حالت چهره مجموعه‌ای از عددهاست (زاویهٔ ابرو، باز بودن چشم، انحنای دهان، ...).
 * چون همه عدد است، رفتن از یک حالت به حالت دیگر نرم و تدریجی انجام می‌شود (نه پرش ناگهانی).
 * مختصات: مرکز سر = (۰،۰)، شعاع سر ≈ ۴۴.
 */
import { INK, PAPER, type Ctx } from "./figure-base.ts";

export type FaceParams = {
  /** ارتفاع ابرو (منفی = بالاتر). */
  browY: number;
  /** کج بودن ابرو: مثبت = سمت داخل پایین (اخم)، منفی = سمت داخل بالا (غم/نگرانی). */
  browTilt: number;
  /** بالا رفتن فقط ابروی راست (شک، پوزخند). */
  browOne: number;
  /** باز بودن چشم (۱ = عادی، بیشتر = گشاد). */
  eyeOpen: number;
  /** پلک افتاده از بالا (۰ تا ۱). */
  lid: number;
  /** چشم خندان ^ ^ (۰ تا ۱). */
  happy: number;
  /** انحنای دهان: ۱ = لبخند کامل، -۱ = اخم کامل. */
  curve: number;
  /** باز بودن دهان (۰ تا ۱). */
  open: number;
  /** پهنای دهان (۱ = عادی). */
  width: number;
  /** کج بودن دهان (پوزخند). */
  skew: number;
  /** دهان غنچه / گرد (۰ تا ۱). */
  round: number;
  /** لپ گلی. */
  blush: number;
  /** لپ باد کرده (قهر). */
  puff: number;
  /** اشک. */
  tears: number;
  /** قطرهٔ عرق (نگرانی/خجالت). */
  sweat: number;
};

export type Expression =
  | "neutral"
  | "smile"
  | "laugh"
  | "grin"
  | "smirk"
  | "angry"
  | "furious"
  | "pout"
  | "sad"
  | "cry"
  | "surprised"
  | "shocked"
  | "worried"
  | "scared"
  | "content"
  | "kiss"
  | "sideEye"
  | "annoyed"
  | "embarrassed"
  | "thinking"
  | "sleepy";

const N: FaceParams = {
  browY: 0,
  browTilt: 0,
  browOne: 0,
  eyeOpen: 1,
  lid: 0,
  happy: 0,
  curve: 0,
  open: 0,
  width: 1,
  skew: 0,
  round: 0,
  blush: 0,
  puff: 0,
  tears: 0,
  sweat: 0,
};

export const FACES: Record<Expression, FaceParams> = {
  neutral: N,
  smile: { ...N, curve: 0.75, width: 1.1, blush: 0.25 },
  laugh: { ...N, happy: 1, curve: 1, open: 0.95, width: 1.35, blush: 0.5, browY: -3 },
  grin: { ...N, curve: 0.9, open: 0.45, width: 1.4, browY: -2 },
  smirk: { ...N, lid: 0.4, curve: 0.35, skew: 0.8, browOne: 1, width: 0.9 },
  angry: { ...N, browTilt: 1, lid: 0.3, curve: -0.6, width: 0.9 },
  furious: { ...N, browTilt: 1.3, eyeOpen: 1.1, curve: -0.8, open: 0.55, width: 1.25, browY: 2 },
  pout: { ...N, browTilt: 0.8, lid: 0.35, round: 0.8, puff: 1, width: 0.6 },
  sad: { ...N, browTilt: -1, curve: -0.7, eyeOpen: 0.9, width: 0.9 },
  cry: { ...N, browTilt: -1.2, happy: 0.85, curve: -1, open: 0.5, tears: 1, width: 1.1 },
  surprised: { ...N, browY: -7, eyeOpen: 1.35, round: 0.7, open: 0.4, width: 0.6 },
  shocked: { ...N, browY: -9, eyeOpen: 1.5, open: 1, round: 0.4, width: 0.9, sweat: 0.6 },
  worried: { ...N, browTilt: -0.9, curve: -0.25, width: 0.85, sweat: 1 },
  scared: { ...N, browTilt: -1.1, browY: -5, eyeOpen: 1.3, open: 0.35, curve: -0.5, width: 1.2, sweat: 1 },
  content: { ...N, happy: 1, curve: 0.55, blush: 0.35 },
  kiss: { ...N, round: 1, width: 0.45, blush: 0.6, lid: 0.15 },
  sideEye: { ...N, lid: 0.3, browOne: 1, curve: -0.15, width: 0.8 },
  annoyed: { ...N, lid: 0.55, browTilt: 0.3, curve: -0.2 },
  embarrassed: { ...N, browTilt: -0.6, curve: 0.3, width: 0.8, blush: 1, sweat: 0.8 },
  thinking: { ...N, browOne: 0.8, lid: 0.15, skew: -0.5, curve: -0.1, width: 0.7 },
  sleepy: { ...N, lid: 0.75, curve: 0, width: 0.7, browY: 2 },
};

export function mixFace(a: FaceParams, b: FaceParams, t: number): FaceParams {
  const o = {} as FaceParams;
  for (const k of Object.keys(a) as (keyof FaceParams)[]) o[k] = a[k] + (b[k] - a[k]) * t;
  return o;
}

function stroke(ctx: Ctx, w: number) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.stroke();
}

/**
 * کشیدن چهره. `look` جهت نگاه (-۱ تا ۱)، `blink` پلک زدن (۰ تا ۱)، `talk` باز و بسته شدن دهان هنگام حرف،
 * `lashes` مژه (زن)، `time` برای حرکت اشک.
 */
export function drawFaceParams(
  ctx: Ctx,
  f: FaceParams,
  opts: { look: number; blink: number; talk: number; lashes: boolean; time: number },
) {
  const gap = 15;
  const ey = -4;
  const open = Math.max(0, f.eyeOpen * (1 - opts.blink) * (1 - f.happy));

  // لپ گلی
  if (f.blush > 0.02) {
    ctx.fillStyle = `rgba(150,150,150,${0.35 * Math.min(1, f.blush)})`;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 25, 12, 8, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // خط‌های ریز لپ (سبک کمیک)
      if (f.blush > 0.6) {
        for (const d of [-3, 2]) {
          ctx.beginPath();
          ctx.moveTo(s * 25 + d - 2, 14);
          ctx.lineTo(s * 25 + d + 2, 9);
          stroke(ctx, 1.8);
        }
      }
    }
  }

  // چشم‌ها
  for (const s of [-1, 1]) {
    const x = s * gap;
    const rx = 8 + (f.eyeOpen - 1) * 3;
    const ry = 9.5 * open;
    if (ry > 1.4) {
      ctx.beginPath();
      ctx.ellipse(x, ey, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = PAPER;
      ctx.fill();
      stroke(ctx, 3.2);
      const pr = Math.min(rx, ry) * (f.eyeOpen > 1.25 ? 0.42 : 0.55);
      ctx.beginPath();
      ctx.arc(x + opts.look * (rx - pr - 1), ey + 1, pr, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      if (f.lid > 0.03) {
        const ly = ey - ry + ry * 2 * f.lid;
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(x, ey, rx + 0.6, ry + 0.6, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = PAPER;
        ctx.fillRect(x - rx - 2, ey - ry - 2, rx * 2 + 4, ly - (ey - ry) + 2);
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(x - rx, ly);
        ctx.lineTo(x + rx, ly);
        stroke(ctx, 3.4);
      }
    } else if (f.happy < 0.5) {
      // پلک بسته (پلک زدن)
      ctx.beginPath();
      ctx.moveTo(x - 8, ey);
      ctx.quadraticCurveTo(x, ey + 5, x + 8, ey);
      stroke(ctx, 3.6);
    }
    if (f.happy > 0.02) {
      // چشم خندان (برای گریه، رو به پایین)
      ctx.globalAlpha = Math.min(1, f.happy * 1.4);
      ctx.beginPath();
      if (f.tears > 0.5) {
        ctx.arc(x, ey - 4, 8, Math.PI * 0.15, Math.PI * 0.85);
      } else {
        ctx.arc(x, ey + 4, 8, Math.PI * 1.1, Math.PI * 1.9);
      }
      stroke(ctx, 4);
      ctx.globalAlpha = 1;
    }
    if (opts.lashes && ry > 2) {
      for (const k of [0, 1]) {
        const ax = x + s * (rx - 1 - k * 5);
        const ay = ey - ry + 1 + k * 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + s * 5, ay - 6 + k * 2);
        stroke(ctx, 2.6);
      }
    }
  }

  // ابروها
  for (const s of [-1, 1]) {
    const one = s > 0 ? f.browOne : 0;
    const by = ey - 16 + f.browY - one * 6;
    const inner = s * (gap - 8);
    const outer = s * (gap + 9);
    const yi = by + f.browTilt * 6;
    const yo = by - f.browTilt * 4 - one * 2;
    ctx.beginPath();
    ctx.moveTo(inner, yi);
    ctx.quadraticCurveTo((inner + outer) / 2, Math.min(yi, yo) - 2.5, outer, yo);
    stroke(ctx, 4);
  }

  // لپ باد کرده
  if (f.puff > 0.05) {
    ctx.globalAlpha = Math.min(1, f.puff);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * 21, 19, 9, s > 0 ? -Math.PI * 0.55 : Math.PI * 0.45, s > 0 ? Math.PI * 0.55 : Math.PI * 1.55);
      stroke(ctx, 3);
    }
    ctx.globalAlpha = 1;
  }

  // دهان: ترکیب «حرف زدن» و حالت
  const my = 21;
  const talkOpen = opts.talk;
  const o = Math.min(1.1, f.open + talkOpen * 0.75);
  const w = 11 * f.width * (1 - f.round * 0.45) + talkOpen * 1.5;
  const lift = -f.curve * 6;
  const skew = f.skew * 4;
  if (f.round > 0.55 && o < 0.5) {
    // دهان غنچه یا «o»
    ctx.beginPath();
    ctx.ellipse(0, my + 1, 5 + o * 4, 4.5 + o * 7, 0, 0, Math.PI * 2);
    ctx.fillStyle = o > 0.25 ? "#2b2b2b" : PAPER;
    ctx.fill();
    stroke(ctx, 3.4);
    return drawExtras(ctx, f, opts.time);
  }
  const lx = -w;
  const rx = w;
  const ly = my + lift + skew;
  const ry = my + lift - skew;
  if (o < 0.08) {
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.quadraticCurveTo(0, my + f.curve * 9, rx, ry);
    stroke(ctx, 4);
  } else {
    // دهان باز: لب بالا کمی منحنی، لب پایین با عمق `o`
    const upper = my + f.curve * 3;
    const lower = my + f.curve * 6 + o * 18;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.quadraticCurveTo(0, upper, rx, ry);
    ctx.quadraticCurveTo(0, lower + 6, lx, ly);
    ctx.closePath();
    ctx.fillStyle = "#2b2b2b";
    ctx.fill();
    // دندان‌های بالا و زبان
    ctx.save();
    ctx.clip();
    if (f.curve > 0.3) {
      ctx.fillStyle = PAPER;
      ctx.fillRect(lx, Math.min(ly, ry) - 4, w * 2, 6 + o * 2);
    }
    if (o > 0.4) {
      ctx.fillStyle = "#8f8f8f";
      ctx.beginPath();
      ctx.ellipse(0, lower + 2, w * 0.55, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.quadraticCurveTo(0, upper, rx, ry);
    ctx.quadraticCurveTo(0, lower + 6, lx, ly);
    ctx.closePath();
    stroke(ctx, 3.6);
  }
  drawExtras(ctx, f, opts.time);
}

function drawExtras(ctx: Ctx, f: FaceParams, time: number) {
  // اشک: قطره‌هایی که از گوشهٔ چشم پایین می‌آیند
  if (f.tears > 0.05) {
    ctx.globalAlpha = Math.min(1, f.tears);
    for (const s of [-1, 1]) {
      const ph = (time * 0.9 + (s > 0 ? 0.5 : 0)) % 1;
      const x = s * 22;
      const y = 4 + ph * 34;
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.quadraticCurveTo(x + 5, y + 2, x, y + 4);
      ctx.quadraticCurveTo(x - 5, y + 2, x, y - 7);
      ctx.fillStyle = PAPER;
      ctx.fill();
      stroke(ctx, 2.4);
    }
    ctx.globalAlpha = 1;
  }
  // قطرهٔ عرق کنار پیشانی
  if (f.sweat > 0.05) {
    ctx.globalAlpha = Math.min(1, f.sweat);
    const x = 36;
    const y = -26 + Math.sin(time * 2) * 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.quadraticCurveTo(x + 6, y + 2, x, y + 5);
    ctx.quadraticCurveTo(x - 6, y + 2, x, y - 9);
    ctx.fillStyle = PAPER;
    ctx.fill();
    stroke(ctx, 2.6);
    ctx.globalAlpha = 1;
  }
}
