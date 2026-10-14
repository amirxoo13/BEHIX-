import type { Action, Emotion, Viseme } from "./types";

export const INK = "#1a120c";

export const RIG = {
  thigh: 46,
  shin: 44,
  upper: 38,
  fore: 32,
  hipY: -84,
  shoulderY: -148,
  headY: -184,
  headR: 32,
};

export const STRIDE = 24;
export const CYCLE_SEC = 0.78;
const STANCE = 0.55;

export type Pt = { x: number; y: number };

export function solve2(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  len1: number,
  len2: number,
  score: (x: number, y: number) => number,
): Pt & { ex: number; ey: number } {
  let dx = x2 - x1;
  let dy = y2 - y1;
  let dist = Math.hypot(dx, dy) || 0.0001;
  const max = len1 + len2 - 0.01;
  const min = Math.abs(len1 - len2) + 0.01;
  if (dist > max) {
    dx *= max / dist;
    dy *= max / dist;
    dist = max;
  } else if (dist < min) {
    dx *= min / dist;
    dy *= min / dist;
    dist = min;
  }
  const ex = x1 + dx;
  const ey = y1 + dy;
  const base = Math.atan2(dy, dx);
  const cosA = (len1 * len1 + dist * dist - len2 * len2) / (2 * len1 * dist);
  const ang = Math.acos(Math.min(1, Math.max(-1, cosA)));
  const cands = [base + ang, base - ang].map((a) => ({
    x: x1 + Math.cos(a) * len1,
    y: y1 + Math.sin(a) * len1,
  }));
  const mid = score(cands[0].x, cands[0].y) >= score(cands[1].x, cands[1].y) ? cands[0] : cands[1];
  return { x: mid.x, y: mid.y, ex, ey };
}

export function groundPxPerSec(scale: number): number {
  const localPerCycle = (2 * STRIDE) / STANCE;
  return (localPerCycle / CYCLE_SEC) * scale;
}

function footRel(phase: number, offset: number): Pt {
  const lp = (((phase + offset) % 1) + 1) % 1;
  if (lp < STANCE) {
    const u = lp / STANCE;
    return { x: STRIDE * (1 - 2 * u), y: 0 };
  }
  const u = (lp - STANCE) / (1 - STANCE);
  const su = u * u * (3 - 2 * u);
  return {
    x: -STRIDE + 2 * STRIDE * su,
    y: -Math.sin(Math.PI * u) * 20,
  };
}

export type Limb = { hip: Pt; knee: Pt; foot: Pt; shoulder: Pt; elbow: Pt; hand: Pt };

export type BodyPose = {
  drop: number;
  sway: number;
  torso: number;
  head: number;
  left: Limb;
  right: Limb;
  profile: boolean;
};

function armTarget(
  action: Action,
  time: number,
  side: number,
  active: boolean,
  shoulder: Pt,
): Pt {
  const wave = Math.sin(time * 7) * 7;
  if (!active || action === "idle" || action === "walk") {
    return { x: side * 48, y: -96 };
  }
  if (action === "point") return { x: side * 92, y: -112 + wave };
  if (action === "tea") return { x: side * 62, y: -102 + Math.sin(time * 3) * 3 };
  if (action === "hips") return { x: side * 32, y: -86 };
  return { x: side * 18, y: -168 };
}

export function emotionDrop(emotion: Emotion, env: number, time: number): number {
  if (emotion === "laugh") return 8 * (0.65 + 0.35 * Math.sin(time * 14)) * (0.35 + env);
  if (emotion === "cry") return 7 * (0.5 + 0.5 * env);
  if (emotion === "shock") return -14 * Math.max(env, 0.15);
  if (emotion === "angry") return 3;
  return Math.sin(time * 1.6) * 1.4;
}

