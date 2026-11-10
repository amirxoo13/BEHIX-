/**
 * ژست و حرکت بدن استودیو (خالص و بدون DOM؛ در Node قابل آزمون).
 * - فضای مختصات «فضای پیکره» است: +x سمتی است که شخصیت به آن رو کرده؛ رندر برای رو به چپ کل پیکره را آینه می‌کند.
 * - دست «r» دستِ سمتِ +x (سمت مخاطب) و «l» دستِ نزدیک به دوربین است.
 * - هر تغییر ژست: اول لگن و وزن، بعد ستون فقرات، بعد دست‌ها (با کمی ردکردن)، و سر زودتر از همه می‌چرخد.
 */
/** شیئی که شخصیت در دست دارد (کلیدهای کتابخانهٔ لوازم). */
export type HeldId = "none" | "cup" | "phone" | "book" | "bag" | "tool";

/** اندازه‌های یک تیپ بدن به «واحد بدن»؛ عروسک واقعی اندازه‌هایش را از اسکلت اندازه‌گیری‌شده می‌گیرد. */
export type BodySpec = {
  label: string; scale: number; headR: number; shoulder: number; waist: number; hip: number;
  torso: number; leg: number; arm: number; limb: number; stoop: number;
  /** فاصلهٔ مچ پا تا زمین و طول گردن؛ عروسک واقعی این‌ها را اندازه می‌گیرد. */
  ankle?: number; neck?: number;
};

/** تیپ مرجع؛ فقط برای تبدیل واحدهای کتابخانهٔ ژست به اندازهٔ واقعی عروسک به کار می‌رود. */
export const REF_BODY: BodySpec = { label: "مرجع", scale: 1, headR: 21, shoulder: 30, waist: 23, hip: 25, torso: 78, leg: 112, arm: 76, limb: 1, stoop: 0 };

export type Vec = { x: number; y: number };
export type HandShape = "relaxed" | "open" | "point" | "fist" | "hold";

export type Pose = {
  /** جابه‌جایی جانبی لگن (انتقال وزن). */
  hipX: number;
  /** پایین آمدن لگن (خم شدن زانوها). */
  hipDrop: number;
  /** خم شدن بالاتنه به جلو (درجه). */
  lean: number;
  /** کجی خط شانه (درجه). */
  tilt: number;
  /** بالا آمدن شانه‌ها. */
  shrug: number;
  /** کجی سر (درجه). */
  head: number;
  /** پایین/بالا بردن سر (‎-۱ تا ۱). */
  nod: number;
  /** هدف دست نسبت به شانهٔ خودش، به واحد «طول دست». */
  lHand: Vec;
  rHand: Vec;
  lShape: HandShape;
  rShape: HandShape;
  /** جابه‌جایی پا نسبت به جای ایستادن (x جلو، y منفی = بلند شدن از زمین). */
  lFoot: Vec;
  rFoot: Vec;
  /** زاویهٔ کف پا (درجه؛ مثبت = پنجه بالا). */
  lAng: number;
  rAng: number;
};

export const REST: Pose = {
  hipX: 0, hipDrop: 0, lean: 0, tilt: 0, shrug: 0, head: 0, nod: 0,
  lHand: { x: -0.07, y: 0.985 }, rHand: { x: 0.07, y: 0.985 }, lShape: "relaxed", rShape: "relaxed",
  lFoot: { x: 0, y: 0 }, rFoot: { x: 0, y: 0 }, lAng: 0, rAng: 0,
};

type Def = { label: string; pose: Partial<Pose>; held?: HeldId; wave?: boolean };

