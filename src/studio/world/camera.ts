/**
 * Camera moves for layered sets (design §4). Pure and deterministic: same keys + t → same camera,
 * so preview, worker export and thumbnails agree. Coordinates are stage space (1080×1920 design).
 */
import { z } from "zod";

export const EASES = ["linear", "inOutSine", "inOutCubic", "outQuart", "outBack", "hold"] as const;
export type Ease = (typeof EASES)[number];

const finite = z.number().finite();
export const camKeySchema = z
  .object({
    t: finite.min(0),
    cx: finite,
    cy: finite,
    zoom: finite.min(0.5).max(4),
    dolly: finite.min(-0.9).max(3).optional(), // travel toward the set: magnifies by parallax
    truck: finite.min(-1080).max(1080).optional(), // lateral travel px: far layers move less
    roll: finite.min(-10).max(10).optional(), // degrees
    focus: finite.min(0).max(2).optional(), // depth in focus (1 = characters)
    ease: z.enum(EASES),
    /** seconds the move INTO this key takes, ending at t (legacy keys: 0.6). Default: the whole gap. */
    dur: finite.positive().optional(),
  })
  .strict();
export const shotCameraSchema = z
  .object({
    preset: z.enum(["static", "slowPush", "pan", "follow", "reveal", "rackFocus", "handheld"]).optional(),
    keys: z.array(camKeySchema).min(1).max(64),
    shake: z.object({ amp: finite.min(0).max(40), freq: finite.min(0).max(30), seed: z.number().int() }).strict().optional(),
    continuity: z.enum(["cut", "matchFrom", "carryOver"]).optional(),
  })
  .strict()
  .refine((c) => c.keys.every((k, i) => i === 0 || c.keys[i - 1].t <= k.t), "keys are sorted by t");

export type CamKey = z.infer<typeof camKeySchema>;
export type ShotCamera = z.infer<typeof shotCameraSchema>;
/** Evaluated camera at one instant. */
/** `sx/sy`: screen-space offset applied equally to every layer (handheld shake, legacy sway). */
export type CamState = { cx: number; cy: number; zoom: number; dolly: number; truck: number; roll: number; focus: number; sx?: number; sy?: number };

const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
export function easeValue(ease: Ease, t: number): number {
  const u = clamp01(t);
  switch (ease) {
    case "linear":
      return u;
    case "inOutSine":
      return -(Math.cos(Math.PI * u) - 1) / 2;
    case "inOutCubic": // identical to stick/figure.ts ease() — legacy camera curve
      return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    case "outQuart":
      return 1 - Math.pow(1 - u, 4);
    case "outBack": {
      const c1 = 1.2, c3 = c1 + 1;
      return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2);
    }
    case "hold":
      return u >= 1 ? 1 : 0;
  }
}

const state = (k: CamKey): CamState => ({ cx: k.cx, cy: k.cy, zoom: k.zoom, dolly: k.dolly ?? 0, truck: k.truck ?? 0, roll: k.roll ?? 0, focus: k.focus ?? 1 });
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

/** Camera at scene-local time t. Before the first key → first key; after the last → last. */
export function cameraAt2(keys: CamKey[], t: number): CamState {
  if (keys.length === 0) return { cx: 540, cy: 1000, zoom: 1, dolly: 0, truck: 0, roll: 0, focus: 1 };
  let i = 0;
  while (i + 1 < keys.length && keys[i + 1].t <= t) i++;
  const a = keys[i], b = keys[i + 1];
  if (!b) return state(a);
  const dur = b.dur ?? Math.max(1e-6, b.t - a.t);
  const u = easeValue(b.ease, (t - (b.t - dur)) / dur);
  const A = state(a), B = state(b);
  return { cx: lerp(A.cx, B.cx, u), cy: lerp(A.cy, B.cy, u), zoom: lerp(A.zoom, B.zoom, u), dolly: lerp(A.dolly, B.dolly, u), truck: lerp(A.truck, B.truck, u), roll: lerp(A.roll, B.roll, u), focus: lerp(A.focus, B.focus, u) };
}

/** Today's story-direct keys ({t,zoom,cx,cy}, cubic ease over the last 0.6 s) as CamKeys. */
export function fromLegacyKeys(keys: { t: number; zoom: number; cx: number; cy: number }[]): CamKey[] {
  return keys.map((k) => ({ t: k.t, cx: k.cx, cy: k.cy, zoom: k.zoom, ease: "inOutCubic", dur: 0.6 }));
}

