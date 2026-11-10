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

/**
 * یک قطعهٔ بریده‌شده: استخوانش در تصویر مرجع، جای تصویرش در اطلس و جای اصلی‌اش در تصویر مرجع.
 * برش با «نزدیک‌ترین استخوان» انجام می‌شود، پس هیچ قطعه‌ای تکهٔ اندام دیگر را با خود نمی‌برد.
 */
export type Part = {
  name: PartName;
  a: Vec;
  b: Vec;
  /** مستطیل این قطعه در تصویر اطلس. */
  src: { x: number; y: number; w: number; h: number };
  /** گوشهٔ بالا-چپ همین برش در مختصات تصویر مرجع. */
  off: Vec;
};

/** تعریف استخوان هر قطعه در تصویر مرجع؛ پایهٔ هم برش و هم حرکت. */
export type Bone = {
  name: PartName;
  /** استخوان حرکت: محور چرخش قطعه. */
  a: Vec;
  b: Vec;
  /**
   * استخوان برش (اگر با استخوان حرکت فرق کند): فقط برای تصمیم «این پیکسل مال کدام قطعه است».
   * سرشانه و دور لگن عمداً از تنه حساب می‌شوند، چون در بدن واقعی هم با چرخش بازو و پا جابه‌جا نمی‌شوند.
   */
  sa: Vec;
  sb: Vec;
};

/**
 * «فاصله از تنه»: تنه ۰، سر و بازو و ران ۱، ساعد و ساق ۲، دست و پا ۳.
 * نوارِ اشتراکیِ دور مفصل فقط از قطعهٔ دورتر به قطعهٔ نزدیک‌تر داده می‌شود، چون قطعهٔ نزدیک‌تر کمتر
 * می‌چرخد و زیرِ قطعهٔ دورتر کشیده می‌شود؛ پس همان پارچهٔ اضافه شکاف مفصل را می‌پوشاند و بیرون نمی‌زند.
 */
export const PART_DEPTH: Record<PartName, number> = {
  torso: 0, head: 1,
  armFarUpper: 1, armFarFore: 2, handFar: 3,
  armNearUpper: 1, armNearFore: 2, handNear: 3,
  legFarThigh: 1, legFarShin: 2, footFar: 3,
  legNearThigh: 1, legNearShin: 2, footNear: 3,
};

export type PuppetRig = {
  id: string;
  name: string;
  /** کلید تصویر اطلسِ قطعه‌ها در Cloud Storage. */
  image: string;
  /** اندازهٔ تصویر مرجع (مختصات مفاصل در همین فضاست). */
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

/** استخوان‌های عروسک در تصویر مرجع، به ترتیبِ کشیده‌شدن. */
export function bonesOf(joints: Joints): { bones: Bone[]; near: "L" | "R" } {
  const j = joints;
  const near: "L" | "R" = j.handL.x > j.handR.x ? "L" : "R";
  const far = near === "L" ? "R" : "L";
  const J = (p: string, s: "L" | "R") => j[`${p}${s}` as JointName];
  const bones: Bone[] = [];
  const B = (name: PartName, a: Vec, b: Vec, trim = 0): Bone => ({
    name, a, b,
    sa: trim ? V(a.x + (b.x - a.x) * trim, a.y + (b.y - a.y) * trim) : a,
    sb: b,
  });
  for (const [side, tag] of [[far, "Far"], [near, "Near"]] as const) {
    const wrist = J("wrist", side), hand = J("hand", side);
    const ankle = J("ankle", side), toe = J("toe", side);
    bones.push(B(`arm${tag}Upper` as PartName, J("shoulder", side), J("elbow", side), 0.12));
    bones.push(B(`arm${tag}Fore` as PartName, J("elbow", side), wrist));
    // انگشتان کمی فراتر از مرکز کف دست‌اند؛ استخوان دست را امتداد می‌دهیم تا آن‌ها هم در همین قطعه بیفتند.
    bones.push(B(`hand${tag}` as PartName, wrist, V(wrist.x + (hand.x - wrist.x) * 1.8, wrist.y + (hand.y - wrist.y) * 1.8)));
    bones.push(B(`leg${tag}Thigh` as PartName, J("hip", side), J("knee", side), 0.16));
    bones.push(B(`leg${tag}Shin` as PartName, J("knee", side), ankle));
    bones.push(B(`foot${tag}` as PartName, ankle, V(ankle.x + (toe.x - ankle.x) * 1.15, ankle.y + (toe.y - ankle.y) * 1.15)));
  }
  bones.push(B("torso", mid(j.hipL, j.hipR), j.neck));
  // استخوان سر از بالا به چین است تا با همان جهتِ استخوانِ ژست بخواند (وگرنه سر وارونه می‌شود).
  bones.push(B("head", V(j.headCenter.x, j.headTop.y), j.chin));
  const order = new Map(PART_NAMES.map((n, i) => [n, i]));
  bones.sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));
  return { bones, near };
}

/** اندازه‌های بدن و خط زمین از روی مفاصل؛ قطعه‌ها را برش‌دهنده می‌دهد. */
export function measureBody(name: string, joints: Joints): { body: BodySpec; u: number; ground: number } {
  const j = joints;
  const L = (p: string, s: "L" | "R") => j[`${p}${s}` as JointName];
  const ground = Math.max(L("ankle", "L").y, L("ankle", "R").y, L("toe", "L").y, L("toe", "R").y) + 2;
  const legPx = (len(L("hip", "L"), L("knee", "L")) + len(L("knee", "L"), L("ankle", "L")) + len(L("hip", "R"), L("knee", "R")) + len(L("knee", "R"), L("ankle", "R"))) / 2;
  const armPx = (len(L("shoulder", "L"), L("elbow", "L")) + len(L("elbow", "L"), L("wrist", "L")) + len(L("shoulder", "R"), L("elbow", "R")) + len(L("elbow", "R"), L("wrist", "R"))) / 2;
  const headRPx = Math.max(10, (j.chin.y - j.headTop.y) / 2);
  const ankPx = Math.max(4, ground - (L("ankle", "L").y + L("ankle", "R").y) / 2);
  const neckPx = Math.max(4, len(j.neck, j.chest) * 0.6);
  const u = (ground - j.headTop.y) / heightOf(REF_BODY);
  const shW = Math.abs(j.shoulderL.x - j.shoulderR.x), hipW = Math.abs(j.hipL.x - j.hipR.x);
  const body: BodySpec = {
    label: name, scale: 1, headR: headRPx / u, shoulder: shW / 2 / u, waist: (shW * 0.38 + hipW * 0.5) / 2 / u,
    hip: hipW / 2 / u, torso: len(j.pelvis, j.chest) / u, leg: legPx / u, arm: armPx / u, limb: 1, stoop: 0,
    ankle: ankPx / u, neck: neckPx / u,
  };
  return { body, u, ground };
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
    ctx.drawImage(img, part.src.x, part.src.y, part.src.w, part.src.h, part.off.x, part.off.y, part.src.w, part.src.h);
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