/** کتابخانهٔ ژست‌ها. هر ژست فقط تفاوتش با حالت ایستاده را می‌نویسد. */
export const POSES = {
  stand: { label: "ایستاده", pose: {} },
  relaxed: { label: "راحت (وزن روی یک پا)", pose: { hipX: -5, tilt: 2.5, head: -2, rFoot: { x: 7, y: 0 }, rHand: { x: 0.12, y: 0.97 } } },
  crossed: { label: "دست به سینه", pose: { lean: -1.5, hipX: -3, lHand: { x: 0.56, y: 0.44 }, rHand: { x: -0.5, y: 0.5 }, lShape: "fist", rShape: "fist" } },
  hips: { label: "دست به کمر", pose: { lHand: { x: 0.03, y: 0.79 }, rHand: { x: -0.03, y: 0.79 }, lShape: "fist", rShape: "fist", shrug: 1.5 } },
  explain: { label: "توضیح دادن", pose: { lean: 3, hipX: 2, head: 2, rHand: { x: 0.52, y: 0.4 }, rShape: "open" } },
  point: { label: "اشاره کردن", pose: { lean: 4.5, hipX: 4, rHand: { x: 0.97, y: 0.06 }, rShape: "point", rFoot: { x: 6, y: 0 } } },
  wave: { label: "دست تکان دادن", pose: { hipX: -2, tilt: -3, rHand: { x: 0.42, y: -0.72 }, rShape: "open" }, wave: true },
  think: { label: "فکر کردن", pose: { head: 6, nod: 0.18, hipX: -4, lHand: { x: 0.5, y: 0.52 }, rHand: { x: -0.17, y: -0.1 }, lShape: "fist", rShape: "fist" } },
  shrug: { label: "شانه بالا انداختن", pose: { shrug: 6, head: 5, lHand: { x: -0.5, y: 0.5 }, rHand: { x: 0.5, y: 0.5 }, lShape: "open", rShape: "open" } },
  cup: { label: "لیوان در دست", pose: { rHand: { x: 0.3, y: 0.42 }, rShape: "hold", hipX: -3 }, held: "cup" },
  sip: { label: "نوشیدن", pose: { rHand: { x: 0.06, y: -0.14 }, rShape: "hold", nod: -0.15, head: -3 }, held: "cup" },
  phone: { label: "نگاه به گوشی", pose: { rHand: { x: 0.2, y: 0.26 }, rShape: "hold", nod: 0.55, lean: 3 }, held: "phone" },
  listen: { label: "گوش دادن", pose: { lean: 5, head: 4, hipX: 3, lHand: { x: 0.34, y: 0.82 }, rHand: { x: -0.3, y: 0.84 } } },
  shock: { label: "جا خوردن", pose: { lean: -7, hipDrop: -2, shrug: 4, lHand: { x: -0.32, y: 0.02 }, rHand: { x: 0.34, y: -0.04 }, lShape: "open", rShape: "open" } },
  sad: { label: "غمگین و افتاده", pose: { lean: 8, nod: 0.6, shrug: -2, hipDrop: 2, lHand: { x: 0.02, y: 0.98 }, rHand: { x: -0.02, y: 0.98 } } },
  cheer: { label: "خوشحالی", pose: { hipDrop: -3, lean: -3, lHand: { x: -0.3, y: -0.92 }, rHand: { x: 0.3, y: -0.92 }, lShape: "fist", rShape: "fist" } },
} as const satisfies Record<string, Def>;

export type PoseId = keyof typeof POSES;
export const POSE_IDS = Object.keys(POSES) as PoseId[];

export function poseOf(id: PoseId): Pose {
  return { ...REST, ...(POSES[id] as Def).pose };
}

export function heldOf(id: PoseId): HeldId {
  return (POSES[id] as Def).held ?? "none";
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** نرم‌شدن در شروع و پایان. */
export const ease = (u: number) => u * u * (3 - 2 * u);
/** رسیدن با کمی ردکردن و برگشت (برای دست‌ها). */
export function easeOutBack(u: number, over = 1.25): number {
  const c = over + 1;
  return 1 + c * Math.pow(u - 1, 3) + over * Math.pow(u - 1, 2);
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpV = (a: Vec, b: Vec, k: number): Vec => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });

