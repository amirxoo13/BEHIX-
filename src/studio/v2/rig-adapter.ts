/**
 * پل بین قالب behix.rig و عروسک فعلی v2 (PuppetRig) — خالص؛ در Node قابل آزمون.
 *
 * toPuppetRig: ریگ → همان PuppetRig که drawPuppet/solvePuppet امروز می‌کشند (بدون تغییر موتور).
 * fromPuppetRig: فایل قدیمی cast/<id>.json → behix.rig (بی‌تقریب؛ رفت‌وبرگشت همان داده را می‌دهد).
 * migrate: هر JSON (ریگ نسخهٔ ۱ یا PuppetRig قدیمی) → BehixRig معتبر، یا پیام خطا. هرگز throw نمی‌کند.
 */
import type { Vec } from "./pose.ts";
import { JOINT_NAMES, PART_NAMES, validateJoints, type JointName, type Joints, type Part, type PartName, type PuppetRig } from "./puppet.ts";
import {
  RIG_FORMAT, RIG_VERSION, defaultLimit, validateRig,
  type BehixRig, type Bone, type BoneId, type Layer, type Marker, type RigView, type Side, type ViewId,
} from "./rig-format.ts";

const V = (x: number, y: number): Vec => ({ x, y });
const R = (v: Vec, deg: number): Vec => {
  const a = (deg * Math.PI) / 180;
  return V(v.x * Math.cos(a) - v.y * Math.sin(a), v.x * Math.sin(a) + v.y * Math.cos(a));
};
const angle = (a: Vec, b: Vec) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
const dist = (a: Vec, b: Vec) => Math.hypot(b.x - a.x, b.y - a.y);

export type WorldBone = { start: Vec; rot: number; end: Vec };

/** موقعیت جهانی (پیکسل بوم) همهٔ استخوان‌ها در حالت rest (FK). */
export function worldRest(view: RigView): Map<BoneId, WorldBone> {
  const out = new Map<BoneId, WorldBone>();
  for (const b of view.bones) {
    const p = b.parent ? out.get(b.parent) : null;
    const start = p ? ((o) => V(p.start.x + o.x, p.start.y + o.y))(R(V(b.rest.x, b.rest.y), p.rot)) : V(b.rest.x, b.rest.y);
    const rot = (p?.rot ?? 0) + b.rest.rot;
    out.set(b.id, { start, rot, end: ((d) => V(start.x + d.x, start.y + d.y))(R(V(b.length, 0), rot)) });
  }
  return out;
}

/** نقطهٔ جهانی یک نشانه. */
export function markerWorld(world: Map<BoneId, WorldBone>, m: Marker): Vec {
  const w = world.get(m.bone);
  if (!w) throw new Error(`marker bone ${m.bone} missing`);
  const d = R(V(m.x, m.y), w.rot);
  return V(w.start.x + d.x, w.start.y + d.y);
}

/** نشانهٔ یک نقطهٔ جهانی در فضای محلی یک استخوان. */
function toMarker(world: Map<BoneId, WorldBone>, bone: BoneId, p: Vec): Marker {
  const w = world.get(bone)!;
  const d = R(V(p.x - w.start.x, p.y - w.start.y), -w.rot);
  return { bone, x: d.x, y: d.y };
}

/** کدام قطعهٔ عروسک قدیمی روی کدام استخوان می‌نشیند (Near/Far با near نما تعیین می‌شود). */
const PART_BONE: Record<PartName, { base: string; tag: "Near" | "Far" | null }> = {
  armFarUpper: { base: "upperarm", tag: "Far" }, armFarFore: { base: "forearm", tag: "Far" }, handFar: { base: "hand", tag: "Far" },
  legFarThigh: { base: "thigh", tag: "Far" }, legFarShin: { base: "shin", tag: "Far" }, footFar: { base: "foot", tag: "Far" },
  legNearThigh: { base: "thigh", tag: "Near" }, legNearShin: { base: "shin", tag: "Near" }, footNear: { base: "foot", tag: "Near" },
  torso: { base: "spine", tag: null }, head: { base: "head", tag: null },
  armNearUpper: { base: "upperarm", tag: "Near" }, armNearFore: { base: "forearm", tag: "Near" }, handNear: { base: "hand", tag: "Near" },
};
const sideOf = (near: Side, tag: "Near" | "Far"): Side => (tag === "Near" ? near : near === "l" ? "r" : "l");
export function boneOfPart(name: PartName, near: Side): BoneId {
  const m = PART_BONE[name];
  return (m.tag ? `${m.base}_${sideOf(near, m.tag)}` : m.base) as BoneId;
}
/** مفصل JOINT_NAMES (L/R = چپ/راستِ خود شخصیت) → استخوانی که نشانه رویش نوشته می‌شود. */
const MARKER_BONE: Record<JointName, BoneId> = {
  headTop: "head", headCenter: "head", chin: "head", neck: "neck", chest: "chest", pelvis: "pelvis",
  shoulderL: "upperarm_l", elbowL: "forearm_l", wristL: "hand_l", handL: "hand_l",
  shoulderR: "upperarm_r", elbowR: "forearm_r", wristR: "hand_r", handR: "hand_r",
  hipL: "thigh_l", kneeL: "shin_l", ankleL: "foot_l", toeL: "foot_l",
  hipR: "thigh_r", kneeR: "shin_r", ankleR: "foot_r", toeR: "foot_r",
};

