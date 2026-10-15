/**
 * آدمک خطی سیاه‌وسفید (سبک ویدیوهای روایی اینستاگرام): سر گرد بزرگ، بدن خطی، دست و پای خطی.
 * همه‌چیز با زاویه‌های مفصل تعریف می‌شود تا بین دو ژست به نرمی درون‌یابی شود.
 * واحدها «واحد بدن» است؛ مبدأ لگن (وسط باسن) و محور y رو به پایین.
 */
export type Ctx = CanvasRenderingContext2D;

export const INK = "#141414";
export const PAPER = "#ffffff";

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

export type Expression =
  | "neutral"
  | "smile"
  | "laugh"
  | "grin"
  | "smirk"
  | "angry"
  | "pout"
  | "sad"
  | "surprised"
  | "worried"
  | "content"
  | "kiss"
  | "sideEye"
  | "annoyed";

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
  /** کوتاه‌شدن ران (۱ = ایستاده، حدود ۰٫۳ = نشسته رو به دوربین). */
  thigh: number;
  /** جهت نگاه مردمک‌ها (-۱ چپ تا ۱ راست). */
  look: number;
};

export type Look = {
  kind: "man" | "woman";
  /** دستهٔ مو برای مرد (۰ = کچل). */
  tufts?: number;
};

export type Hold = "none" | "phone" | "cup" | "cookie";

export type FigureState = {
  pose: Pose;
  face: Expression;
  /** ۰ = چشم باز، ۱ = پلک کاملاً بسته. */
  blink: number;
  /** باز بودن دهان هنگام حرف زدن (۰ تا ۱). */
  talk: number;
  holdL?: Hold;
  holdR?: Hold;
};

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

function polyline(ctx: Ctx, pts: P[], w = BODY.line) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
  stroke(ctx, w);
}

function foot(ctx: Ctx, at: P, side: number) {
  ctx.beginPath();
  ctx.moveTo(at.x, at.y);
  ctx.quadraticCurveTo(at.x + side * 10, at.y + 3, at.x + side * 17, at.y + 1);
  stroke(ctx, BODY.line + 0.6);
}

/* ---------- اشیای در دست ---------- */

function drawHold(ctx: Ctx, hold: Hold, at: P, side: number) {
  if (hold === "none") return;
  ctx.save();
  ctx.translate(at.x, at.y);
  if (hold === "phone") {
    ctx.rotate(side * -0.25);
    ctx.beginPath();
    ctx.roundRect(-11, -30, 24, 42, 5);
    fillStroke(ctx, "#2a2a2a", 3.4);
    ctx.beginPath();
    ctx.roundRect(-7, -26, 16, 32, 3);
    ctx.fillStyle = "#e9e9e9";
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
    for (const [x, y] of [[-4, -13], [2, -3], [-5, -4]]) {
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
    }
  }
  ctx.restore();
}

/* ---------- چهره ---------- */

function dot(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = INK;
  ctx.fill();
}

function arc(ctx: Ctx, x: number, y: number, r: number, a0: number, a1: number, w = 3.8, ccw = false) {
  ctx.beginPath();
  ctx.arc(x, y, r, a0, a1, ccw);
  stroke(ctx, w);
}

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w = 3.8) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  stroke(ctx, w);
}