/** مدت پیش‌فرض گذار بین دو ژست (ثانیه). */
export const TRANSITION = 0.62;

/**
 * گذار از ژست a به b در لحظهٔ u (۰ تا ۱) با انتقال وزن:
 * سر ۰–۵۰٪، لگن و پا ۰–۶۰٪ (با یک فرو رفتن کوچک وزن)، ستون فقرات ۸–۷۵٪، دست‌ها ۱۸–۱۰۰٪ با ردکردن.
 */
export function transition(a: Pose, b: Pose, u: number): Pose {
  const t = clamp01(u);
  const kHip = ease(clamp01(t / 0.6));
  const kSpine = ease(clamp01((t - 0.08) / 0.67));
  const kHead = ease(clamp01(t / 0.5));
  const kArm = easeOutBack(clamp01((t - 0.18) / 0.82));
  const dip = Math.sin(Math.PI * clamp01(t / 0.55)) * 2.4;
  return {
    hipX: lerp(a.hipX, b.hipX, kHip),
    hipDrop: lerp(a.hipDrop, b.hipDrop, kHip) + dip,
    lean: lerp(a.lean, b.lean, kSpine),
    tilt: lerp(a.tilt, b.tilt, kSpine),
    shrug: lerp(a.shrug, b.shrug, kSpine),
    head: lerp(a.head, b.head, kHead),
    nod: lerp(a.nod, b.nod, kHead),
    lHand: lerpV(a.lHand, b.lHand, kArm),
    rHand: lerpV(a.rHand, b.rHand, kArm),
    lShape: t > 0.55 ? b.lShape : a.lShape,
    rShape: t > 0.55 ? b.rShape : a.rShape,
    lFoot: lerpV(a.lFoot, b.lFoot, kHip),
    rFoot: lerpV(a.rFoot, b.rFoot, kHip),
    lAng: lerp(a.lAng, b.lAng, kHip),
    rAng: lerp(a.rAng, b.rAng, kHip),
  };
}

export type PoseKey = { t: number; pose: PoseId };

/** ژست در لحظهٔ t از روی کلیدهای مرتب‌شده؛ قبل از اولین کلید همان کلید اول است. */
export function poseAt(keys: PoseKey[], t: number): { pose: Pose; id: PoseId; moving: boolean } {
  if (keys.length === 0) return { pose: REST, id: "stand", moving: false };
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].t <= t) i++;
  const cur = keys[i];
  if (i === 0 || t < cur.t) return { pose: poseOf(keys[0].pose), id: keys[0].pose, moving: false };
  const u = (t - cur.t) / keyDuration(keys, i);
  if (u >= 1) return { pose: poseOf(cur.pose), id: cur.pose, moving: false };
  return { pose: keyState(keys, i, t), id: cur.pose, moving: true };
}

/** مدت گذار کلید i: تا کلید بعدی کوتاه می‌شود ولی هرگز کمتر از ۰٫۲ ثانیه نیست. */
function keyDuration(keys: PoseKey[], i: number): number {
  const gap = i + 1 < keys.length ? keys[i + 1].t - keys[i].t : Infinity;
  return Math.max(0.2, Math.min(TRANSITION, gap));
}

/** ژست بدن در زمان t وقتی کلید i فعال است. اگر کلید قبلی هنوز کامل ننشسته بود، از همان‌جا که بود ادامه می‌دهیم (بدون پرش). */
function keyState(keys: PoseKey[], i: number, t: number): Pose {
  const cur = keys[i];
  const u = (t - cur.t) / keyDuration(keys, i);
  if (i === 0 || u >= 1) return poseOf(cur.pose);
  return transition(keyState(keys, i - 1, cur.t), poseOf(cur.pose), u);
}

