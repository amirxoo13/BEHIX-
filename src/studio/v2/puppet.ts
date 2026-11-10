/**
 * عروسک بُرش‌خورده (cut-out puppet) — قلب موتور انیمیشن BEHIX.
 *
 * هنر را Gemini Image یک‌بار می‌سازد (یک تصویر تمام‌قد با پس‌زمینهٔ شفاف) و Gemini مختصات مفاصل را می‌دهد.
 * از آن به بعد هیچ مدل هوش مصنوعی در کار نیست: همین فایل، تصویر را به قطعه‌های اندام می‌بُرد و روی اسکلتِ
 * موتور (pose.ts: IK، انتقال وزن، چرخهٔ راه‌رفتن) می‌نشاند. یعنی فیلم ۳ تا ۵ دقیقه‌ای با همان هنر حرفه‌ای،
 * کاملاً قابل‌ویرایش، ارزان و روی گوشی هم روان — کاری که مدل‌های ویدیو انجامش نمی‌دهند.
 */
import {
  ANKLE_DEF, NECK_DEF, REF_BODY, heightOf, ik, solve,
  type BodySpec, type Pose, type Skeleton, type Vec,
} from "./pose.ts";

export const JOINT_NAMES = [
  "headTop", "headCenter", "chin", "neck", "chest", "pelvis",
  "shoulderL", "elbowL", "wristL", "handL", "shoulderR", "elbowR", "wristR", "handR",
  "hipL", "kneeL", "ankleL", "toeL", "hipR", "kneeR", "ankleR", "toeR",
] as const;
export type JointName = (typeof JOINT_NAMES)[number];
export type Joints = Record<JointName, Vec>;

/** نام قطعه‌های عروسک، به ترتیبِ کشیده‌شدن (از دور به نزدیک). */
export const PART_NAMES = [
  "armFarUpper", "armFarFore", "handFar",
  "legFarThigh", "legFarShin", "footFar",
  "legNearThigh", "legNearShin", "footNear",
  "torso", "head",
  "armNearUpper", "armNearFore", "handNear",
] as const;
export type PartName = (typeof PART_NAMES)[number];

/** یک قطعه: استخوانش در تصویر مرجع و شعاع برش در دو سر. */
export type Part = { name: PartName; a: Vec; b: Vec; ra: number; rb: number };

export type PuppetRig = {
  id: string;
  name: string;
  /** کلید تصویر شفاف در Cloud Storage. */
  image: string;
  w: number;
  h: number;
  joints: Joints;
  parts: Part[];
  /** اندازه‌های بدن به «واحد بدن» برای حل اسکلت. */
  body: BodySpec;
  /** پیکسل تصویر به ازای هر واحد بدن. */
  u: number;
  /** خط زمین در تصویر مرجع (پیکسل). */
  ground: number;
  /** کدام سمت بدن به دوربین نزدیک‌تر است (در تصویر مرجع). */
  near: "L" | "R";
};

const V = (x: number, y: number): Vec => ({ x, y });
const sub = (a: Vec, b: Vec): Vec => V(a.x - b.x, a.y - b.y);
const mid = (a: Vec, b: Vec): Vec => V((a.x + b.x) / 2, (a.y + b.y) / 2);
const len = (a: Vec, b: Vec) => Math.hypot(b.x - a.x, b.y - a.y);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/* ---------- ساخت عروسک از مفاصل اندازه‌گیری‌شده ---------- */

/** نیم‌پهنای واقعی اندام را از کانال شفافیت تصویر می‌خواند (اگر ماسک داده شود). */
export type AlphaMask = { w: number; h: number; at: (x: number, y: number) => number };

function measureRadius(mask: AlphaMask | null, a: Vec, b: Vec, fallback: number, max: number): number {
  if (!mask) return fallback;
  const L = len(a, b);
  if (L < 4) return fallback;
  const nx = -(b.y - a.y) / L, ny = (b.x - a.x) / L;
  let best = 0;
  // در هر نقطه نیم‌پهنای سمتِ باریک‌تر گرفته می‌شود تا اسکن وارد اندام کناری (ران دیگر یا تنه) نشود.
  for (const t of [0.3, 0.45, 0.6, 0.75]) {
    const px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t;
    const side = [1, -1].map((s) => {
      let r = 2;
      while (r < max && mask.at(Math.round(px + nx * s * r), Math.round(py + ny * s * r)) > 24) r += 1;
      return r;
    });
    best = Math.max(best, Math.min(side[0], side[1]));
  }
  return clamp(best * 1.3 + 2, fallback * 0.5, max);
}