/** استخوان‌های rest از روی ۲۲ مفصل (پیکسل تصویر). جهت‌ها از مفصل به مفصل بعدی. */
function bonesFromJoints(j: Joints, ground: number): Bone[] {
  const mid = V((j.hipL.x + j.hipR.x) / 2, (j.hipL.y + j.hipR.y) / 2);
  // هر استخوان: [شروع جهانی، پایان جهانی]
  const spec: [BoneId, BoneId | null, Vec, Vec][] = [
    ["root", null, V(j.pelvis.x, ground), V(j.pelvis.x, ground - 1)],
    ["pelvis", "root", j.pelvis, mid.x === j.pelvis.x && mid.y === j.pelvis.y ? V(j.pelvis.x, j.pelvis.y + 1) : mid],
    ["spine", "pelvis", j.pelvis, j.chest],
    ["chest", "spine", j.chest, j.neck],
    ["neck", "chest", j.neck, j.chin],
    ["head", "neck", j.chin, j.headTop],
  ];
  for (const s of ["l", "r"] as const) {
    const S = s.toUpperCase() as "L" | "R";
    const J = (n: string) => j[`${n}${S}` as JointName];
    spec.push(
      [`clavicle_${s}`, "chest", j.chest, J("shoulder")],
      [`upperarm_${s}`, `clavicle_${s}`, J("shoulder"), J("elbow")],
      [`forearm_${s}`, `upperarm_${s}`, J("elbow"), J("wrist")],
      [`hand_${s}`, `forearm_${s}`, J("wrist"), J("hand")],
      [`thigh_${s}`, "pelvis", J("hip"), J("knee")],
      [`shin_${s}`, `thigh_${s}`, J("knee"), J("ankle")],
      [`foot_${s}`, `shin_${s}`, J("ankle"), J("toe")],
    );
  }
  const world = new Map<BoneId, { start: Vec; rot: number }>();
  return spec.map(([id, parent, a, b]) => {
    const rot = dist(a, b) > 1e-9 ? angle(a, b) : (parent ? world.get(parent)!.rot : -90);
    const p = parent ? world.get(parent)! : null;
    const local = p ? R(V(a.x - p.start.x, a.y - p.start.y), -p.rot) : a;
    world.set(id, { start: a, rot });
    const lim = defaultLimit(id);
    const bone: Bone = { id, parent, rest: { x: local.x, y: local.y, rot: rot - (p?.rot ?? 0) }, length: dist(a, b) };
    if (lim) { bone.limit = { min: lim.min, max: lim.max, soft: lim.soft }; if (lim.stiffness) bone.stiffness = lim.stiffness; }
    return bone;
  });
}

/** عروسک قدیمی (cast/<id>.json) → behix.rig نسخهٔ ۱، نمای سه‌رخ. */
export function fromPuppetRig(old: PuppetRig): BehixRig {
  const near: Side = old.near === "L" ? "l" : "r";
  const bones = bonesFromJoints(old.joints, old.ground);
  const partial: RigView = { view: "threeQuarter", canvas: { w: old.w, h: old.h }, ground: old.ground, pxPerUnit: old.u, near, bones, markers: {} as RigView["markers"], layers: [] };
  const world = worldRest(partial);
  for (const n of JOINT_NAMES) partial.markers[n] = toMarker(world, MARKER_BONE[n], old.joints[n]);
  partial.layers = old.parts.map((p: Part) => {
    const z = PART_NAMES.indexOf(p.name);
    const still = p.name.startsWith("hand") || p.name.startsWith("foot");
    const layer: Layer = {
      id: p.name, bone: boneOfPart(p.name, near),
      image: { key: old.image, rect: { ...p.src } },
      pivot: V(p.a.x - p.off.x, p.a.y - p.off.y),
      tip: V(p.b.x - p.off.x, p.b.y - p.off.y),
      z, role: "body",
      stretch: still ? [1, 1] : [0.75, 1.3],
    };
    // دست دور وقتی جلوی سینه می‌آید روی تنه کشیده شود (solve → armOver). مصرف در P2.
    if (p.name === "armFarUpper" || p.name === "armFarFore" || p.name === "handFar") layer.zWhen = [{ flag: near === "l" ? "armOver_r" : "armOver_l", z: z + 20 }];
    return layer;
  });
  return {
    format: RIG_FORMAT, version: RIG_VERSION, id: old.id, name: old.name, body: { ...old.body },
    views: { threeQuarter: partial },
    source: { generator: "legacy-puppet", ...(old.qa ? { qa: old.qa } : {}) },
  };
}