/**
 * «مکث زنده»: نفس، تاب خوردن خیلی کم وزن، و هنگام حرف زدن ضرب سر و دست.
 * energy = باز بودن دهان گوینده (۰ تا ۱)؛ seed برای هم‌زمان نشدن دو نفر.
 */
export function alive(p: Pose, t: number, seed: number, energy = 0, id: PoseId = "stand"): Pose {
  const breath = Math.sin(t * 1.7 + seed * 2.1);
  const sway = Math.sin(t * 0.57 + seed * 4.3);
  const raised = (v: Vec) => (v.y < 0.75 ? 1 : 0.25);
  const beatX = Math.sin(t * 6.3 + seed) * energy;
  const beatY = Math.cos(t * 5.2 + seed * 1.7) * energy;
  const wave = (POSES[id] as Def).wave ? Math.sin(t * 9) * 0.13 : 0;
  return {
    ...p,
    hipX: p.hipX + sway * 1.3,
    shrug: p.shrug + breath * 0.9,
    head: p.head + Math.sin(t * 0.83 + seed * 3.1) * 1.1 + Math.sin(t * 5.1 + seed) * 1.6 * energy,
    nod: p.nod + 0.1 * energy * Math.sin(t * 7.4 + seed),
    lHand: { x: p.lHand.x + beatX * 0.02 * raised(p.lHand), y: p.lHand.y + breath * 0.006 + beatY * 0.03 * raised(p.lHand) },
    rHand: { x: p.rHand.x + wave + beatX * 0.035 * raised(p.rHand), y: p.rHand.y + breath * 0.006 + beatY * 0.045 * raised(p.rHand) },
  };
}

/* ---------- راه رفتن ---------- */

export const WALK = { stride: 34, stance: 0.58, cycle: 1.0, lift: 15, ramp: 0.4 } as const;
/** مسافتی که بدن در یک چرخهٔ کامل (دو قدم) جلو می‌رود، به واحد بدن؛ پا روی زمین سُر نمی‌خورد. */
export const WALK_DIST = (2 * WALK.stride) / WALK.stance;
/** سرعت راه رفتن (واحد بدن در ثانیه). */
export const WALK_SPEED = WALK_DIST / WALK.cycle;

function footAt(phase: number, k: number): { pos: Vec; ang: number } {
  const lp = ((phase % 1) + 1) % 1;
  const S = WALK.stride * k;
  if (lp < WALK.stance) {
    const u = lp / WALK.stance;
    const heel = u < 0.14 ? (1 - u / 0.14) * 16 : 0;
    const toe = u > 0.82 ? ((u - 0.82) / 0.18) * -24 : 0;
    return { pos: { x: S * (1 - 2 * u), y: toe ? toe * 0.12 * k : 0 }, ang: (heel + toe) * k };
  }
  const u = (lp - WALK.stance) / (1 - WALK.stance);
  return { pos: { x: -S + 2 * S * ease(u), y: -Math.sin(Math.PI * u) * WALK.lift * k }, ang: lerp(-24, 16, ease(u)) * k };
}

/** ژست راه رفتن در فاز phase (هر ۱ = دو قدم) با دامنهٔ k (۰ = ایستاده، ۱ = راه رفتن کامل). */
export function walkPose(phase: number, k: number): Pose {
  const l = footAt(phase, k);
  const r = footAt(phase + 0.5, k);
  const swing = Math.cos(phase * Math.PI * 2);
  return {
    ...REST,
    hipX: 0,
    // پایین‌ترین نقطه کمی بعد از فرود پاشنه (گرفتن وزن)، بالاترین در لحظهٔ رد شدن پاها.
    hipDrop: k * (2 + 2.6 * Math.cos(4 * Math.PI * (phase - 0.06))),
    lean: 4.5 * k,
    tilt: 2.4 * k * Math.sin(phase * Math.PI * 2),
    head: -1.4 * k * Math.sin(phase * Math.PI * 2),
    lHand: { x: REST.lHand.x * (1 - k) - 0.3 * swing * k, y: 0.985 - 0.07 * Math.abs(swing) * k },
    rHand: { x: REST.rHand.x * (1 - k) + 0.3 * swing * k, y: 0.985 - 0.07 * Math.abs(swing) * k },
    lFoot: l.pos,
    rFoot: r.pos,
    lAng: l.ang,
    rAng: r.ang,
  };
}

