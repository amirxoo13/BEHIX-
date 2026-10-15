import type { CharacterDef, Emotion, Viseme } from "./types";
import { INK, RIG, type BodyPose } from "./rig";

export type FaceDraw = {
  blink: number;
  viseme: Viseme;
  open: number;
  emotion: Emotion;
  env: number;
};

type Drop = { x: number; y: number; vy: number; life: number };
const tears: Record<string, Drop[]> = {};

function path(ctx: CanvasRenderingContext2D, fill: string, width = 4) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.stroke();
}

function limb(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  color: string,
) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.roundRect(-width * 0.15, -width / 2, Math.max(width, len + width * 0.3), width, width / 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function joint(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function shoe(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, face: number) {
  ctx.beginPath();
  ctx.ellipse(x + face * 10, y - 2, 20, 9, 0, 0, Math.PI * 2);
  path(ctx, color, 3);
}

function drawLegs(
  ctx: CanvasRenderingContext2D,
  pose: BodyPose,
  char: CharacterDef,
  showRig: boolean,
  faceDir: number,
) {
  const order = [pose.left, pose.right].sort((a, b) => a.foot.x - b.foot.x);
  for (const leg of order) {
    limb(ctx, leg.hip.x, leg.hip.y, leg.knee.x, leg.knee.y, 26, char.pants);
    limb(ctx, leg.knee.x, leg.knee.y, leg.foot.x, leg.foot.y, 22, char.pants);
    joint(ctx, leg.knee.x, leg.knee.y, 10, char.skin);
    shoe(ctx, leg.foot.x, leg.foot.y, char.shoe, faceDir);
    if (showRig) {
      ctx.beginPath();
      ctx.moveTo(leg.hip.x, leg.hip.y);
      ctx.lineTo(leg.knee.x, leg.knee.y);
      ctx.lineTo(leg.foot.x, leg.foot.y);
      ctx.strokeStyle = "#e4b15a";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

function drawArms(
  ctx: CanvasRenderingContext2D,
  pose: BodyPose,
  char: CharacterDef,
  showRig: boolean,
  which: "back" | "front",
) {
  const arms = [pose.left, pose.right].sort((a, b) => a.hand.x - b.hand.x);
  const list = which === "back" ? arms.slice(0, 1) : arms.slice(1);
  for (const arm of list) {
    limb(ctx, arm.shoulder.x, arm.shoulder.y, arm.elbow.x, arm.elbow.y, 16, char.shirt);
    limb(ctx, arm.elbow.x, arm.elbow.y, arm.hand.x, arm.hand.y, 14, char.skin);
    joint(ctx, arm.elbow.x, arm.elbow.y, 8, char.skin);
    joint(ctx, arm.hand.x, arm.hand.y, 10, char.skin);
    if (showRig) {
      ctx.beginPath();
      ctx.moveTo(arm.shoulder.x, arm.shoulder.y);
      ctx.lineTo(arm.elbow.x, arm.elbow.y);
      ctx.lineTo(arm.hand.x, arm.hand.y);
      ctx.strokeStyle = "#e4b15a";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

const BUILD_WIDTH = { slim: 0.82, normal: 1, heavy: 1.28 } as const;

function torso(ctx: CanvasRenderingContext2D, char: CharacterDef, drop: number) {
  const k = BUILD_WIDTH[char.build ?? "normal"] ?? 1;
  if (k !== 1) {
    ctx.save();
    ctx.scale(k, 1);
    torsoShape(ctx, char, drop);
    ctx.restore();
  } else torsoShape(ctx, char, drop);
}

function torsoShape(ctx: CanvasRenderingContext2D, char: CharacterDef, drop: number) {
  const top = RIG.shoulderY + drop + 6;
  const bot = RIG.hipY + drop + 18;
  ctx.beginPath();
  ctx.moveTo(-38, top);
  ctx.quadraticCurveTo(-46, (top + bot) / 2, -34, bot);
  ctx.lineTo(34, bot);
  ctx.quadraticCurveTo(46, (top + bot) / 2, 38, top);
  ctx.closePath();
  path(ctx, char.coat ?? char.shirt, 4);
  ctx.beginPath();
  ctx.moveTo(-14, top);
  ctx.lineTo(0, top + 26);
  ctx.lineTo(14, top);
  ctx.closePath();
  path(ctx, "#f4efe6", 3);
  ctx.fillStyle = char.skin;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(-13, top - 22, 26, 26, 8);
  ctx.fill();
  ctx.stroke();
}

function hairFront(ctx: CanvasRenderingContext2D, char: CharacterDef, y: number) {
  ctx.fillStyle = char.hair;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  if (char.hairStyle === "messy") {
    ctx.beginPath();
    ctx.moveTo(-34, y - 6);
    ctx.lineTo(-40, y - 38);
    ctx.lineTo(-18, y - 28);
    ctx.lineTo(-8, y - 52);
    ctx.lineTo(10, y - 30);
    ctx.lineTo(22, y - 50);
    ctx.lineTo(40, y - 32);
    ctx.lineTo(34, y - 4);
    ctx.quadraticCurveTo(0, y - 24, -34, y - 6);
    path(ctx, char.hair, 4);
  } else if (char.hairStyle === "shawl") {
    ctx.beginPath();
    ctx.moveTo(-38, y - 8);
    ctx.quadraticCurveTo(0, y - 58, 38, y - 8);
    ctx.lineTo(46, y + 48);
    ctx.lineTo(28, y + 44);
    ctx.lineTo(30, y - 4);
    ctx.quadraticCurveTo(0, y - 36, -30, y - 4);
    ctx.lineTo(-28, y + 44);
    ctx.lineTo(-46, y + 48);
    ctx.closePath();
    path(ctx, char.hair, 4);
  } else if (char.hairStyle === "hat") {
    ctx.beginPath();
    ctx.arc(0, y - 18, 34, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillRect(-48, y - 20, 96, 12);
    ctx.strokeRect(-48, y - 20, 96, 12);
  } else if (char.hairStyle === "cap") {
    ctx.beginPath();
    ctx.arc(0, y - 10, 34, Math.PI, 0);
    path(ctx, char.hair, 4);
    ctx.beginPath();
    ctx.ellipse(18, y - 8, 28, 8, 0.2, 0, Math.PI * 2);
    path(ctx, "#e4b15a", 3);
  } else if (char.hairStyle === "bald") {
    ctx.fillStyle = char.hair;
    ctx.fillRect(-38, y - 8, 10, 22);
    ctx.strokeRect(-38, y - 8, 10, 22);
    ctx.fillRect(28, y - 8, 10, 22);
    ctx.strokeRect(28, y - 8, 10, 22);
  } else if (char.hairStyle === "bob" || char.hairStyle === "bowl") {
    ctx.beginPath();
    ctx.arc(0, y - 8, 40, Math.PI * 1.05, Math.PI * 1.95, false);
    ctx.quadraticCurveTo(36, y + 18, 24, y + (char.hairStyle === "bob" ? 10 : 2));
    ctx.quadraticCurveTo(0, y - 20, -24, y + (char.hairStyle === "bob" ? 10 : 2));
    ctx.quadraticCurveTo(-36, y + 18, -40, y - 8);
    path(ctx, char.hair, 4);
  }
}

function mouthFront(ctx: CanvasRenderingContext2D, face: FaceDraw, y: number) {
  const smile =
    face.emotion === "smile" || face.emotion === "laugh"
      ? 1
      : face.emotion === "angry" || face.emotion === "cry"
        ? -1
        : 0;
  const open = face.open;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  if (face.viseme === "ah" || face.viseme === "shout" || (face.emotion === "shock" && face.viseme === "rest")) {
    const h = face.viseme === "shout" || face.emotion === "shock" ? 16 : 10 + open * 6;
    ctx.fillStyle = "#3a1212";
    ctx.beginPath();
    ctx.ellipse(0, y, 14 + open * 4, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f4efe6";
    ctx.fillRect(-10, y - h + 2, 20, 5);
    ctx.fillStyle = "#c2412d";
    ctx.beginPath();
    ctx.ellipse(0, y + h * 0.35, 7, 4, 0, 0, Math.PI);
    ctx.fill();
    return;
  }
  if (face.viseme === "ee") {
    ctx.fillStyle = "#f4efe6";
    ctx.beginPath();
    ctx.roundRect(-16, y - 6, 32, 12, 4);
    path(ctx, "#f4efe6", 3);
    ctx.beginPath();
    ctx.moveTo(-14, y);
    ctx.lineTo(14, y);
    ctx.stroke();
    return;
  }
  if (face.viseme === "oo") {
    ctx.fillStyle = "#3a1212";
    ctx.beginPath();
    ctx.arc(0, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    return;
  }
  if (face.viseme === "fv") {
    ctx.fillStyle = "#3a1212";
    ctx.beginPath();
    ctx.ellipse(0, y, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  if (smile > 0) ctx.arc(0, y - 6, 14, 0.15 * Math.PI, 0.85 * Math.PI);
  else if (smile < 0) ctx.arc(0, y + 10, 14, 1.15 * Math.PI, 1.85 * Math.PI);
  else {
    ctx.moveTo(-12, y);
    ctx.lineTo(12, y);
  }
  ctx.stroke();
}

function eyesFront(ctx: CanvasRenderingContext2D, char: CharacterDef, face: FaceDraw, y: number) {
  const scale = face.emotion === "shock" ? 1.35 : face.emotion === "poker" ? 0.9 : 1;
  const r = 11 * scale;
  for (const ex of [-16, 16]) {
    if (char.eyeBags) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(26,18,12,0.55)";
      ctx.lineWidth = 2;
      ctx.arc(ex, y + 2, r + 3, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    }
    ctx.fillStyle = "#f7f3ea";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(ex, y, r, r * 1.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (face.blink > 0.45) {
      ctx.fillStyle = char.skin;
      ctx.beginPath();
      ctx.ellipse(ex, y, r, r * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ex - r, y);
      ctx.lineTo(ex + r, y);
      ctx.stroke();
    } else {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(ex + 2, y, face.emotion === "shock" ? 3.2 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(ex + 0.5, y - 2, 1.6, 0, Math.PI * 2);
      ctx.fill();
      if (face.emotion === "poker" || face.emotion === "laugh") {
        ctx.fillStyle = char.skin;
        ctx.beginPath();
        ctx.ellipse(ex, y - r * 0.15, r, r * (face.emotion === "laugh" ? 0.85 : 0.45), 0, Math.PI, 0);
        ctx.fill();
      }
    }
  }
  if (char.glasses) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(-28, y - r - 2, 24, 22);
    ctx.strokeRect(4, y - r - 2, 24, 22);
    ctx.beginPath();
    ctx.moveTo(-4, y);
    ctx.lineTo(4, y);
    ctx.stroke();
  }
}

function brows(ctx: CanvasRenderingContext2D, char: CharacterDef, face: FaceDraw, y: number) {
  ctx.strokeStyle = char.hairStyle === "bald" ? "#4b5563" : char.hair;
  ctx.lineWidth = char.brow === "arched" ? 4 : 7;
  ctx.lineCap = "round";
  const lift = face.emotion === "shock" ? -10 : face.emotion === "angry" ? 4 : face.emotion === "cry" ? -4 : 0;
  if (char.brow === "unibrow") {
    ctx.beginPath();
    if (face.emotion === "angry") {
      ctx.moveTo(-28, y - 8);
      ctx.lineTo(0, y + 2);
      ctx.lineTo(28, y - 8);
    } else {
      ctx.moveTo(-28, y + lift);
      ctx.quadraticCurveTo(0, y - 8 + lift, 28, y + lift);
    }
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  if (face.emotion === "angry") {
    ctx.moveTo(-30, y - 8);
    ctx.lineTo(-8, y + 2);
    ctx.moveTo(30, y - 8);
    ctx.lineTo(8, y + 2);
  } else if (face.emotion === "cry") {
    ctx.moveTo(-30, y + 2);
    ctx.quadraticCurveTo(-18, y - 8, -8, y - 2);
    ctx.moveTo(8, y - 2);
    ctx.quadraticCurveTo(18, y - 8, 30, y + 2);
  } else {
    ctx.moveTo(-30, y + lift);
    ctx.quadraticCurveTo(-18, y - 8 + lift, -8, y + lift);
    ctx.moveTo(8, y + lift);
    ctx.quadraticCurveTo(18, y - 8 + lift, 30, y + lift);
  }
  ctx.stroke();
}

function facial(ctx: CanvasRenderingContext2D, char: CharacterDef, y: number) {
  ctx.fillStyle = char.hair;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  if (char.facial === "thick") {
    ctx.beginPath();
    ctx.roundRect(-18, y, 36, 10, 5);
    path(ctx, char.hair, 3);
  } else if (char.facial === "handlebar") {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(-20, y - 8, -32, y + 8);
    ctx.quadraticCurveTo(-16, y + 12, 0, y + 4);
    ctx.quadraticCurveTo(16, y + 12, 32, y + 8);
    ctx.quadraticCurveTo(20, y - 8, 0, y);
    path(ctx, char.hair, 3);
  } else if (char.facial === "beard") {
    ctx.beginPath();
    ctx.moveTo(-20, y - 2);
    ctx.quadraticCurveTo(-24, y + 28, 0, y + 32);
    ctx.quadraticCurveTo(24, y + 28, 20, y - 2);
    ctx.quadraticCurveTo(0, y + 8, -20, y - 2);
    path(ctx, char.hair, 3);
  } else if (char.facial === "stubble") {
    ctx.fillStyle = "rgba(26,18,12,0.22)";
    ctx.beginPath();
    ctx.arc(0, y + 6, 24, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.fill();
  }
}

function updateTears(id: string, face: FaceDraw, dt: number) {
  const bag = (tears[id] ??= []);
  const crying = face.emotion === "cry";
  if (crying && bag.length < 8 && Math.random() < dt * 3) {
    bag.push({ x: Math.random() < 0.5 ? -16 : 16, y: -6, vy: 18, life: 1 });
  }
  for (const d of bag) {
    d.y += d.vy * dt;
    d.vy += 40 * dt;
    d.life -= dt * 0.7;
  }
  tears[id] = bag.filter((d) => d.life > 0 && d.y < 40);
  if (!crying) tears[id] = tears[id].filter((d) => d.life > 0.2);
  return tears[id];
}

function drawHeadFront(
  ctx: CanvasRenderingContext2D,
  char: CharacterDef,
  face: FaceDraw,
  headY: number,
  id: string,
  dt: number,
) {
  if (char.hairStyle === "chador") {
    ctx.beginPath();
    ctx.moveTo(-50, headY);
    ctx.quadraticCurveTo(0, headY - 70, 50, headY);
    ctx.lineTo(58, -30);
    ctx.lineTo(-58, -30);
    ctx.closePath();
    path(ctx, char.hair, 4);
  }
  for (const ex of [-32, 32]) {
    ctx.beginPath();
    ctx.ellipse(ex, headY + 6, 8, 12, 0, 0, Math.PI * 2);
    path(ctx, char.skin, 3);
  }
  ctx.beginPath();
  ctx.ellipse(0, headY, 34, 40, 0, 0, Math.PI * 2);
  path(ctx, char.skin, 4);
  if (face.emotion === "angry") {
    ctx.fillStyle = "rgba(194,65,45,0.28)";
    ctx.beginPath();
    ctx.ellipse(0, headY, 34, 40, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (char.hairStyle !== "chador") hairFront(ctx, char, headY);
  else {
    ctx.fillStyle = char.hair;
    ctx.beginPath();
    ctx.arc(0, headY - 18, 36, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  eyesFront(ctx, char, face, headY - 4);
  brows(ctx, char, face, headY - 22);
  ctx.beginPath();
  ctx.moveTo(0, headY - 2);
  ctx.quadraticCurveTo(10, headY + 10, 2, headY + 12);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  mouthFront(ctx, face, headY + 22);
  facial(ctx, char, headY + 14);
  if (face.emotion === "smile" || face.emotion === "laugh") {
    ctx.fillStyle = "rgba(194,65,45,0.28)";
    ctx.beginPath();
    ctx.ellipse(-20, headY + 12, 7, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(20, headY + 12, 7, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const drops = updateTears(id, face, dt);
  ctx.fillStyle = "#7eb8d4";
  for (const d of drops) {
    ctx.globalAlpha = Math.max(0, d.life);
    ctx.beginPath();
    ctx.ellipse(d.x, headY + d.y, 3.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawHeadSide(
  ctx: CanvasRenderingContext2D,
  char: CharacterDef,
  face: FaceDraw,
  headY: number,
) {
  ctx.beginPath();
  ctx.ellipse(-2, headY, 30, 38, 0, 0, Math.PI * 2);
  path(ctx, char.skin, 4);
  ctx.beginPath();
  ctx.moveTo(16, headY - 2);
  ctx.lineTo(34, headY + 8);
  ctx.lineTo(14, headY + 14);
  ctx.closePath();
  path(ctx, char.skin, 3);
  ctx.beginPath();
  ctx.ellipse(-16, headY + 4, 7, 11, 0, 0, Math.PI * 2);
  path(ctx, char.skin, 3);
  if (char.hairStyle === "messy" || char.hairStyle === "bowl" || char.hairStyle === "bob") {
    ctx.beginPath();
    ctx.arc(-4, headY - 10, 32, Math.PI * 0.85, Math.PI * 1.9);
    ctx.lineTo(20, headY - 8);
    ctx.quadraticCurveTo(-6, headY - 40, -30, headY - 6);
    path(ctx, char.hair, 4);
  } else if (char.hairStyle === "hat" || char.hairStyle === "cap") {
    ctx.beginPath();
    ctx.arc(-2, headY - 16, 30, Math.PI, 0);
    path(ctx, char.hairStyle === "cap" ? "#c4a35a" : char.hair, 4);
    ctx.fillRect(-36, headY - 18, 78, 10);
    ctx.strokeRect(-36, headY - 18, 78, 10);
  } else if (char.hairStyle === "shawl" || char.hairStyle === "chador") {
    ctx.beginPath();
    ctx.moveTo(-34, headY - 10);
    ctx.quadraticCurveTo(0, headY - 52, 28, headY - 6);
    ctx.lineTo(18, headY + 50);
    ctx.lineTo(-40, headY + 70);
    ctx.closePath();
    path(ctx, char.hair, 4);
  }
  const eyeX = 10;
  const eyeY = headY - 4;
  ctx.fillStyle = "#f7f3ea";
  ctx.beginPath();
  ctx.ellipse(eyeX, eyeY, 8, 10, 0, 0, Math.PI * 2);
  path(ctx, "#f7f3ea", 3);
  if (face.blink > 0.45) {
    ctx.beginPath();
    ctx.moveTo(eyeX - 8, eyeY);
    ctx.lineTo(eyeX + 8, eyeY);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(eyeX + 1, eyeY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = char.hair;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(eyeX - 10, eyeY - 14);
  ctx.quadraticCurveTo(eyeX, eyeY - 20, eyeX + 12, eyeY - 12);
  ctx.stroke();
  mouthFront(ctx, face, headY + 16);
  if (char.facial === "thick" || char.facial === "handlebar") {
    ctx.fillStyle = char.hair;
    ctx.beginPath();
    ctx.ellipse(12, headY + 14, 12, 5, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function propAtHand(
  ctx: CanvasRenderingContext2D,
  hand: { x: number; y: number },
  action: "tea" | "point",
  skin: string,
) {
  if (action === "tea") {
    ctx.fillStyle = "#e4b15a";
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(hand.x, hand.y + 6, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#8c2f2f";
    ctx.beginPath();
    ctx.moveTo(hand.x - 6, hand.y + 4);
    ctx.lineTo(hand.x - 4, hand.y - 16);
    ctx.lineTo(hand.x + 6, hand.y - 16);
    ctx.lineTo(hand.x + 8, hand.y + 4);
    ctx.closePath();
    path(ctx, "#8c2f2f", 3);
    ctx.fillStyle = "#d7a56a";
    ctx.fillRect(hand.x - 3, hand.y - 14, 8, 6);
  } else {
    ctx.strokeStyle = skin;
    ctx.lineCap = "round";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(hand.x, hand.y);
    ctx.lineTo(hand.x + 4, hand.y - 22);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/* ---------- سر از روی عکس (شخصیت سفارشی) ---------- */

const heads = new Map<string, HTMLImageElement>();

/** تصویر سر، اگر بارگذاری شده باشد؛ اولین بار بارگذاری را شروع می‌کند. */
export function headImage(src: string): HTMLImageElement | null {
  if (typeof Image === "undefined") return null;
  let img = heads.get(src);
  if (!img) {
    img = new Image();
    img.decoding = "async";
    img.src = src;
    heads.set(src, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

/** قبل از رندر فیلم: همهٔ سرهای عکسی کامل بارگذاری شوند تا هیچ فریمی سر نقاشی‌شده نداشته باشد. */
export async function preloadHeads(chars: CharacterDef[]): Promise<void> {
  if (typeof Image === "undefined") return;
  await Promise.all(
    chars
      .filter((c) => c.head)
      .map(async (c) => {
        headImage(c.head!.src);
        await heads.get(c.head!.src)?.decode().catch(() => undefined);
      }),
  );
}

/** دهان سر نقاشی‌شده در این ارتفاع است؛ دهان عکس هم همین‌جا قرار می‌گیرد تا گردن درست وصل شود. */
const MOUTH_DY = 22;

function drawPhotoHead(
  ctx: CanvasRenderingContext2D,
  char: CharacterDef,
  face: FaceDraw,
  headY: number,
  img: HTMLImageElement,
) {
  const h = char.head!;
  const w = h.size;
  const ih = w * h.aspect;
  const left = -h.mouth.x * w;
  const top = headY + MOUTH_DY - h.mouth.y * ih;
  ctx.drawImage(img, left, top, w, ih);
  const k = w / 92;
  // پلک: روی چشم‌های عکس، پوست می‌کشیم و یک خط پلک.
  if (h.eyes && face.blink > 0.5) {
    for (const e of [h.eyes.l, h.eyes.r]) {
      const ex = left + e.x * w;
      const ey = top + e.y * ih;
      ctx.fillStyle = h.patch;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 11 * k, 8 * k, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ex - 9 * k, ey + 1);
      ctx.quadraticCurveTo(ex, ey + 5 * k, ex + 9 * k, ey + 1);
      ctx.stroke();
    }
  }
  // دهان: وقتی ساکت است دهان خود عکس دیده می‌شود؛ وقتی حرف می‌زند دهان متحرک جایش می‌آید.
  const talking = face.viseme !== "rest" || face.open > 0.08;
  if (talking) {
    const my = headY + MOUTH_DY;
    ctx.fillStyle = h.patch;
    ctx.beginPath();
    ctx.ellipse(0, my, 19 * k, 12 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(0, my);
    ctx.scale(k, k);
    mouthFront(ctx, face, 0);
    ctx.restore();
  }
}

export function drawActor(
  ctx: CanvasRenderingContext2D,
  char: CharacterDef,
  pose: BodyPose,
  face: FaceDraw,
  x: number,
  footY: number,
  scale: number,
  facing: number,
  showRig: boolean,
  slotId: string,
  dt: number,
  gesture: "tea" | "point" | "none",
  innerSide: number,
) {
  ctx.save();
  ctx.translate(x, footY);
  const sc = scale * char.scale;
  if (pose.profile) ctx.scale(facing * sc, sc);
  else ctx.scale(sc, sc);
  ctx.rotate((pose.torso * Math.PI) / 180);

  ctx.fillStyle = "rgba(18,16,12,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, 6, 36, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  const headY = RIG.headY + pose.drop;
  if (pose.profile) {
    drawArms(ctx, pose, char, showRig, "back");
    drawLegs(ctx, pose, char, showRig, 1);
    torso(ctx, char, pose.drop);
    ctx.save();
    ctx.translate(0, headY);
    ctx.rotate((pose.head * Math.PI) / 180);
    ctx.translate(0, -headY);
    const photo = char.head ? headImage(char.head.src) : null;
    if (photo) drawPhotoHead(ctx, char, face, headY, photo);
    else drawHeadSide(ctx, char, face, headY);
    ctx.restore();
    drawArms(ctx, pose, char, showRig, "front");
  } else {
    drawLegs(ctx, pose, char, showRig, 1);
    torso(ctx, char, pose.drop);
    ctx.save();
    ctx.translate(0, headY);
    ctx.rotate((pose.head * Math.PI) / 180);
    ctx.translate(0, -headY);
    const photo = char.head ? headImage(char.head.src) : null;
    if (photo) drawPhotoHead(ctx, char, face, headY, photo);
    else drawHeadFront(ctx, char, face, headY, slotId, dt);
    ctx.restore();
    drawArms(ctx, pose, char, showRig, "back");
    drawArms(ctx, pose, char, showRig, "front");
  }
  if (gesture !== "none" && !pose.profile) {
    const hand = innerSide >= 0 ? pose.right.hand : pose.left.hand;
    propAtHand(ctx, hand, gesture, char.skin);
  }
  if (showRig) {
    ctx.strokeStyle = "#e4b15a";
    ctx.lineWidth = 2;
    for (const leg of [pose.left, pose.right]) {
      ctx.beginPath();
      ctx.moveTo(leg.hip.x, leg.hip.y);
      ctx.lineTo(leg.knee.x, leg.knee.y);
      ctx.lineTo(leg.foot.x, leg.foot.y);
      ctx.moveTo(leg.shoulder.x, leg.shoulder.y);
      ctx.lineTo(leg.elbow.x, leg.elbow.y);
      ctx.lineTo(leg.hand.x, leg.hand.y);
      ctx.stroke();
    }
  }
  ctx.restore();
}