/**
 * عروسک را از مفاصل (پیکسل تصویر) می‌سازد: اندازه‌های بدن، خط زمین و قطعه‌ها با شعاع برش.
 * mask اختیاری است؛ با آن شعاع برش از روی خود تصویر اندازه‌گیری می‌شود (آستین گشاد یا دامن هم درست بریده می‌شود).
 */
export function buildPuppet(id: string, name: string, image: string, w: number, h: number, joints: Joints, mask: AlphaMask | null = null): PuppetRig {
  const j = joints;
  const near: "L" | "R" = j.handL.x > j.handR.x ? "L" : "R";
  const far = near === "L" ? "R" : "L";
  const sh = (s: "L" | "R") => j[`shoulder${s}` as JointName];
  const el = (s: "L" | "R") => j[`elbow${s}` as JointName];
  const wr = (s: "L" | "R") => j[`wrist${s}` as JointName];
  const hd = (s: "L" | "R") => j[`hand${s}` as JointName];
  const hp = (s: "L" | "R") => j[`hip${s}` as JointName];
  const kn = (s: "L" | "R") => j[`knee${s}` as JointName];
  const an = (s: "L" | "R") => j[`ankle${s}` as JointName];
  const to = (s: "L" | "R") => j[`toe${s}` as JointName];

  const ground = Math.max(an("L").y, an("R").y, to("L").y, to("R").y) + 2;
  const legPx = (len(hp("L"), kn("L")) + len(kn("L"), an("L")) + len(hp("R"), kn("R")) + len(kn("R"), an("R"))) / 2;
  const armPx = (len(sh("L"), el("L")) + len(el("L"), wr("L")) + len(sh("R"), el("R")) + len(el("R"), wr("R"))) / 2;
  const torsoPx = len(j.pelvis, j.chest);
  const headRPx = Math.max(10, (j.chin.y - j.headTop.y) / 2);
  const ankPx = Math.max(4, ground - (an("L").y + an("R").y) / 2);
  const neckPx = Math.max(4, len(j.neck, j.chest) * 0.6);
  const heightPx = ground - j.headTop.y;

  // تبدیل «واحد بدن» کتابخانهٔ ژست به پیکسل این تصویر.
  const u = heightPx / heightOf(REF_BODY);
  const body: BodySpec = {
    label: name,
    scale: 1,
    headR: headRPx / u,
    shoulder: Math.abs(sh("L").x - sh("R").x) / 2 / u,
    waist: (Math.abs(sh("L").x - sh("R").x) * 0.38 + Math.abs(hp("L").x - hp("R").x) * 0.5) / 2 / u,
    hip: Math.abs(hp("L").x - hp("R").x) / 2 / u,
    torso: torsoPx / u,
    leg: legPx / u,
    arm: armPx / u,
    limb: 1,
    stoop: 0,
    ankle: ankPx / u,
    neck: neckPx / u,
  };

  const R = (a: Vec, b: Vec, frac: number, maxFrac: number) => measureRadius(mask, a, b, legPx * frac, legPx * maxFrac);
  const P = (name: PartName, a: Vec, b: Vec, ra: number, rb: number): Part => ({ name, a, b, ra, rb });
  const neckTop = mid(j.neck, j.chin);
  const headA = V(j.headCenter.x, j.headTop.y - headRPx * 0.25);
  const parts: Part[] = [];
  for (const [side, tag] of [[far, "Far"], [near, "Near"]] as const) {
    const sU = R(sh(side), el(side), 0.062, 0.115), sF = R(el(side), wr(side), 0.05, 0.095);
    const tU = R(hp(side), kn(side), 0.085, 0.145), tS = R(kn(side), an(side), 0.065, 0.12);
    // شانه کمی بیرون‌تر از مفصل بریده می‌شود تا گردن و فک وارد قطعهٔ بازو نشوند؛ شکافِ شانه زیر قطعهٔ تنه می‌ماند.
    const shA = V(sh(side).x + (el(side).x - sh(side).x) * 0.1, sh(side).y + (el(side).y - sh(side).y) * 0.1);
    parts.push(P(`arm${tag}Upper` as PartName, shA, el(side), Math.min(sU, len(sh(side), j.neck) * 0.56), sU));
    parts.push(P(`arm${tag}Fore` as PartName, el(side), wr(side), sU, sF));
    parts.push(P(`hand${tag}` as PartName, wr(side), hd(side), sF * 1.1, sF * 1.45));
    // ران کمی پایین‌تر از مفصل لگن بریده می‌شود تا دامنِ کت وارد قطعهٔ پا نشود؛ خودِ لگن زیر قطعهٔ تنه می‌ماند.
    const hpA = V(hp(side).x + (kn(side).x - hp(side).x) * 0.26, hp(side).y + (kn(side).y - hp(side).y) * 0.26);
    parts.push(P(`leg${tag === "Far" ? "Far" : "Near"}Thigh` as PartName, hpA, kn(side), tU * 0.82, tU));
    parts.push(P(`leg${tag === "Far" ? "Far" : "Near"}Shin` as PartName, kn(side), an(side), tU, tS));
    parts.push(P(`foot${tag}` as PartName, an(side), to(side), tS * 1.15, tS * 1.05));
  }
  parts.push(P("torso", mid(hp("L"), hp("R")), neckTop, Math.abs(hp("L").x - hp("R").x) * 0.78, Math.abs(sh("L").x - sh("R").x) * 0.72));
  parts.push(P("head", headA, j.chin, headRPx * 1.15, headRPx * 1.05));
  const order = new Map(PART_NAMES.map((n, i) => [n, i]));
  parts.sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));
  return { id, name, image, w, h, joints: j, parts, body, u, ground, near };
}