/**
 * برنامهٔ یک جابه‌جایی: مسافت dist (واحد بدن) با شتاب نرم در شروع و پایان.
 * خروجی: مسافت طی‌شده، دامنهٔ قدم و فاز چرخه در زمان t از شروع حرکت.
 */
export function walkPlan(dist: number): { duration: number; at: (t: number) => { s: number; k: number; phase: number } } {
  const d = Math.abs(dist);
  const ramp = Math.min(WALK.ramp, d / WALK_SPEED);
  const cruise = Math.max(0, (d - WALK_SPEED * ramp) / WALK_SPEED);
  const duration = d === 0 ? 0 : 2 * ramp + cruise;
  const at = (t: number) => {
    if (d === 0 || t <= 0) return { s: 0, k: 0, phase: 0 };
    if (t >= duration) return { s: d, k: 0, phase: (d / WALK_DIST) % 1 };
    let s: number;
    let k: number;
    if (t < ramp) {
      k = t / ramp;
      s = (WALK_SPEED * t * t) / (2 * ramp);
    } else if (t < ramp + cruise) {
      k = 1;
      s = (WALK_SPEED * ramp) / 2 + WALK_SPEED * (t - ramp);
    } else {
      const left = duration - t;
      k = left / ramp;
      s = d - (WALK_SPEED * left * left) / (2 * ramp);
    }
    return { s, k: ease(clamp01(k)), phase: s / WALK_DIST };
  };
  return { duration, at };
}

/* ---------- اسکلت ---------- */

export type Skeleton = {
  pelvis: Vec;
  chest: Vec;
  neck: Vec;
  head: Vec;
  /** زاویهٔ نهایی سر (درجه). */
  headAng: number;
  spineAng: number;
  l: Limbs;
  r: Limbs;
};
export type Limbs = { hip: Vec; knee: Vec; ankle: Vec; footAng: number; shoulder: Vec; elbow: Vec; wrist: Vec; armOver: boolean };

export const ANKLE_DEF = 7;
export const NECK_DEF = 13;
export const ANKLE = ANKLE_DEF;
export const NECK = NECK_DEF;

/** حل دو استخوان؛ bend جهت ترجیحی مفصل میانی است. طول‌ها هرگز تغییر نمی‌کنند (هدف دور، کوتاه می‌شود). */
export function ik(a: Vec, b: Vec, l1: number, l2: number, bend: Vec): { mid: Vec; end: Vec } {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  if (dx === 0 && dy === 0) dy = 0.001;
  let dist = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.02;
  const min = Math.abs(l1 - l2) + 0.02;
  const want = Math.max(min, Math.min(max, dist));
  dx *= want / dist;
  dy *= want / dist;
  dist = want;
  const base = Math.atan2(dy, dx);
  const ang = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))));
  const c1 = { x: a.x + Math.cos(base + ang) * l1, y: a.y + Math.sin(base + ang) * l1 };
  const c2 = { x: a.x + Math.cos(base - ang) * l1, y: a.y + Math.sin(base - ang) * l1 };
  const score = (c: Vec) => (c.x - a.x) * bend.x + (c.y - a.y) * bend.y;
  return { mid: score(c1) >= score(c2) ? c1 : c2, end: { x: a.x + dx, y: a.y + dy } };
}

const rot = (v: Vec, deg: number): Vec => {
  const a = (deg * Math.PI) / 180;
  return { x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) };
};
const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });

