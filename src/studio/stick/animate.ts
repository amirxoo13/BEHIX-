/**
 * از «کلیدهای» زمان‌دار به حالت لحظه‌ای هر آدمک، با اصول انیمیشن دستی:
 * - حرکت هم‌پوشان: بالاتنه اول، بعد بازو، بعد ساعد و سر با کمی تأخیر (overlapping action)
 * - پیش‌حرکت و جاافتادن در دست‌ها (anticipation / overshoot)
 * - انتقال تدریجی حالت چهره (نه پرش)
 * - راه رفتن با چرخهٔ پا و دست، بالا و پایین رفتن بدن
 * - نفس کشیدن، جابه‌جایی وزن، پلک زدن، نگاه کردن به کسی که حرف می‌زند
 * همه از روی زمان حساب می‌شود؛ هر فریم مستقل و تکرارپذیر است.
 */
import { FACES, mixFace, type Expression, type FaceParams } from "./face.ts";
import { ease, easeLively, type FigureState, type Hold, type Limb, type Pose } from "./figure.ts";
import { POSES, type PoseId } from "./poses.ts";

export type ActorKey = {
  /** زمان شروع این حالت (ثانیه از شروع صحنه). */
  t: number;
  pose: PoseId;
  face: Expression;
  holdL?: Hold;
  holdR?: Hold;
  /** جای افقی (۰ تا ۱ عرض قاب). اگر با کلید قبلی فرق کند، شخصیت راه می‌رود. */
  x: number;
  /** مدت رسیدن به این ژست (ثانیه). */
  blend?: number;
  /** مدت راه رفتن تا x تازه (ثانیه). */
  walk?: number;
};

/** بازه‌هایی که شخصیت حرف می‌زند (برای حرکت دهان). */
export type TalkSpan = { from: number; to: number };

export type ActorTrack = { keys: ActorKey[]; talk: TalkSpan[]; seed: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpLimb = (a: Limb, b: Limb, t: number): Limb => ({ a: lerp(a.a, b.a, t), b: lerp(a.b, b.b, t) });

/** عدد شبه‌تصادفی قطعی از یک عدد. */
export function hash(n: number) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function activeKey(keys: ActorKey[], t: number) {
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].t <= t) i++;
  return i;
}

/** ژست بین دو کلید با تأخیر جداگانهٔ هر مفصل. */
function layered(a: Pose, b: Pose, since: number, dur: number): Pose {
  const p = (delay: number) => ease((since - delay) / dur);
  const lively = (delay: number) => easeLively((since - delay) / (dur * 1.05), 0.7);
  const body = p(0);
  const upper = p(0.04);
  const fore = lively(0.09);
  const head = p(0.07);
  return {
    px: lerp(a.px, b.px, body),
    py: lerp(a.py, b.py, body),
    lean: lerp(a.lean, b.lean, body),
    tilt: lerp(a.tilt, b.tilt, head),
    armL: { a: lerp(a.armL.a, b.armL.a, upper), b: lerp(a.armL.b, b.armL.b, fore) },
    armR: { a: lerp(a.armR.a, b.armR.a, upper), b: lerp(a.armR.b, b.armR.b, fore) },
    legL: lerpLimb(a.legL, b.legL, body),
    legR: lerpLimb(a.legR, b.legR, body),
    thigh: lerp(a.thigh, b.thigh, body),
    look: lerp(a.look, b.look, head),
  };
}

/** چرخهٔ راه رفتن روی ژست ایستاده؛ `dir` جهت حرکت در قاب (۱ = به راست). */
export function walkPose(base: Pose, phase: number, dir: number, amount: number): Pose {
  const s = Math.sin(phase * Math.PI * 2);
  const c = Math.cos(phase * Math.PI * 2);
  const swing = 24 * amount;
  // در دید روبه‌رو، زاویهٔ «بیرون» برای پای چپ و راست برعکس است؛ پس برای حرکت هم‌جهت علامت فرق می‌کند.
  const legL: Limb = { a: lerp(base.legL.a, -dir * swing * s, amount), b: lerp(base.legL.b, -8 - Math.max(0, -s) * 22 * amount, amount) };
  const legR: Limb = { a: lerp(base.legR.a, dir * swing * -s, amount), b: lerp(base.legR.b, -8 - Math.max(0, s) * 22 * amount, amount) };
  const arm = 16 * amount;
  return {
    ...base,
    py: base.py - Math.abs(c) * 5 * amount,
    lean: base.lean + dir * 4 * amount,
    tilt: base.tilt - dir * 2 * amount,
    legL,
    legR,
    armL: { a: base.armL.a + dir * arm * s, b: base.armL.b - 6 * amount },
    armR: { a: base.armR.a - dir * arm * s, b: base.armR.b - 6 * amount },
  };
}

