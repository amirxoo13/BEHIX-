/**
 * پخش‌کنندهٔ صحنه‌های روایی آدمکی: هر نما چند بازیگر با «کلیدهای» زمان‌دار دارد
 * (ژست، حالت چهره، شیء در دست) و بین کلیدها نرم حرکت می‌کنند.
 * خروجی هر لحظه قطعی است (پلک و نفس از روی زمان حساب می‌شود)، پس رندر فیلم تکرارپذیر است.
 */
import { drawCaption } from "./caption.ts";
import { drawFigure, ease, joints, mixPose, type Ctx, type Expression, type Hold, type Look, type Pose } from "./figure.ts";
import { POSES, type PoseId } from "./poses.ts";
import { drawPaper } from "./paper.ts";
import { sideTable, sofaBack, sofaBase, sofaFront, steam, thoughtBubble, wallClock } from "./props.ts";

export type Key = {
  /** زمان از شروع نما (ثانیه). */
  t: number;
  pose: PoseId;
  face?: Expression;
  holdL?: Hold;
  holdR?: Hold;
  look?: number;
  /** مدت رسیدن از ژست قبلی به این ژست (ثانیه). */
  blend?: number;
};

export type ActorSpec = { look: Look; x: number; keys: Key[] };

export type ShotSpec = {
  start: number;
  end: number;
  caption: string;
  /** ظاهر شدن زیرنویس، از شروع نما. */
  captionAt: number;
  set: "sofa" | "plain";
  /** جای مبل (کسری از عرض) و اندازه‌اش؛ پیش‌فرض وسط و ۱٫۲. */
  sofa?: { x: number; s: number };
  clock?: boolean;
  table?: boolean;
  actors: ActorSpec[];
  zoom?: { from: number; to: number; cx: number; cy: number };
  thought?: { actor: number; start: number; full: number };
};

export const FRAME = { w: 1080, h: 1920, floor: 1340, captionY: 1500, scale: 2.4, sofa: 1.3 };

function actorState(a: ActorSpec, t: number, seed: number) {
  const keys = a.keys;
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].t <= t) i++;
  const k = keys[i];
  const prev = keys[Math.max(0, i - 1)];
  const blend = k.blend ?? 0.35;
  const u = i === 0 ? 1 : ease((t - k.t) / blend);
  const withLook = (p: Pose, kk: Key): Pose => ({ ...p, look: kk.look ?? p.look });
  let pose = mixPose(withLook(POSES[prev.pose], prev), withLook(POSES[k.pose], k), u);
  // نفس کشیدن و تکان ریز (زنده بودن)
  const breath = Math.sin(t * 2.1 + seed) * 0.8;
  pose = { ...pose, lean: pose.lean + breath * 0.6, tilt: pose.tilt + Math.sin(t * 1.3 + seed * 2) * 1.2 };
  // پلک زدن قطعی: هر ۲٫۶ تا ۳٫۸ ثانیه
  const period = 2.6 + (seed % 3) * 0.6;
  const ph = (t + seed * 0.9) % period;
  const blink = ph < 0.06 ? ph / 0.06 : ph < 0.14 ? 1 : ph < 0.2 ? 1 - (ph - 0.14) / 0.06 : 0;
  return {
    pose,
    face: (u < 0.5 && i > 0 ? prev.face : k.face) ?? "neutral",
    blink,
    talk: 0,
    holdL: (u < 0.5 && i > 0 ? prev.holdL : k.holdL) ?? "none",
    holdR: (u < 0.5 && i > 0 ? prev.holdR : k.holdR) ?? "none",
  };
}

/** پایین‌ترین نقطهٔ پا نسبت به لگن (برای ایستادن روی زمین). */
function footDrop(p: Pose) {
  const j = joints(p);
  return Math.max(j.legL.end.y, j.legR.end.y);
}

export function shotAt(shots: ShotSpec[], t: number): ShotSpec {
  return shots.find((s) => t >= s.start && t < s.end) ?? shots[shots.length - 1];
}

export function renderStick(ctx: Ctx, shots: ShotSpec[], t: number, paper: HTMLCanvasElement) {
  const { w, h, floor, scale } = FRAME;
  const shot = shotAt(shots, t);
  const lt = t - shot.start;
  const dur = shot.end - shot.start;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  drawPaper(ctx, paper);

  // دوربین: بزرگ‌نمایی آرام در طول نما
  if (shot.zoom) {
    const z = shot.zoom.from + (shot.zoom.to - shot.zoom.from) * ease(lt / dur);
    ctx.translate(shot.zoom.cx, shot.zoom.cy);
    ctx.scale(z, z);
    ctx.translate(-shot.zoom.cx, -shot.zoom.cy);
  }

  const sofaS = shot.sofa?.s ?? FRAME.sofa;
  const sofaX = w * (shot.sofa?.x ?? 0.5);
  // نشیمن مبل هم‌ارتفاع لگنِ آدم نشسته
  const seatTop = floor - footDrop(POSES.sit) * scale + 10 * scale;
  if (shot.clock) wallClock(ctx, w * 0.8, 560, 1, t);
  if (shot.set === "sofa") {
    sofaBack(ctx, sofaX, floor, seatTop, sofaS);
    sofaBase(ctx, sofaX, floor, seatTop, sofaS);
  }
  if (shot.table) {
    sideTable(ctx, w * 0.1, floor, 1);
    steam(ctx, w * 0.1, floor - 150 - 46, 1, t);
  }
  const states = shot.actors.map((a, i) => ({ a, st: actorState(a, lt, i * 3 + 1) }));
  const heads: { x: number; y: number }[] = [];
  for (const { a, st } of states) {
    const px = w * a.x;
    const py = floor - footDrop(st.pose) * scale;
    drawFigure(ctx, a.look, st, px, py, scale);
    const j = joints(st.pose);
    heads.push({ x: px + j.headC.x * scale, y: py + (j.headC.y - 44) * scale });
  }
  if (shot.set === "sofa") sofaFront(ctx, sofaX, floor, seatTop, sofaS);
  if (shot.thought) {
    const head = heads[shot.thought.actor];
    const g = (lt - shot.thought.start) / 0.6;
    const amount = Math.min(1, Math.max(0, (lt - shot.thought.start) / Math.max(0.1, shot.thought.full - shot.thought.start)));
    const cx = Math.min(w - 300, Math.max(300, head.x - 60));
    thoughtBubble(ctx, head.x, head.y - 10, cx, head.y - 260, 1, g, amount, t);
  }
  ctx.restore();
  drawCaption(ctx, shot.caption, w, FRAME.captionY, lt - shot.captionAt);
}