/**
 * مفصل‌ها در فضای پیکره. turn: ۰ = روبه‌رو، ۱ = نیم‌رخ کامل (پهنای شانه و لگن جمع می‌شود).
 * مبدأ روی زمین، زیر لگنِ حالت ایستاده است.
 */
export function solve(body: BodySpec, pose: Pose, turn: number): Skeleton {
  const ANKLE = body.ankle ?? ANKLE_DEF;
  const NECK = body.neck ?? NECK_DEF;
  const thigh = body.leg * 0.51;
  const shin = body.leg * 0.49;
  const upper = body.arm * 0.52;
  const fore = body.arm * 0.48;
  const side = 1 - 0.62 * turn;
  const stance = body.hip * 0.6 * (1 - 0.8 * turn) + 3 * (1 - turn);
  const hipOff = body.hip * 0.52 * side;
  // لگن آن‌قدر پایین می‌آید که هر دو پا به زمین برسند (انتقال وزن بدون کش آمدن یا بلند شدن پا).
  let pelvisY = -(body.leg + ANKLE) + 0.15 + pose.hipDrop;
  for (const s of [-1, 1]) {
    const foot = s < 0 ? pose.lFoot : pose.rFoot;
    if (foot.y < -0.5) continue; // پای در هوا مهم نیست
    const dx = s * stance + foot.x - (pose.hipX + s * hipOff);
    const reach = Math.sqrt(Math.max(1, (body.leg - 0.15) ** 2 - dx * dx));
    pelvisY = Math.max(pelvisY, -ANKLE + foot.y - reach);
  }
  const pelvis = { x: pose.hipX, y: pelvisY };
  const spineAng = pose.lean + body.stoop;
  const chest = add(pelvis, rot({ x: 0, y: -body.torso }, spineAng));
  const neck = add(chest, rot({ x: 0, y: -NECK * 0.4 }, spineAng));
  const headAng = spineAng * 0.35 + pose.head;
  const head = add(neck, rot({ x: 0, y: -(NECK * 0.6 + body.headR * 0.9) }, headAng));
  const limb = (s: -1 | 1): Limbs => {
    const foot = s < 0 ? pose.lFoot : pose.rFoot;
    const hand = s < 0 ? pose.lHand : pose.rHand;
    const hip = { x: pelvis.x + s * hipOff, y: pelvis.y };
    const ankleT = { x: s * stance + foot.x, y: -ANKLE + foot.y };
    // زانو همیشه رو به جلو خم می‌شود.
    const leg = ik(hip, ankleT, thigh, shin, { x: 0.35 + 0.65 * turn, y: -0.15 });
    const shoulder = add(chest, add(rot({ x: s * body.shoulder * side, y: 4 }, spineAng + pose.tilt), { x: 0, y: -pose.shrug }));
    const wristT = { x: shoulder.x + hand.x * body.arm, y: shoulder.y + hand.y * body.arm };
    // آرنج: پایین و به بیرون؛ در نیم‌رخ هر دو آرنج به عقب.
    const arm = ik(shoulder, wristT, upper, fore, { x: s < 0 ? -0.7 : 0.7 - 1.4 * turn, y: 1 });
    // دست نزدیک همیشه جلوی بدن است؛ دست دور فقط وقتی جلوی سینه آمده باشد.
    const armOver = s < 0 ? true : turn < 0.6 || (hand.x < 0.14 && hand.y < 0.9);
    return { hip, knee: leg.mid, ankle: leg.end, footAng: s < 0 ? pose.lAng : pose.rAng, shoulder, elbow: arm.mid, wrist: arm.end, armOver };
  };
  return { pelvis, chest, neck, head, headAng, spineAng, l: limb(-1), r: limb(1) };
}

/** قد پیکره از زمین تا بالای سر، به واحد بدن (بدون مقیاس). */
export function heightOf(body: BodySpec): number {
  return body.leg + (body.ankle ?? ANKLE_DEF) - 2 + body.torso + (body.neck ?? NECK_DEF) + body.headR * 1.9;
}
