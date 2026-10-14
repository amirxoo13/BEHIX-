import { findChar } from "./characters";
import { drawActor, type FaceDraw } from "./draw-actor";
import { SCROLLING, drawBackground } from "./draw-bg";
import { drawProps } from "./props";
import { readMouth } from "./audio";
import {
  blinkAt,
  groundPxPerSec,
  CYCLE_SEC,
  poseFront,
  poseWalk,
  pulseEnv,
  visemeFromText,
} from "./rig";
import type { Aspect, Shot, Viseme } from "./types";

export function canvasSize(aspect: Aspect) {
  if (aspect === "square") return { w: 1080, h: 1080 };
  if (aspect === "story") return { w: 1080, h: 1920 };
  return { w: 1280, h: 720 };
}

export function charScaleOf(h: number, aspect: Aspect) {
  if (aspect === "story") return h / 980;
  if (aspect === "square") return h / 700;
  return h / 560;
}

export function locate(shots: Shot[], elapsed: number) {
  let acc = 0;
  for (let i = 0; i < shots.length; i++) {
    const dur = shots[i].duration;
    if (elapsed < acc + dur) return { index: i, local: elapsed - acc };
    acc += dur;
  }
  return null;
}

export function totalDuration(shots: Shot[]) {
  return shots.reduce((s, sh) => s + sh.duration, 0);
}

function applyCamera(
  ctx: CanvasRenderingContext2D,
  shot: Shot,
  local: number,
  w: number,
  h: number,
) {
  let z = 1;
  let fx = w * 0.5;
  let fy = h * 0.58;
  if (shot.camera === "medium") z = 1.22;
  if (shot.camera === "closeLeft") {
    z = 1.75;
    fx = w * 0.32;
    fy = h * 0.46;
  }
  if (shot.camera === "closeRight") {
    z = 1.75;
    fx = w * 0.7;
    fy = h * 0.46;
  }
  if (shot.camera === "push") {
    z = 1 + 0.32 * Math.min(1, local / Math.max(0.2, shot.duration));
    fx = shot.speaker === "b" ? w * 0.68 : w * 0.34;
  }
  if (shot.camera === "comic") {
    z = 1.95;
    fx = shot.speaker === "b" ? w * 0.7 : w * 0.32;
    fy = h * 0.42;
    ctx.translate(Math.sin(local * 42) * 5, Math.cos(local * 37) * 4);
  }
  ctx.translate(fx, fy);
  ctx.scale(z, z);
  ctx.translate(-fx, -fy);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(next).width > max && cur) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

function caption(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  name: string,
  text: string,
) {
  if (!text.trim()) return;
  const boxH = Math.max(78, h * 0.13);
  const y = h - boxH - Math.max(12, h * 0.02);
  ctx.fillStyle = "rgba(18,16,12,0.9)";
  ctx.strokeStyle = "#e4b15a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(18, y, w - 36, boxH, 14);
  ctx.fill();
  ctx.stroke();
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#e4b15a";
  ctx.font = `700 ${Math.round(Math.max(16, h * 0.028))}px Vazirmatn, Tahoma, sans-serif`;
  ctx.fillText(name, w / 2, y + boxH * 0.34);
  ctx.fillStyle = "#f6f0e6";
  const size = Math.round(Math.max(18, h * 0.03));
  ctx.font = `700 ${size}px Vazirmatn, Tahoma, sans-serif`;
  const lines = wrapLines(ctx, text, w - 72);
  lines.forEach((line, i) => ctx.fillText(line, w / 2, y + boxH * 0.64 + i * (size + 4)));
}