/** چشم: باز (سفید با مردمک)، یا بسته. برای زن مژه هم دارد. */
function eye(
  ctx: Ctx,
  x: number,
  y: number,
  opts: { open: number; look: number; big?: boolean; lash?: boolean; side: number; lid?: number },
) {
  const rx = opts.big ? 10 : 8;
  const ry = (opts.big ? 12 : 9.5) * Math.max(0.08, opts.open);
  if (opts.open < 0.15) {
    // پلک بسته
    ctx.beginPath();
    ctx.moveTo(x - rx, y);
    ctx.quadraticCurveTo(x, y + 5, x + rx, y);
    stroke(ctx, 3.6);
    return;
  }
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  fillStroke(ctx, PAPER, 3.2);
  const pr = Math.min(rx, ry) * 0.55;
  dot(ctx, x + opts.look * (rx - pr - 1), y + 1, pr);
  if (opts.lid) {
    // پلک نیمه‌افتاده (بی‌حوصله/پوزخند)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x, y, rx + 0.5, ry + 0.5, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = PAPER;
    ctx.fillRect(x - rx - 2, y - ry - 2, rx * 2 + 4, ry * 2 * opts.lid);
    ctx.restore();
    line(ctx, x - rx, y - ry + ry * 2 * opts.lid, x + rx, y - ry + ry * 2 * opts.lid, 3.4);
  }
  if (opts.lash) {
    for (const k of [0, 1]) {
      const ax = x + opts.side * (rx - 1 - k * 5);
      const ay = y - ry + 1 + k * 2;
      line(ctx, ax, ay, ax + opts.side * 5, ay - 6 + k * 2, 2.8);
    }
  }
}

function brows(ctx: Ctx, y: number, gap: number, kind: "flat" | "angry" | "sad" | "up" | "raise1" | "none") {
  if (kind === "none") return;
  for (const s of [-1, 1]) {
    const inner = s * (gap - 7);
    const outer = s * (gap + 9);
    let yi = y;
    let yo = y;
    if (kind === "angry") {
      yi = y + 6;
      yo = y - 5;
    } else if (kind === "sad") {
      yi = y - 6;
      yo = y + 3;
    } else if (kind === "up") {
      yi = y - 6;
      yo = y - 6;
    } else if (kind === "raise1" && s > 0) {
      yi = y - 7;
      yo = y - 9;
    }
    line(ctx, inner, yi, outer, yo, 4);
  }
}