export function poseFront(
  action: Action,
  emotion: Emotion,
  env: number,
  time: number,
  innerSide: number,
): BodyPose {
  const drop = emotionDrop(emotion, env, time);
  const hipY = RIG.hipY + drop;
  const shY = RIG.shoulderY + drop;
  const sway = Math.sin(time * 1.6) * 2;
  const both = action === "hips" || action === "head";
  const build = (side: number): Limb => {
    const hip = { x: side * 16 + sway, y: hipY };
    const foot = { x: side * 22 + sway * 0.3, y: 0 };
    const knee = solve2(hip.x, hip.y, foot.x, foot.y, RIG.thigh, RIG.shin, (x) => x * side);
    const shoulder = { x: side * 26 + sway, y: shY };
    const active = both || side === innerSide;
    const hand = armTarget(action, time, side, active, shoulder);
    const elbow = solve2(shoulder.x, shoulder.y, hand.x, hand.y, RIG.upper, RIG.fore, (x, y) => x * side * 4 + y);
    return {
      hip,
      knee: { x: knee.x, y: knee.y },
      foot: { x: knee.ex, y: knee.ey },
      shoulder,
      elbow: { x: elbow.x, y: elbow.y },
      hand: { x: elbow.ex, y: elbow.ey },
    };
  };
  return {
    drop,
    sway,
    torso: emotion === "angry" ? Math.sin(time * 18) * 2 * env : 0,
    head: emotion === "shock" ? -6 * env : emotion === "cry" ? 8 : Math.sin(time * 1.4) * 2,
    left: build(-1),
    right: build(1),
    profile: false,
  };
}

export function poseWalk(phase: number, emotion: Emotion, env: number, time: number): BodyPose {
  const drop = emotionDrop(emotion, env, time) * 0.35;
  const bob = Math.sin(phase * Math.PI * 2) ** 2 * 6;
  const hipY = RIG.hipY + drop + bob;
  const shY = RIG.shoulderY + drop + bob;
  const sway = Math.sin(phase * Math.PI * 2) * 4;
  const lf = footRel(phase, 0);
  const rf = footRel(phase, 0.5);
  const armSwing = Math.sin(phase * Math.PI * 2);
  const build = (foot: Pt, side: number, swing: number): Limb => {
    const hip = { x: sway, y: hipY };
    const knee = solve2(hip.x, hip.y, foot.x, foot.y, RIG.thigh, RIG.shin, (x) => x);
    const shoulder = { x: sway - 4, y: shY };
    const hand = { x: sway - 8 - swing * 26, y: shY + 70 + Math.abs(swing) * 6 };
    const elbow = solve2(shoulder.x, shoulder.y, hand.x, hand.y, RIG.upper, RIG.fore, (x, y) => -x + y);
    return {
      hip,
      knee: { x: knee.x, y: knee.y },
      foot: { x: knee.ex, y: knee.ey },
      shoulder,
      elbow: { x: elbow.x, y: elbow.y },
      hand: { x: elbow.ex, y: elbow.ey },
    };
  };
  return {
    drop,
    sway,
    torso: Math.sin(phase * Math.PI * 2) * 4,
    head: Math.sin(phase * Math.PI * 2) * -3,
    left: build(lf, -1, armSwing),
    right: build(rf, 1, -armSwing),
    profile: true,
  };
}

const AH = new Set("آاأإعحخهغق".split(""));
const EE = new Set("سشزصضچجیی".split(""));
const OO = new Set("وؤ".split(""));
const FV = new Set("بپفم".split(""));

export function visemeFromChar(ch: string): { viseme: Viseme; open: number } {
  if (ch === " " || ch === "\n" || ch === "…" || ch === ".") return { viseme: "rest", open: 0 };
  if (AH.has(ch)) return { viseme: "ah", open: 0.82 };
  if (EE.has(ch)) return { viseme: "ee", open: 0.45 };
  if (OO.has(ch)) return { viseme: "oo", open: 0.5 };
  if (FV.has(ch)) return { viseme: "fv", open: 0.28 };
  if ("؟?!،,".includes(ch)) return { viseme: "rest", open: 0.05 };
  return { viseme: "ah", open: 0.5 };
}

export function visemeFromText(dialogue: string, local: number, duration: number): { viseme: Viseme; open: number } {
  const chars = Array.from(dialogue);
  if (!chars.length || duration <= 0) return { viseme: "rest", open: 0 };
  const i = Math.min(chars.length - 1, Math.max(0, Math.floor((local / duration) * chars.length)));
  return visemeFromChar(chars[i] ?? " ");
}

export function blinkAt(time: number, emotion: Emotion): number {
  if (emotion === "laugh") {
    const m = time % 0.42;
    if (m < 0.08) return m / 0.08;
    if (m < 0.22) return 1;
    if (m < 0.3) return 1 - (m - 0.22) / 0.08;
  }
  if (emotion === "shock") return 0;
  const m = time % 3.4;
  if (m < 0.06) return m / 0.06;
  if (m < 0.14) return 1;
  if (m < 0.2) return 1 - (m - 0.14) / 0.06;
  return 0;
}

export function pulseEnv(start: number, now: number, dur = 1400): number {
  if (!start) return 0;
  const u = (now - start) / dur;
  if (u < 0 || u > 1) return 0;
  return 1 - u * u;
}