/* ---------- حل اسکلت عروسک ---------- */

/** مقادیر ژست که به «واحد بدن» هستند را به پیکسل این عروسک تبدیل می‌کند. */
export function scalePose(p: Pose, u: number): Pose {
  return {
    ...p,
    hipX: p.hipX * u, hipDrop: p.hipDrop * u, shrug: p.shrug * u,
    lFoot: V(p.lFoot.x * u, p.lFoot.y * u), rFoot: V(p.rFoot.x * u, p.rFoot.y * u),
  };
}

/** اسکلت عروسک در لحظه؛ مبدأ روی زمین زیر لگن، y به سمت بالا منفی (پیکسل تصویر مرجع). */
export function solvePuppet(rig: PuppetRig, pose: Pose, turn: number): Skeleton {
  const px: BodySpec = {
    ...rig.body,
    headR: rig.body.headR * rig.u, shoulder: rig.body.shoulder * rig.u, waist: rig.body.waist * rig.u,
    hip: rig.body.hip * rig.u, torso: rig.body.torso * rig.u, leg: rig.body.leg * rig.u, arm: rig.body.arm * rig.u,
    ankle: (rig.body.ankle ?? ANKLE_DEF) * rig.u, neck: (rig.body.neck ?? NECK_DEF) * rig.u,
  };
  return solve(px, scalePose(pose, rig.u), turn);
}

/** قد عروسک از زمین تا بالای سر، به پیکسل تصویر مرجع. */
export const puppetHeight = (rig: PuppetRig) => rig.ground - rig.joints.headTop.y;

/* ---------- کشیدن ---------- */

type C = CanvasRenderingContext2D;
type Img = CanvasImageSource;

/** کفش: بردار «مچ تا نوک پا»ی تصویر مرجع را به اندازهٔ زاویهٔ پا می‌چرخاند. */
function footBone(limb: Skeleton["l"], rig: PuppetRig, which: "near" | "far"): [Vec, Vec] {
  const side = which === "near" ? rig.near : rig.near === "L" ? "R" : "L";
  const an = rig.joints[`ankle${side}` as JointName], to = rig.joints[`toe${side}` as JointName];
  const a = (limb.footAng * Math.PI) / -180;
  const dx = to.x - an.x, dy = to.y - an.y;
  return [limb.ankle, V(limb.ankle.x + dx * Math.cos(a) - dy * Math.sin(a), limb.ankle.y + dx * Math.sin(a) + dy * Math.cos(a))];
}