/** چهره در مختصات سر (مرکز سر = ۰،۰). */
export function drawFace(ctx: Ctx, face: Expression, blink: number, talk: number, look: number, woman: boolean) {
  const ey = -4;
  const gap = 15;
  const open = 1 - blink;
  const lash = woman;
  const eyes = (o: Partial<{ open: number; look: number; big: boolean; lid: number }> = {}) => {
    for (const s of [-1, 1]) {
      eye(ctx, s * gap, ey, { open: o.open ?? open, look: o.look ?? look, big: o.big, lash, side: s, lid: o.lid });
    }
  };
  const happyEyes = () => {
    // چشم خندان ^ ^
    for (const s of [-1, 1]) arc(ctx, s * gap, ey + 4, 8, Math.PI * 1.1, Math.PI * 1.9, 4);
  };
  const my = 20;
  switch (face) {
    case "neutral":
      eyes();
      brows(ctx, ey - 15, gap, woman ? "none" : "flat");
      if (talk > 0.05) talkMouth(ctx, my, talk);
      else line(ctx, -8, my, 8, my);
      break;
    case "smile":
      eyes();
      if (talk > 0.05) talkMouth(ctx, my, talk);
      else arc(ctx, 0, my - 9, 13, 0.2 * Math.PI, 0.8 * Math.PI, 4);
      break;
    case "grin": {
      eyes();
      ctx.beginPath();
      ctx.moveTo(-17, my - 4);
      ctx.quadraticCurveTo(0, my + 20, 17, my - 4);
      ctx.closePath();
      fillStroke(ctx, PAPER, 3.8);
      line(ctx, -15, my + 1, 15, my + 1, 2.6);
      break;
    }
    case "laugh": {
      happyEyes();
      ctx.beginPath();
      ctx.moveTo(-19, my - 6);
      ctx.quadraticCurveTo(0, my + 28 + talk * 4, 19, my - 6);
      ctx.closePath();
      fillStroke(ctx, "#2b2b2b", 3.8);
      // زبان
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-19, my - 6);
      ctx.quadraticCurveTo(0, my + 28 + talk * 4, 19, my - 6);
      ctx.closePath();
      ctx.clip();
      ctx.beginPath();
      ctx.ellipse(0, my + 18, 10, 7, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#9a9a9a";
      ctx.fill();
      ctx.fillStyle = PAPER;
      ctx.fillRect(-19, my - 6, 38, 6);
      ctx.restore();
      break;
    }
    case "smirk":
      eyes({ lid: 0.45, look: look || 0.6 });
      brows(ctx, ey - 15, gap, "raise1");
      ctx.beginPath();
      ctx.moveTo(-10, my + 1);
      ctx.quadraticCurveTo(4, my + 4, 13, my - 5);
      stroke(ctx, 4);
      break;
    case "angry":
      eyes({ lid: 0.3 });
      brows(ctx, ey - 13, gap, "angry");
      if (talk > 0.05) talkMouth(ctx, my, talk);
      else arc(ctx, 0, my + 9, 11, 1.2 * Math.PI, 1.8 * Math.PI, 4);
      break;
    case "pout": {
      // اخم با لپ باد کرده
      eyes({ lid: 0.35 });
      brows(ctx, ey - 13, gap, "angry");
      ctx.beginPath();
      ctx.ellipse(0, my + 2, 7, 6, 0, 0, Math.PI * 2);
      fillStroke(ctx, PAPER, 3.6);
      for (const s of [-1, 1]) arc(ctx, s * 22, my - 2, 9, s > 0 ? -0.6 * Math.PI : 0.4 * Math.PI, s > 0 ? 0.6 * Math.PI : 1.6 * Math.PI, 3.2);
      break;
    }
    case "sad":
      eyes({ look: 0 });
      brows(ctx, ey - 14, gap, "sad");
      arc(ctx, 0, my + 10, 11, 1.2 * Math.PI, 1.8 * Math.PI, 4);
      break;
    case "worried":
      eyes({ look: look || -0.5 });
      brows(ctx, ey - 15, gap, "sad");
      ctx.beginPath();
      ctx.moveTo(-10, my + 2);
      for (let i = 1; i <= 4; i++) ctx.lineTo(-10 + i * 5, my + (i % 2 ? -2 : 2));
      stroke(ctx, 3.6);
      break;
    case "surprised":
      eyes({ big: true, look: 0 });
      brows(ctx, ey - 20, gap, "up");
      ctx.beginPath();
      ctx.ellipse(0, my + 4, 7, 9, 0, 0, Math.PI * 2);
      fillStroke(ctx, "#2b2b2b", 3.6);
      break;
    case "content":
      for (const s of [-1, 1]) arc(ctx, s * gap, ey - 2, 8, 0.1 * Math.PI, 0.9 * Math.PI, 4);
      arc(ctx, 0, my - 7, 10, 0.2 * Math.PI, 0.8 * Math.PI, 4);
      break;
    case "kiss":
      eyes({ look: look || 0.7 });
      ctx.font = "700 26px sans-serif";
      ctx.fillStyle = INK;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("3", 2, my + 2);
      break;
    case "sideEye":
      eyes({ look: look || 0.9, lid: 0.25 });
      brows(ctx, ey - 15, gap, "raise1");
      line(ctx, -7, my + 1, 9, my - 1);
      break;
    case "annoyed":
      eyes({ lid: 0.5, look: look || -0.4 });
      brows(ctx, ey - 13, gap, "flat");
      line(ctx, -9, my + 2, 9, my + 2);
      break;
  }
}

function talkMouth(ctx: Ctx, y: number, talk: number) {
  ctx.beginPath();
  ctx.ellipse(0, y + 2, 9 + talk * 3, 3 + talk * 8, 0, 0, Math.PI * 2);
  fillStroke(ctx, "#2b2b2b", 3.6);
}

/* ---------- مو ---------- */

