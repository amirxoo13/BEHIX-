/**
 * بازیگر ریگ: اجرای یک شخصیت ریگ‌شده از روی کلیدهای زمانی، کاملاً «بسته» (closed-form).
 * actorAt(track, t) فقط تابع زمان است: بدون حالت، بدون تصادف و بدون وابستگی به فریم قبلی؛
 * پس پیش‌نمایش، پرش روی تایم‌لاین و خروجی فریم‌به‌فریم (حتی نامرتب) دقیقاً یکسان‌اند.
 *
 * - ژست: poseAt (گذار پله‌ای سر ← لگن ← ستون ← دست) + alive (نفس، تاب، ضرب حرف).
 * - جابه‌جایی: هر کلیدی که x را عوض کند یک راه رفتن بدون سُر خوردن (walkPlan/walkPose) می‌سازد
 *   که با دامنهٔ k روی ژست پایه مخلوط می‌شود؛ k از صفر شروع می‌شود، پس شروع و پایان راه رفتن پرش ندارد.
 * - دهان: بازه‌های VisemeSpan (ثانیه) از راه visemeAt، با هم‌آمیزی ≤ ۶۰ میلی‌ثانیه.
 * - کشیدن: drawPuppet + تصویر دهان از هر شکل موجود (با زنجیرهٔ جایگزین) یا دهان سادهٔ رویه‌ای.
 */
import { POSES, alive, poseAt, walkPlan, walkPose, type Pose, type PoseId, type PoseKey, type Vec } from "./pose.ts";
import { drawPuppet, puppetHeight, type PuppetRig } from "./puppet.ts";
import { resolveViseme, visemeAt, visemeOpen, type VisemeId, type VisemeSample, type VisemeSpan } from "./mouth.ts";

export type Facing = 1 | -1;

/** یک کلید بازیگر؛ هر فیلدِ نیامده از کلید قبلی ادامه پیدا می‌کند. */
export type ActorKey = {
  /** ثانیه از شروع نما. */
  t: number;
  pose?: PoseId;
  /** جای کف پا روی صحنه (هر واحدی؛ با unitsPerBody به واحد بدن تبدیل می‌شود). */
  x?: number;
  face?: Facing;
  /** ۰ = روبه‌رو، ۱ = نیم‌رخ. */
  turn?: number;
};

export type ActorTrack = {
  keys: readonly ActorKey[];
  /** بازه‌های دهان (خروجی normalizeSpans). */
  speech?: readonly VisemeSpan[];
  /** برای هم‌زمان نشدن نفس و تاب دو بازیگر. */
  seed?: number;
  /** طول هم‌آمیزی دهان (ثانیه، حداکثر ۰٫۰۶). */
  crossfade?: number;
  /** چند واحد x برابر یک واحد بدن است (مثلاً پیکسل روی بوم ÷ واحد بدن)؛ پیش‌فرض ۱. */
  unitsPerBody?: number;
};

export type ActorFrame = {
  pose: Pose;
  poseId: PoseId;
  x: number;
  facing: Facing;
  turn: number;
  /** دامنهٔ راه رفتن (۰ ایستاده تا ۱). */
  walk: number;
  mouth: VisemeSample;
  /** بازشدگی دهان (۰ تا ۱) با احتساب هم‌آمیزی. */
  open: number;
};

const DEFAULT_TURN = 0.35;
/** چرخش بدن هنگام راه رفتن به سمت نیم‌رخ. */
const WALK_TURN = 0.8;

type Walk = { units: number; t0: number; x0: number; x1: number; dir: Facing; plan: ReturnType<typeof walkPlan> };
type Compiled = { units: number; poseKeys: PoseKey[]; walks: Walk[]; faces: { t: number; face: Facing }[]; turns: { t: number; turn: number }[]; x0: number };

const cache = new WeakMap<readonly ActorKey[], Compiled>();