/** behix.rig → PuppetRig برای drawPuppet. نما پیش‌فرض سه‌رخ؛ اگر نمای خواسته نبود، سه‌رخ. */
export function toPuppetRig(rig: BehixRig, viewId: ViewId = "threeQuarter"): PuppetRig {
  const v = rig.views[viewId] ?? rig.views.threeQuarter;
  const world = worldRest(v);
  const joints = {} as Joints;
  for (const n of JOINT_NAMES) joints[n] = markerWorld(world, v.markers[n]);
  const parts: Part[] = [];
  for (const name of PART_NAMES) {
    const layer = v.layers.find((l) => l.id === name);
    if (!layer) continue;
    const off = V(0, 0);
    // off طوری که pivot روی همان نقطهٔ جهانی rest بنشیند: a = off + pivot
    const a = startOfLayer(world, layer, v);
    off.x = a.x - layer.pivot.x;
    off.y = a.y - layer.pivot.y;
    parts.push({ name, a, b: V(off.x + layer.tip.x, off.y + layer.tip.y), src: { ...layer.image.rect }, off });
  }
  const image = v.layers.find((l) => (PART_NAMES as readonly string[]).includes(l.id))?.image.key ?? "";
  return { id: rig.id, name: rig.name, image, w: v.canvas.w, h: v.canvas.h, joints, parts, body: { ...rig.body }, u: v.pxPerUnit, ground: v.ground, near: v.near === "l" ? "L" : "R", ...(rig.source.qa ? { qa: rig.source.qa } : {}) };
}

/**
 * نقطهٔ جهانی rest محور یک لایه. لایه‌های ساخته‌شده از عروسک قدیمی محور خودشان را دارند (pivot→tip در تکه)،
 * و «شروع محور» در جهان = همان Part.a قدیمی؛ چون Part.a = off + pivot و off را نداریم، آن را از
 * نشانه‌ها می‌سازیم: محور برش قطعه‌ها (bonesOf) فقط از مفاصل ساخته می‌شود.
 */
function startOfLayer(world: Map<BoneId, WorldBone>, layer: Layer, v: RigView): Vec {
  const J = (n: JointName) => markerWorld(world, v.markers[n]);
  const name = layer.id as PartName;
  const m = PART_BONE[name];
  if (!m) return world.get(layer.bone)?.start ?? V(0, 0);
  const S = (m.tag ? sideOf(v.near, m.tag) : "l").toUpperCase();
  const j = (p: string) => J(`${p}${S}` as JointName);
  switch (m.base) {
    case "upperarm": return j("shoulder");
    case "forearm": return j("elbow");
    case "hand": return j("wrist");
    case "thigh": return j("hip");
    case "shin": return j("knee");
    case "foot": return j("ankle");
    case "spine": { const a = J("hipL"), b = J("hipR"); return V((a.x + b.x) / 2, (a.y + b.y) / 2); }
    case "head": return V(J("headCenter").x, J("headTop").y);
  }
  return world.get(layer.bone)?.start ?? V(0, 0);
}

/** آیا این JSON یک PuppetRig قدیمی است؟ */
function looksLikePuppet(v: unknown): v is PuppetRig {
  const o = v as Partial<PuppetRig> | null;
  return !!o && typeof o === "object" && typeof o.id === "string" && !!o.joints && Array.isArray(o.parts) && typeof o.u === "number" && typeof o.ground === "number";
}

/** هر نسخه → behix.rig معتبر. نسخهٔ جدیدتر از این برنامه رد می‌شود (به‌روزرسانی برنامه لازم است). */
export function migrate(v: unknown): { rig: BehixRig } | { error: string } {
  try {
    const o = v as { format?: unknown; version?: unknown } | null;
    if (o && typeof o === "object" && o.format === RIG_FORMAT) {
      if (typeof o.version !== "number" || o.version > RIG_VERSION) return { error: "این فایل ریگ با نسخهٔ جدیدتر برنامه ساخته شده است." };
      return validateRig(v);
    }
    if (looksLikePuppet(v)) {
      const j = validateJoints(v.joints);
      if ("error" in j) return j;
      return validateRig(fromPuppetRig(v));
    }
    return { error: "این فایل ریگ یا عروسک شناخته‌شده‌ای نیست." };
  } catch {
    return { error: "فایل ریگ خراب است." };
  }
}

/** بار کردن مستقیم برای موتور: JSON → PuppetRig آمادهٔ کشیدن. */
export function loadPuppet(v: unknown, view: ViewId = "threeQuarter"): { puppet: PuppetRig; rig: BehixRig } | { error: string } {
  const m = migrate(v);
  return "error" in m ? m : { puppet: toPuppetRig(m.rig, view), rig: m.rig };
}