/** 2D affine matrix [a, b, c, d, e, f] as used by ctx.setTransform/transform. */
export type Mat = [number, number, number, number, number, number];
export const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];
export function mul(m: Mat, n: Mat): Mat {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}
export function invert(m: Mat): Mat {
  const det = m[0] * m[3] - m[1] * m[2];
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
}
export function apply(m: Mat, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * Transform of a layer with parallax p (stage → stage), design §4.2. The pivot is the look-at point
 * pulled toward the stage centre by p, so far layers pan less; dolly magnifies by p; truck slides by p;
 * roll is damped on far layers. With p = 1 and no dolly/truck/roll this is exactly the legacy camera:
 * translate(cx, cy) · scale(zoom) · translate(−cx, −cy).
 */
export function layerMatrix(cam: CamState, p: number, W = 1080, H = 1920): Mat {
  const px = W / 2 + (cam.cx - W / 2) * p;
  const py = H / 2 + (cam.cy - H / 2) * p;
  const s = cam.zoom * (1 + cam.dolly * p);
  const r = ((cam.roll * Math.PI) / 180) * (0.5 + 0.5 * p);
  const cos = Math.cos(r) * s, sin = Math.sin(r) * s;
  // translate(px − truck·p + sx, py + sy) · rotate(r) · scale(s) · translate(−px, −py)
  const tx = px - cam.truck * p + (cam.sx ?? 0), ty = py + (cam.sy ?? 0);
  return [cos, sin, -sin, cos, tx - (cos * px - sin * py), ty - (sin * px + cos * py)];
}

/** Stage rectangle a layer shows through a W×H window under `cam` (axis-aligned bound). */
export function visibleRect(cam: CamState, p: number, W = 1080, H = 1920) {
  const inv = invert(layerMatrix(cam, p, W, H));
  const pts = [apply(inv, 0, 0), apply(inv, W, 0), apply(inv, 0, H), apply(inv, W, H)];
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

type Rect = { x: number; y: number; w: number; h: number };
const inside = (v: Rect, r: Rect, eps = 1e-6) => v.x >= r.x - eps && v.y >= r.y - eps && v.x + v.w <= r.x + r.w + eps && v.y + v.h <= r.y + r.h + eps;

/**
 * Pull a camera back toward the neutral framing (centre, no truck) until every layer's visible rect
 * stays inside its art rect (overscan included), so edges never show. Deterministic bisection.
 */
export function clampCamera(cam: CamState, layers: { parallax: number; rect: Rect }[], W = 1080, H = 1920): { cam: CamState; clamped: boolean } {
  const ok = (c: CamState) => layers.every((l) => inside(visibleRect(c, l.parallax, W, H), l.rect));
  if (ok(cam)) return { cam, clamped: false };
  const neutral: CamState = { ...cam, cx: W / 2, cy: H / 2, truck: 0, roll: 0, zoom: Math.max(1, cam.zoom), dolly: Math.max(0, cam.dolly) };
  const mix = (u: number): CamState => ({ ...cam, cx: lerp(neutral.cx, cam.cx, u), cy: lerp(neutral.cy, cam.cy, u), truck: lerp(0, cam.truck, u), roll: lerp(0, cam.roll, u), zoom: lerp(neutral.zoom, cam.zoom, u), dolly: lerp(neutral.dolly, cam.dolly, u) });
  if (!ok(neutral)) return { cam: neutral, clamped: true };
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mix(mid))) lo = mid;
    else hi = mid;
  }
  return { cam: mix(lo), clamped: true };
}

/** Depth-of-field blur for a layer (px), rounded to 0.5; 0 when under 0.5. */
export function blurFor(baseBlur: number | undefined, p: number, focus: number): number {
  if (!baseBlur) return 0;
  const b = (baseBlur * Math.abs(p - focus)) / Math.max(0.2, focus);
  const r = Math.round(b * 2) / 2;
  return r < 0.5 ? 0 : r;
}

/** Integer hash → [0, 1). */
function hash01(seed: number, i: number): number {
  let h = (seed ^ Math.imul(i, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Smooth 1D value noise in [-1, 1]. */
function noise(seed: number, x: number): number {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash01(seed, i), hash01(seed, i + 1), u) * 2 - 1;
}
/** Seeded handheld shake (px, px, degrees) at time t; same seed + t → same offset. */
export function shakeAt(shake: { amp: number; freq: number; seed: number } | undefined, t: number): { x: number; y: number; roll: number } {
  if (!shake || shake.amp === 0) return { x: 0, y: 0, roll: 0 };
  const x = t * shake.freq;
  return { x: noise(shake.seed, x) * shake.amp, y: noise(shake.seed + 101, x) * shake.amp * 0.6, roll: noise(shake.seed + 202, x * 0.5) * shake.amp * 0.02 };
}

/** Full evaluated shot camera (keys + shake) at t. */
export function shotCameraAt(cam: ShotCamera, t: number): CamState {
  const c = cameraAt2(cam.keys, t);
  const s = shakeAt(cam.shake, t);
  return { ...c, sx: s.x, sy: s.y, roll: c.roll + s.roll };
}