/** استخوانِ متناظر هر قطعه در اسکلتِ حل‌شده. */
function posedBone(sk: Skeleton, rig: PuppetRig, name: PartName): [Vec, Vec] | null {
  const nearSide = sk.l, farSide = sk.r; // در فضای پیکره: l نزدیک دوربین، r دورتر
  const headLen = rig.body.headR * rig.u * 1.9;
  const a = (Math.PI / 180) * sk.headAng;
  switch (name) {
    case "armFarUpper": return [farSide.shoulder, farSide.elbow];
    case "armFarFore": return [farSide.elbow, farSide.wrist];
    case "handFar": return [farSide.wrist, V(farSide.wrist.x + (farSide.wrist.x - farSide.elbow.x) * 0.3, farSide.wrist.y + (farSide.wrist.y - farSide.elbow.y) * 0.3)];
    case "armNearUpper": return [nearSide.shoulder, nearSide.elbow];
    case "armNearFore": return [nearSide.elbow, nearSide.wrist];
    case "handNear": return [nearSide.wrist, V(nearSide.wrist.x + (nearSide.wrist.x - nearSide.elbow.x) * 0.3, nearSide.wrist.y + (nearSide.wrist.y - nearSide.elbow.y) * 0.3)];
    case "legFarThigh": return [farSide.hip, farSide.knee];
    case "legFarShin": return [farSide.knee, farSide.ankle];
    case "footFar": return footBone(farSide, rig, "far");
    case "legNearThigh": return [nearSide.hip, nearSide.knee];
    case "legNearShin": return [nearSide.knee, nearSide.ankle];
    case "footNear": return footBone(nearSide, rig, "near");
    case "torso": return [sk.pelvis, sk.neck];
    case "head": return [V(sk.head.x - Math.sin(a) * -headLen * 0.5, sk.head.y - Math.cos(a) * headLen * 0.5), V(sk.head.x + Math.sin(a) * -headLen * 0.5, sk.head.y + Math.cos(a) * headLen * 0.5)];
  }
  return null;
}

function capsulePath(ctx: C, a: Vec, b: Vec, ra: number, rb: number) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.beginPath();
  ctx.arc(a.x, a.y, ra, ang + Math.PI / 2, ang + (3 * Math.PI) / 2);
  ctx.arc(b.x, b.y, rb, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.closePath();
}

export type DrawOpts = {
  /** کف پا روی بوم. */
  x: number;
  groundY: number;
  /** قد نهایی روی بوم به پیکسل. */
  height: number;
  facing: 1 | -1;
  rig?: boolean;
  shadow?: boolean;
  /** تصویرهای رویی (دهان و چشم) که روی سر کشیده می‌شوند. */
  overlays?: { img: Img; sw: number; sh: number; at: Vec; w: number; h: number }[];
};

/**
 * عروسک را با ژستِ حل‌شده روی بوم می‌کشد.
 * هر قطعه = همان تصویر مرجع، با تبدیلی که استخوانِ مرجع را روی استخوانِ ژست می‌نشاند و فقط ناحیهٔ خودش را نشان می‌دهد.
 */