function compile(keys: readonly ActorKey[], unitsPerBody: number): Compiled {
  // کلیدها تغییرناپذیر فرض می‌شوند (آرایهٔ تازه = کلیدهای تازه).
  const hit = cache.get(keys);
  if (hit && hit.units === unitsPerBody) return hit;
  const sorted = keys.map((k, i) => ({ k, i })).sort((a, b) => a.k.t - b.k.t || a.i - b.i).map((e) => e.k);
  const poseKeys: PoseKey[] = [];
  const walks: Walk[] = [];
  const faces: { t: number; face: Facing }[] = [];
  const turns: { t: number; turn: number }[] = [];
  const x0 = sorted.find((k) => k.x !== undefined)?.x ?? 0;
  let lastX = x0;
  for (const k of sorted) {
    if (k.pose && poseKeys.at(-1)?.pose !== k.pose) poseKeys.push({ t: k.t, pose: k.pose });
    if (k.face) faces.push({ t: k.t, face: k.face });
    if (k.turn !== undefined) turns.push({ t: k.t, turn: Math.max(0, Math.min(1, k.turn)) });
    if (k.x !== undefined && k.x !== lastX) {
      // اگر راه رفتن قبلی هنوز تمام نشده، از همان جایی که بدن هست شروع می‌کنیم
      // (مکان پیوسته است؛ دامنهٔ قدم از نو شروع می‌شود، پس کلیدهای x را دست‌کم یک راه رفتن کامل فاصله بدهید).
      const from = walks.length ? walkX(walks, k.t, x0) : lastX;
      const dist = (k.x - from) / unitsPerBody;
      walks.push({ units: unitsPerBody, t0: k.t, x0: from, x1: k.x, dir: k.x >= from ? 1 : -1, plan: walkPlan(dist) });
      lastX = k.x;
    }
  }
  const c = { units: unitsPerBody, poseKeys, walks, faces, turns, x0 };
  cache.set(keys, c);
  return c;
}

function activeWalk(walks: Walk[], t: number): Walk | null {
  let w: Walk | null = null;
  for (const v of walks) if (v.t0 <= t) w = v;
  return w;
}

function walkX(walks: Walk[], t: number, x0: number): number {
  const w = activeWalk(walks, t);
  if (!w) return x0;
  // s در واحد بدن است؛ در پایان دقیقاً روی x1 می‌نشیند.
  if (t - w.t0 >= w.plan.duration) return w.x1;
  const { s } = w.plan.at(t - w.t0);
  return w.x0 + w.dir * s * w.units;
}

function lastAt<T extends { t: number }>(list: T[], t: number): T | undefined {
  let r: T | undefined;
  for (const v of list) if (v.t <= t) r = v;
  return r ?? list[0];
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerpV = (a: Vec, b: Vec, k: number): Vec => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) });

/** مخلوط ژست پایه با ژست راه رفتن؛ k = 0 دقیقاً همان ژست پایه است. */
export function blendPose(a: Pose, b: Pose, k: number): Pose {
  if (k <= 0) return a;
  return {
    hipX: lerp(a.hipX, b.hipX, k), hipDrop: lerp(a.hipDrop, b.hipDrop, k), lean: lerp(a.lean, b.lean, k),
    tilt: lerp(a.tilt, b.tilt, k), shrug: lerp(a.shrug, b.shrug, k), head: lerp(a.head, b.head, k), nod: lerp(a.nod, b.nod, k),
    lHand: lerpV(a.lHand, b.lHand, k), rHand: lerpV(a.rHand, b.rHand, k),
    lShape: k > 0.5 ? b.lShape : a.lShape, rShape: k > 0.5 ? b.rShape : a.rShape,
    lFoot: lerpV(a.lFoot, b.lFoot, k), rFoot: lerpV(a.rFoot, b.rFoot, k), lAng: lerp(a.lAng, b.lAng, k), rAng: lerp(a.rAng, b.rAng, k),
  };
}

/** حالت کامل بازیگر در لحظهٔ t. */
export function actorAt(track: ActorTrack, t: number): ActorFrame {
  const c = compile(track.keys, track.unitsPerBody ?? 1);
  const seed = track.seed ?? 0;
  const mouth = track.speech?.length ? visemeAt(track.speech, t, track.crossfade ?? 0) : { id: "rest" as VisemeId, weight: 1, from: null, fromWeight: 0 };
  const open = visemeOpen(mouth.id) * mouth.weight + (mouth.from ? visemeOpen(mouth.from) * mouth.fromWeight : 0);
  const base = poseAt(c.poseKeys, t);
  // دست‌های ژست‌هایی که شیء در دست دارند هنگام راه رفتن هم سر جایشان می‌مانند.
  const lived = alive(base.pose, t, seed, open, base.id);
  const w = activeWalk(c.walks, t);
  const st = w ? w.plan.at(t - w.t0) : { s: 0, k: 0, phase: 0 };
  let pose = st.k > 0 ? blendPose(lived, walkPose(st.phase, st.k), st.k) : lived;
  if (st.k > 0 && "held" in POSES[base.id]) pose = { ...pose, rHand: lived.rHand, rShape: lived.rShape };
  const baseTurn = lastAt(c.turns, t)?.turn ?? DEFAULT_TURN;
  const keyFace = lastAt(c.faces, t);
  // جهت: هنگام راه رفتن رو به مقصد؛ بعد از آن تا کلید جهت بعدی همان جهت می‌ماند.
  let facing: Facing = keyFace?.face ?? 1;
  if (w && (!keyFace || keyFace.t <= w.t0)) facing = w.dir;
  return {
    pose,
    poseId: base.id,
    x: walkX(c.walks, t, c.x0),
    facing,
    turn: lerp(baseTurn, Math.max(baseTurn, WALK_TURN), st.k),
    walk: st.k,
    mouth,
    open,
  };
}