export function scrollFor(now: number, shot: Shot, scale: number) {
  if (!SCROLLING.has(shot.background)) return 0;
  const a = shot.actorA.action === "walk";
  const b = shot.actorB.action === "walk";
  const phase = now / 1000 / CYCLE_SEC;
  const px = phase * groundPxPerSec(scale) * CYCLE_SEC;
  if (a && !b) return px;
  if (b && !a) return -px;
  return 0;
}

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  shot: Shot,
  opts: {
    now: number;
    local: number;
    dt: number;
    aspect: Aspect;
    showRig: boolean;
    pulses: { a: number; b: number };
    speakingLive: boolean;
    /** T11: دهان از مسیر صدای ضبط‌شده (رندر آفلاین). null/undefined = رفتار قبلی. */
    audioMouth?: { viseme: Viseme; open: number } | null;
  },
) {
  const { w, h } = { w: ctx.canvas.width, h: ctx.canvas.height };
  const scale = charScaleOf(h, opts.aspect);
  const footY = opts.aspect === "story" ? h * 0.7 : h * 0.8;
  const time = opts.now / 1000;
  const live = opts.speakingLive ? readMouth() : null;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  applyCamera(ctx, shot, opts.local, w, h);
  const scroll = scrollFor(opts.now, shot, scale);
  drawBackground(ctx, shot.background, w, h, scroll, time, {
    variant: shot.variant,
    night: shot.night,
  });
  drawProps(ctx, shot.props, "back", w, footY, scale, scroll);

  type Slot = {
    id: string;
    actor: Shot["actorA"];
    x: number;
    foot: number;
    sc: number;
    inner: number;
    pulse: number;
    talking: boolean;
    seed: number;
  };
  // حاضرین اضافه عقب‌تر و کمی کوچک‌تر، اول کشیده می‌شوند تا پشت دو بازیگر اصلی باشند.
  const depth = h * 0.05;
  const extraX = [0.51, 0.12, 0.9];
  const slots: Slot[] = shot.extras.map((actor, i) => ({
    id: `x${i}`,
    actor,
    x: w * extraX[i % extraX.length],
    foot: footY - depth,
    sc: scale * 0.86,
    inner: extraX[i % extraX.length] < 0.5 ? 1 : -1,
    pulse: 0,
    talking: false,
    seed: 2 + i,
  }));
  slots.push(
    { id: "a", actor: shot.actorA, x: w * 0.3, foot: footY, sc: scale, inner: 1, pulse: opts.pulses.a, talking: shot.speaker === "a", seed: 0 },
    { id: "b", actor: shot.actorB, x: w * 0.72, foot: footY, sc: scale, inner: -1, pulse: opts.pulses.b, talking: shot.speaker === "b", seed: 1 },
  );
  for (const s of slots) {
    const char = findChar(s.actor.charId);
    const env = pulseEnv(s.pulse, opts.now);
    // فاز متفاوت فقط برای حاضرین اضافه تا همه هم‌زمان تکان نخورند؛ دو بازیگر اصلی مثل قبل.
    const off = s.seed >= 2 ? s.seed : 0;
    const phase = time / CYCLE_SEC + off * 0.37;
    const walking = s.actor.action === "walk";
    const pose = walking
      ? poseWalk(phase, s.actor.emotion, env, time)
      : poseFront(s.actor.action, s.actor.emotion, env, time + off * 0.9, s.inner);
    const mouth = s.talking
      ? live ?? opts.audioMouth ?? visemeFromText(shot.dialogue, opts.local, shot.duration)
      : { viseme: "rest" as Viseme, open: 0 };
    const face: FaceDraw = {
      blink: blinkAt(time + s.seed * 0.7, s.actor.emotion, s.seed),
      viseme: mouth.viseme,
      open: mouth.open,
      emotion: s.actor.emotion,
      env,
    };
    const shake = s.actor.emotion === "angry" ? Math.sin(time * 28) * 5 * (0.35 + env) : 0;
    const gesture = s.actor.action === "tea" || s.actor.action === "point" ? s.actor.action : "none";
    drawActor(
      ctx,
      char,
      pose,
      face,
      s.x + shake,
      s.foot,
      s.sc,
      walking ? s.inner : 1,
      opts.showRig,
      `${shot.id}-${s.id}`,
      opts.dt,
      walking ? "none" : gesture,
      s.inner,
    );
  }
  drawProps(ctx, shot.props, "front", w, footY, scale, scroll);
  ctx.restore();

  if (shot.speaker !== "none" && shot.dialogue.trim()) {
    const who = shot.speaker === "a" ? shot.actorA : shot.actorB;
    caption(ctx, w, h, findChar(who.charId).name, shot.dialogue);
  }
}