export function drawPuppet(ctx: C, rig: PuppetRig, img: Img, pose: Pose, turn: number, o: DrawOpts) {
  const sk = solvePuppet(rig, pose, turn);
  const scale = o.height / puppetHeight(rig);
  ctx.save();
  ctx.translate(o.x, o.groundY);
  if (o.shadow !== false) {
    ctx.save();
    ctx.fillStyle = "rgba(28,20,38,0.22)";
    ctx.beginPath();
    ctx.ellipse(0, 2, o.height * 0.17, o.height * 0.028, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.scale(o.facing * scale, scale);
  for (const part of rig.parts) {
    const bone = posedBone(sk, rig, part.name);
    if (!bone) continue;
    const [A1, B1] = bone;
    const d0 = sub(part.b, part.a), d1 = sub(B1, A1);
    const l0 = Math.hypot(d0.x, d0.y) || 1, l1 = Math.hypot(d1.x, d1.y) || 1;
    // پا و دست با کشیدگی استخوان بزرگ‌نمایی نمی‌شوند (طول استخوان در IK ثابت است).
    const k = part.name.startsWith("foot") || part.name.startsWith("hand") ? 1 : clamp(l1 / l0, 0.75, 1.3);
    const rot = Math.atan2(d1.y, d1.x) - Math.atan2(d0.y, d0.x);
    ctx.save();
    ctx.translate(A1.x, A1.y);
    ctx.rotate(rot);
    ctx.scale(k, k);
    ctx.translate(-part.a.x, -part.a.y);
    capsulePath(ctx, part.a, part.b, part.ra, part.rb);
    ctx.clip();
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }
  if (o.overlays?.length) {
    const headBone = posedBone(sk, rig, "head");
    if (headBone) {
      const [A1, B1] = headBone;
      const d0 = sub(rig.joints.chin, V(rig.joints.headCenter.x, rig.joints.headTop.y - 1)), d1 = sub(B1, A1);
      const rot = Math.atan2(d1.y, d1.x) - Math.atan2(d0.y, d0.x);
      ctx.save();
      ctx.translate(A1.x, A1.y);
      ctx.rotate(rot);
      ctx.translate(-rig.joints.headCenter.x, -(rig.joints.headTop.y - 1));
      for (const ov of o.overlays) ctx.drawImage(ov.img, 0, 0, ov.sw, ov.sh, ov.at.x - ov.w / 2, ov.at.y - ov.h / 2, ov.w, ov.h);
      ctx.restore();
    }
  }
  if (o.rig) {
    ctx.lineWidth = 2 / scale;
    ctx.strokeStyle = "#ff2a6d";
    ctx.beginPath();
    for (const lm of [sk.l, sk.r]) {
      ctx.moveTo(lm.hip.x, lm.hip.y); ctx.lineTo(lm.knee.x, lm.knee.y); ctx.lineTo(lm.ankle.x, lm.ankle.y);
      ctx.moveTo(lm.shoulder.x, lm.shoulder.y); ctx.lineTo(lm.elbow.x, lm.elbow.y); ctx.lineTo(lm.wrist.x, lm.wrist.y);
    }
    ctx.moveTo(sk.pelvis.x, sk.pelvis.y); ctx.lineTo(sk.chest.x, sk.chest.y); ctx.lineTo(sk.head.x, sk.head.y);
    ctx.stroke();
  }
  ctx.restore();
}

/** بررسی سلامت مفاصل دریافتی از مدل؛ خروجی پیام خطا یا null. */
export function validateJoints(v: unknown): { joints: Joints } | { error: string } {
  if (!v || typeof v !== "object") return { error: "پاسخ مفاصل معتبر نیست." };
  const o = v as Record<string, unknown>;
  const j = {} as Joints;
  for (const n of JOINT_NAMES) {
    const p = o[n] as { x?: unknown; y?: unknown } | undefined;
    if (!p || typeof p.x !== "number" || typeof p.y !== "number" || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return { error: `مفصل ${n} پیدا نشد.` };
    j[n] = V(p.x, p.y);
  }
  if (j.headTop.y >= j.chin.y || j.chest.y >= j.pelvis.y) return { error: "ترتیب عمودی مفاصل درست نیست." };
  if (Math.abs(j.shoulderL.x - j.shoulderR.x) < 1) return { error: "شانه‌ها روی هم افتاده‌اند." };
  return { joints: j };
}

/** مفاصل را از مقیاس ۰..۱۰۰۰ به پیکسل تصویر می‌برد. */
export function jointsToPixels(j: Joints, w: number, h: number): Joints {
  const out = {} as Joints;
  for (const n of JOINT_NAMES) out[n] = V((j[n].x / 1000) * w, (j[n].y / 1000) * h);
  return out;
}

export { ik };
