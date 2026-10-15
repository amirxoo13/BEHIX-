/**
 * کشیدن یک لحظه از فیلم داستانی: مکان، شخصیت‌ها، حباب فکر، دوربین و زیرنویس.
 * ورودی «خط زمان» است که کارگردان خودکار (story-direct.ts) از روی داستان می‌سازد.
 */
import { actorAt, type ActorTrack } from "./animate.ts";
import { drawCaption } from "./caption.ts";
import { BODY, drawFigure, ease, joints, kindScale, type Look, type Pose } from "./figure.ts";
import { drawPaper } from "./paper.ts";
import { NIGHT_FILL, PAPER, PLACES, nightPaper, type Env, type PlaceId } from "./places.ts";
import { POSES } from "./poses.ts";
import { thoughtBubble } from "./props.ts";

export const FRAME = { w: 1080, h: 1920, floor: 1340, captionY: 1560, scale: 2.4 };

export type CastMember = { id: string; name: string; look: Look };

export type CameraKey = { t: number; zoom: number; cx: number; cy: number };

export type Caption = { from: number; to: number; text: string };

export type Thought = { actor: string; from: number; to: number };

export type SceneActor = { cast: string; track: ActorTrack };

export type SceneTimeline = {
  start: number;
  end: number;
  place: PlaceId;
  night: boolean;
  actors: SceneActor[];
  captions: Caption[];
  cameras: CameraKey[];
  thoughts: Thought[];
  /** چه کسی در هر بازه حرف می‌زند (برای نگاه شنونده‌ها). */
  speakers: { from: number; to: number; cast: string }[];
};

export type Timeline = { scenes: SceneTimeline[]; cast: CastMember[]; duration: number };

/** پایین‌ترین نقطهٔ پا نسبت به لگن. */
export function footDrop(p: Pose) {
  const j = joints(p);
  return Math.max(j.legL.end.y, j.legR.end.y);
}

/** ارتفاع روی نشیمن صندلی/مبل (هم‌ارتفاع لگن بزرگسالِ نشسته). */
export const SEAT_TOP = FRAME.floor - footDrop(POSES.sit) * FRAME.scale + 10 * FRAME.scale;

export function sceneAt(tl: Timeline, t: number): SceneTimeline {
  return tl.scenes.find((s) => t >= s.start && t < s.end) ?? tl.scenes[tl.scenes.length - 1];
}

function cameraAt(keys: CameraKey[], t: number): CameraKey {
  if (keys.length === 0) return { t: 0, zoom: 1, cx: FRAME.w / 2, cy: 1000 };
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].t <= t) i++;
  const a = keys[i];
  const b = keys[i + 1];
  if (!b) return a;
  // حرکت دوربین نرم در ۰٫۶ ثانیهٔ آخر قبل از کلید بعد
  const u = ease((t - (b.t - 0.6)) / 0.6);
  return {
    t,
    zoom: a.zoom + (b.zoom - a.zoom) * u,
    cx: a.cx + (b.cx - a.cx) * u,
    cy: a.cy + (b.cy - a.cy) * u,
  };
}

export function renderStory(ctx: CanvasRenderingContext2D, tl: Timeline, t: number, paper: HTMLCanvasElement, opts: { captions: boolean } = { captions: true }) {
  const { w, h, floor, scale } = FRAME;
  const scene = sceneAt(tl, t);
  const lt = t - scene.start;
  const place = PLACES[scene.place];
  const env: Env = { w, h, floor, seatTop: SEAT_TOP, night: scene.night, t: lt, fill: scene.night ? NIGHT_FILL : PAPER };

  ctx.save();
  ctx.clearRect(0, 0, w, h);
  drawPaper(ctx, paper);
  if (scene.night) nightPaper(ctx, w, h);

  const cam = cameraAt(scene.cameras, lt);
  // لرزش خیلی ریز دوربین دستی برای زنده بودن
  const sway = Math.sin(lt * 0.9) * 2;
  ctx.translate(cam.cx + sway, cam.cy);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.cx, -cam.cy);

  place.back(ctx, env);

  const speaker = scene.speakers.find((s) => lt >= s.from && lt <= s.to);
  const frames = scene.actors.map((a) => {
    const member = tl.cast.find((c) => c.id === a.cast);
    const speakerX = speaker && speaker.cast !== a.cast ? scene.actors.find((x) => x.cast === speaker.cast) : undefined;
    const lookAt = speakerX ? actorAt(speakerX.track, lt, null).x : null;
    return { a, member, f: actorAt(a.track, lt, lookAt) };
  });
  // نشسته‌ها بین مبل/صندلی و لایهٔ جلو (دسته‌ها، میز)؛ ایستاده‌ها جلوی همه‌چیز
  const heads = new Map<string, { x: number; y: number }>();
  const draw = (sittingPass: boolean) => {
    for (const { a, member, f } of frames) {
      if (!member) continue;
      const sitting = f.state.pose.thigh < 0.7;
      if (sitting !== sittingPass) continue;
      const sc = scale * kindScale(member.look.kind);
      const px = w * f.x;
      // نشسته: لگن روی نشیمن (پای بچه آویزان می‌ماند)؛ ایستاده: کف پا روی زمین
      const py = sitting ? SEAT_TOP - 10 * scale : floor - footDrop(f.state.pose) * sc;
      drawFigure(ctx, member.look, f.state, px, py, sc);
      const j = joints(f.state.pose);
      heads.set(a.cast, { x: px + j.headC.x * sc, y: py + (j.headC.y - BODY.headR) * sc });
    }
  };
  draw(true);
  place.front?.(ctx, env);
  draw(false);

  for (const th of scene.thoughts) {
    if (lt < th.from || lt > th.to + 0.3) continue;
    const head = heads.get(th.actor);
    if (!head) continue;
    const out = lt > th.to ? 1 - (lt - th.to) / 0.3 : 1;
    const g = ((lt - th.from) / 0.6) * out;
    const amount = Math.min(1, (lt - th.from) / Math.max(0.5, th.to - th.from));
    const cx = Math.min(w - 290, Math.max(290, head.x));
    ctx.save();
    ctx.globalAlpha = Math.max(0, out);
    thoughtBubble(ctx, head.x, head.y - 10, cx, Math.max(300, head.y - 270), 1, g, amount, lt);
    ctx.restore();
  }

  ctx.restore();

  if (opts.captions) {
    const cap = scene.captions.find((c) => lt >= c.from && lt < c.to);
    if (cap) drawCaption(ctx, cap.text, w, FRAME.captionY, lt - cap.from);
  }

  // محو کوتاه در شروع و پایان هر صحنه (برش نرم)
  const fadeIn = Math.min(1, lt / 0.25);
  const fadeOut = Math.min(1, (scene.end - t) / 0.25);
  const veil = 1 - Math.min(fadeIn, fadeOut);
  if (veil > 0.001) {
    ctx.fillStyle = `rgba(245,245,243,${veil})`;
    ctx.fillRect(0, 0, w, h);
  }
}