/* ---------- کشیدن ---------- */

export type MouthSprite = { img: CanvasImageSource; sw: number; sh: number };

export type ActorDraw = {
  groundY: number;
  /** قد روی بوم (پیکسل). */
  height: number;
  /** x کف پا روی بوم = originX + frame.x * xScale. */
  originX?: number;
  xScale?: number;
  shadow?: boolean;
  /** تصویر شکل‌های دهان؛ شکلِ نبود از زنجیرهٔ جایگزین پر می‌شود و اگر هیچ نبود دهان ساده کشیده می‌شود. */
  mouths?: Partial<Record<VisemeId, MouthSprite>>;
  /** مرکز دهان و عرض آن در پیکسل تصویر مرجع (پیش‌فرض: تخمین از روی مفاصل سر). */
  mouthAt?: Vec;
  mouthWidth?: number;
  /** رنگ دهان ساده. */
  mouthColor?: string;
};

/** مرکز دهان و پهنای پیش‌فرض، از روی مفاصل سر در تصویر مرجع. */
export function defaultMouth(rig: PuppetRig): { at: Vec; width: number } {
  const c = rig.joints.headCenter, ch = rig.joints.chin;
  const headH = Math.hypot(ch.x - c.x, ch.y - c.y) || puppetHeight(rig) * 0.06;
  return { at: { x: lerp(c.x, ch.x, 0.62), y: lerp(c.y, ch.y, 0.62) }, width: headH * 0.55 };
}

export function drawActor(ctx: CanvasRenderingContext2D, rig: PuppetRig, img: CanvasImageSource, frame: ActorFrame, o: ActorDraw) {
  const est = defaultMouth(rig);
  const at = o.mouthAt ?? est.at;
  const mw = o.mouthWidth ?? est.width;
  const sprites = o.mouths ?? {};
  const has = (v: VisemeId) => !!sprites[v];
  const anySprite = Object.keys(sprites).length > 0;
  const face = (c: CanvasRenderingContext2D) => {
    if (anySprite) {
      const layers: [VisemeId, number][] = frame.mouth.from ? [[frame.mouth.from, frame.mouth.fromWeight], [frame.mouth.id, frame.mouth.weight]] : [[frame.mouth.id, 1]];
      for (const [id, a] of layers) {
        const sp = sprites[resolveViseme(id, has)];
        if (!sp || a <= 0) continue;
        const h = (mw * sp.sh) / sp.sw;
        c.save();
        c.globalAlpha *= a;
        c.drawImage(sp.img, 0, 0, sp.sw, sp.sh, at.x - mw / 2, at.y - h / 2, mw, h);
        c.restore();
      }
      return;
    }
    // دهان ساده: خط برای بسته، بیضی برای باز.
    c.save();
    c.fillStyle = c.strokeStyle = o.mouthColor ?? "#5a2a2a";
    if (frame.open < 0.05) {
      c.lineWidth = Math.max(1, mw * 0.08);
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(at.x - mw * 0.32, at.y);
      c.lineTo(at.x + mw * 0.32, at.y);
      c.stroke();
    } else {
      const wide = frame.mouth.id === "ee" || frame.mouth.id === "wide" || frame.mouth.id === "sz" ? 1.15 : frame.mouth.id === "oo" || frame.mouth.id === "oh" ? 0.6 : 0.9;
      c.beginPath();
      c.ellipse(at.x, at.y + mw * 0.1 * frame.open, (mw / 2) * wide * 0.8, Math.max(0.5, mw * 0.42 * frame.open), 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  };
  drawPuppet(ctx, rig, img, frame.pose, frame.turn, {
    x: (o.originX ?? 0) + frame.x * (o.xScale ?? 1),
    groundY: o.groundY,
    height: o.height,
    facing: frame.facing,
    shadow: o.shadow,
    face,
  });
}