function hairBack(ctx: Ctx, r: number) {
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

function hairFront(ctx: Ctx, r: number) {
  // چتری: روی سر تا شقیقه‌ها، لبهٔ پایینش سه دستهٔ موی نوک‌دار روی پیشانی.
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

/* ---------- کل بدن ---------- */

/**
 * کشیدن آدمک. (x, y) جای لگن در صحنه است و `scale` اندازه.
 * ترتیب لایه‌ها: پا، دامن، بدن، دست پشت، سر، دست جلو و اشیای دست.
 */
export function drawFigure(ctx: Ctx, look: Look, st: FigureState, x: number, y: number, scale: number) {
  const j = joints(st.pose);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const woman = look.kind === "woman";

  // پاها
  for (const [leg, side] of [
    [j.legL, -1],
    [j.legR, 1],
  ] as const) {
    const hip = { x: j.pelvis.x + side * (woman ? 14 : 9), y: j.pelvis.y + (woman ? 10 : 0) };
    polyline(ctx, [hip, leg.mid, leg.end]);
    foot(ctx, leg.end, side);
  }

  // بدن
  if (woman) {
    // پیراهن مثلثی از سرشانه تا زیر لگن
    const L = rad(st.pose.lean);
    const down = { x: -Math.sin(L), y: Math.cos(L) };
    const across = { x: Math.cos(L), y: Math.sin(L) };
    const top = { x: j.shoulder.x - down.x * 8, y: j.shoulder.y - down.y * 8 };
    const sitting = st.pose.thigh < 0.7;
    const hemD = sitting ? 26 : 42;
    const hemW = sitting ? 62 : 56;
    const hem = { x: j.pelvis.x + down.x * hemD, y: j.pelvis.y + down.y * hemD };
    ctx.beginPath();
    ctx.moveTo(top.x - across.x * 11, top.y - across.y * 11);
    ctx.lineTo(top.x + across.x * 11, top.y + across.y * 11);
    ctx.lineTo(hem.x + across.x * hemW, hem.y + across.y * hemW);
    ctx.lineTo(hem.x - across.x * hemW, hem.y - across.y * hemW);
    ctx.closePath();
    fillStroke(ctx);
  } else {
    polyline(ctx, [j.pelvis, j.neck]);
  }
  // گردن تا زیر سر
  {
    const H = rad(st.pose.lean + st.pose.tilt);
    polyline(ctx, [j.neck, { x: j.neck.x + Math.sin(H) * (BODY.neck + 4), y: j.neck.y - Math.cos(H) * (BODY.neck + 4) }]);
  }

  // دست‌ها
  // زن: دست‌ها از گوشه‌های بالای پیراهن شروع می‌شوند تا روی پیراهن خط نیفتد.
  const sw = woman ? 11 : 0;
  const Lr = rad(st.pose.lean);
  for (const [arm, side, hold] of [
    [j.armL, -1, st.holdL ?? "none"],
    [j.armR, 1, st.holdR ?? "none"],
  ] as const) {
    const o = { x: Math.cos(Lr) * sw * side, y: Math.sin(Lr) * sw * side };
    const sh = { x: j.shoulder.x + o.x, y: j.shoulder.y + o.y };
    polyline(ctx, [sh, { x: arm.mid.x + o.x, y: arm.mid.y + o.y }, { x: arm.end.x + o.x, y: arm.end.y + o.y }]);
    drawHold(ctx, hold, { x: arm.end.x + o.x, y: arm.end.y + o.y }, side);
  }

  // سر
  ctx.save();
  ctx.translate(j.headC.x, j.headC.y);
  ctx.rotate(rad(st.pose.lean + st.pose.tilt));
  const r = BODY.headR;
  if (woman) hairBack(ctx, r);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  fillStroke(ctx);
  if (woman) hairFront(ctx, r);
  else if (look.tufts) tufts(ctx, r, look.tufts);
  drawFace(ctx, st.face, st.blink, st.talk, st.pose.look, woman);
  ctx.restore();

  ctx.restore();
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