/** دهان هنگام حرف: هجاهای شبه‌تصادفی حدود ۷ بار در ثانیه با مکث‌های کوتاه بین کلمه‌ها. */
export function talkAmount(spans: TalkSpan[], t: number, seed: number): number {
  for (const s of spans) {
    if (t < s.from || t > s.to) continue;
    const rate = 7;
    const k = Math.floor((t - s.from) * rate);
    const u = (t - s.from) * rate - k;
    const amp = hash(k + seed * 13.7);
    const pause = hash(k * 0.37 + seed) < 0.16 ? 0.15 : 1;
    const env = Math.min(1, (t - s.from) / 0.08, (s.to - t) / 0.08);
    return Math.max(0, Math.sin(u * Math.PI) * (0.35 + amp * 0.65) * pause * env);
  }
  return 0;
}

export type ActorFrame = { state: FigureState; x: number; walking: boolean };

/**
 * حالت آدمک در لحظهٔ t. `lookAt` جای افقی کسی که الان حرف می‌زند (اگر کسی هست)، تا شنونده‌ها نگاهش کنند.
 */
export function actorAt(track: ActorTrack, t: number, lookAt: number | null): ActorFrame {
  const keys = track.keys;
  const i = activeKey(keys, t);
  const k = keys[i];
  const prev = keys[Math.max(0, i - 1)];
  const since = t - k.t;
  const blend = k.blend ?? 0.4;

  // جای افقی و راه رفتن
  let x = k.x;
  let walking = false;
  let walkAmt = 0;
  let dir = 1;
  let walkEnd = 0;
  if (i > 0 && prev.x !== k.x) {
    const wd = k.walk ?? Math.max(0.6, Math.abs(k.x - prev.x) * 3.2);
    walkEnd = wd;
    const u = Math.min(1, Math.max(0, since / wd));
    // شروع و پایان نرم راه رفتن
    const m = u < 1 ? u * u * (3 - 2 * u) : 1;
    x = lerp(prev.x, k.x, m);
    walking = u < 1;
    dir = k.x > prev.x ? 1 : -1;
    walkAmt = walking ? Math.min(1, u * 6, (1 - u) * 6) : 0;
  }

  // بعد از راه رفتن، ژست تازه از حالت ایستاده شروع می‌شود (نه از ژست قبل از راه رفتن).
  const from = i === 0 ? POSES[k.pose] : walkEnd > 0 ? POSES.stand : POSES[prev.pose];
  let pose = i === 0 ? POSES[k.pose] : layered(from, POSES[k.pose], since - walkEnd, blend);
  if (walkAmt > 0) {
    const stepsPerSec = 1.9;
    pose = walkPose({ ...POSES.stand, look: pose.look }, since * stepsPerSec, dir, walkAmt);
  }

  // زنده بودن: نفس، جابه‌جایی وزن، تکان ریز سر
  const s = track.seed;
  pose = {
    ...pose,
    lean: pose.lean + Math.sin(t * 1.7 + s) * 0.9,
    tilt: pose.tilt + Math.sin(t * 1.1 + s * 2.3) * 1.6,
    px: pose.px + Math.sin(t * 0.6 + s) * 1.5,
  };

  // نگاه: به کسی که حرف می‌زند، وگرنه نگاه ژست
  const talk = talkAmount(track.talk, t, s);
  const speaking = talk > 0 || track.talk.some((sp) => t >= sp.from && t <= sp.to);
  if (lookAt !== null && !speaking && !walking) {
    const want = Math.max(-0.8, Math.min(0.8, (lookAt - x) * 4));
    pose = { ...pose, look: want, tilt: pose.tilt + want * 4 };
  } else if (walking) {
    pose = { ...pose, look: dir * 0.7 };
  }
  // سر کمی همراه حرف زدن تکان می‌خورد
  if (speaking) pose = { ...pose, tilt: pose.tilt + Math.sin(t * 3.1 + s) * 2.5 };

  // چهره: انتقال تدریجی از حالت قبلی
  const fu = i === 0 ? 1 : ease(since / 0.3);
  const face: FaceParams = mixFace(FACES[prev.face], FACES[k.face], fu);

  // پلک زدن قطعی با فاصلهٔ نامنظم
  const period = 2.4 + hash(s) * 1.6;
  const n = Math.floor((t + s) / period);
  const off = hash(n + s * 7) * (period - 0.4);
  const ph = (t + s) - n * period - off;
  const blink = ph < 0 ? 0 : ph < 0.06 ? ph / 0.06 : ph < 0.13 ? 1 : ph < 0.2 ? 1 - (ph - 0.13) / 0.07 : 0;

  const holdSwitch = since < blend * 0.5 && i > 0;
  return {
    x,
    walking,
    state: {
      pose,
      face,
      blink,
      talk,
      holdL: (holdSwitch ? prev.holdL : k.holdL) ?? "none",
      holdR: (holdSwitch ? prev.holdR : k.holdR) ?? "none",
      time: t,
    },
  };
}
