/**
 * قالب فایل شخصیت ریگ‌شده «behix.rig» نسخهٔ ۱ (خالص؛ در Node قابل آزمون).
 *
 * - استخوان‌ها سلسله‌مراتبی‌اند: rest هر استخوان در فضای پدرش است (x,y پیکسل بوم همان نما، rot درجه).
 *   فضای محلی هر استخوان: مبدأ = شروع استخوان، محور +x در امتداد استخوان. ریشه (root) فضای بوم را دارد.
 * - نشانه‌ها (markers) همان ۲۲ مفصل JOINT_NAMES هستند که در فضای محلی یک استخوان نوشته می‌شوند؛
 *   پس rig-adapter.ts بدون تقریب به PuppetRig فعلی تبدیل می‌کند و فایل‌های قدیمی cast/*.json هم بار می‌شوند.
 * - لایه‌ها تکه‌های اطلس‌اند: pivot (شروع محور) و tip (پایان محور) در پیکسل همان تکه.
 * - شکل‌های دهان شناسه‌های قفل‌شدهٔ VisemeId (mouth.ts) را دارند؛ نبودِ هر شکل با VISEME_FALLBACK جبران می‌شود.
 * - تغییر قالب فقط افزایشی است؛ نسخهٔ بالاتر از RIG_VERSION رد می‌شود و migrate() قالب‌های قبلی را بالا می‌آورد.
 */
import { z } from "zod";
import type { BodySpec, HandShape, Vec } from "./pose.ts";
import { JOINT_NAMES, type JointName } from "./puppet.ts";
import { VISEME_IDS, type VisemeId } from "./mouth.ts";

export const RIG_FORMAT = "behix.rig" as const;
export const RIG_VERSION = 1 as const;

export type ViewId = "front" | "threeQuarter" | "side" | "back";
export const VIEW_IDS: readonly ViewId[] = ["front", "threeQuarter", "side", "back"];
export type Side = "l" | "r";

/** استخوان‌های اصلی؛ هر ریگ باید همه را داشته باشد. استخوان اضافه (مو، روسری، دامن کت) با پیشوند x_. */
export const CORE_BONES = [
  "root", "pelvis", "spine", "chest", "neck", "head",
  "clavicle_l", "upperarm_l", "forearm_l", "hand_l",
  "clavicle_r", "upperarm_r", "forearm_r", "hand_r",
  "thigh_l", "shin_l", "foot_l", "thigh_r", "shin_r", "foot_r",
] as const;
export type CoreBoneId = (typeof CORE_BONES)[number];
export type BoneId = CoreBoneId | `x_${string}`;

export type JointLimit = {
  /** دامنهٔ چرخش محلی نسبت به پدر، درجه، با علامت «خم طبیعی» (مثبت = جهت عادی خم شدن مفصل). */
  min: number;
  max: number;
  /** پهنای ناحیهٔ نرم پیش از سقف (درجه). */
  soft?: number;
};

export type Bone = {
  id: BoneId;
  parent: BoneId | null;
  rest: { x: number; y: number; rot: number };
  /** طول استخوان در حالت rest (پیکسل)؛ IK طول را دقیق نگه می‌دارد. */
  length: number;
  limit?: JointLimit;
  /** حرکت ثانویه: ۰ = سفت، ۱ = خیلی شل. */
  stiffness?: number;
  damping?: number;
};

export type Rect = { x: number; y: number; w: number; h: number };
export type AssetRef = { key: string; rect: Rect };

export type LayerRole = "body" | "cloth" | "hair" | "seam" | "prop" | "shadow";
export type ZFlag = "armOver_l" | "armOver_r" | "handNearFace_l" | "handNearFace_r";

export type Layer = {
  id: string;
  bone: BoneId;
  image: AssetRef;
  /** نقطه‌ای از تکه (پیکسل تکه) که روی شروع محور می‌نشیند. */
  pivot: Vec;
  /** پایان محور در پیکسل تکه؛ جهت و طول محور برای چرخاندن تکه. */
  tip: Vec;
  /** ترتیب کشیدن (بزرگ‌تر = نزدیک‌تر). */
  z: number;
  zWhen?: { flag: ZFlag; z: number }[];
  /** کشیدگی مجاز در امتداد استخوان؛ دست و پا [1,1]. */
  stretch?: [number, number];
  role?: LayerRole;
};

export type EyeState = "open" | "half" | "closed" | "happy" | "wide";
export type BrowState = "neutral" | "up" | "down" | "angry" | "sad";

export type FaceRig = {
  /** نقطه‌ها در پیکسل بوم همان نما (فضای تصویر مرجع). */
  anchors: { mouth: Vec; eye_l?: Vec; eye_r?: Vec; brow_l?: Vec; brow_r?: Vec };
  /** اندازهٔ کشیدن شکل دهان روی سر (پیکسل بوم). */
  mouthSize?: { w: number; h: number };
  mouth: Partial<Record<VisemeId, AssetRef>>;
  eye_l?: Partial<Record<EyeState, AssetRef>>;
  eye_r?: Partial<Record<EyeState, AssetRef>>;
  brow_l?: Partial<Record<BrowState, AssetRef>>;
  brow_r?: Partial<Record<BrowState, AssetRef>>;
  /** رنگ پوست زیر تکه‌های جابه‌جاشده. */
  patch?: string;
};

export type ExpressionDef = { eyes: EyeState; brows: BrowState; mouthIdle?: VisemeId; blush?: number; tears?: boolean; sweat?: boolean };

/** نشانه: نقطه‌ای در فضای محلی یک استخوان. */
export type Marker = { bone: BoneId; x: number; y: number };

export type RigView = {
  view: ViewId;
  canvas: { w: number; h: number };
  /** خط زمین (پیکسل بوم). */
  ground: number;
  /** پیکسل به ازای هر واحد بدن (= PuppetRig.u). */
  pxPerUnit: number;
  /** سمتی از بدن (چپِ خود شخصیت = l) که به دوربین نزدیک‌تر است. */
  near: Side;
  /** مرتب: پدر پیش از فرزند. */
  bones: Bone[];
  markers: Record<JointName, Marker>;
  layers: Layer[];
  face?: FaceRig;
  hands?: Partial<Record<`${Side}_${HandShape}`, AssetRef>>;
};

export type RigQa = { passed: boolean; checks: Record<string, number | boolean> };

export type BehixRig = {
  format: typeof RIG_FORMAT;
  version: typeof RIG_VERSION;
  id: string;
  name: string;
  body: BodySpec;
  views: Partial<Record<ViewId, RigView>> & { threeQuarter: RigView };
  expressions?: Record<string, ExpressionDef>;
  source: {
    /** مدل تصویر یا «legacy-puppet» برای عروسک‌های قدیمی. */
    generator: string;
    jointModel?: string;
    landmarker?: string;
    promptHash?: string;
    referenceKey?: string;
    createdAt?: string;
    qa?: RigQa;
  };
};

/** سقف‌های پیش‌فرض مفصل (شروع کار؛ اندازه‌گیری‌شده نیستند). */
export const DEFAULT_LIMITS: Record<string, JointLimit & { stiffness: number }> = {
  spine: { min: -15, max: 30, soft: 5, stiffness: 0 },
  chest: { min: -10, max: 20, soft: 5, stiffness: 0 },
  neck: { min: -25, max: 25, soft: 5, stiffness: 0.1 },
  head: { min: -40, max: 40, soft: 8, stiffness: 0.15 },
  clavicle: { min: -10, max: 25, soft: 3, stiffness: 0 },
  upperarm: { min: -60, max: 175, soft: 10, stiffness: 0 },
  forearm: { min: 0, max: 150, soft: 10, stiffness: 0.05 },
  hand: { min: -60, max: 70, soft: 10, stiffness: 0.3 },
  thigh: { min: -30, max: 110, soft: 10, stiffness: 0 },
  shin: { min: 0, max: 150, soft: 10, stiffness: 0 },
  foot: { min: -30, max: 45, soft: 5, stiffness: 0 },
};
/** سقف پیش‌فرض یک استخوان اصلی (بر اساس نام پایه، بدون _l/_r). */
export const defaultLimit = (id: BoneId) => DEFAULT_LIMITS[id.replace(/_[lr]$/, "")];

/* ---------- اعتبارسنجی ---------- */

const fin = z.number().finite();
const vec = z.object({ x: fin, y: fin }).strict();
const rect = z.object({ x: fin.nonnegative(), y: fin.nonnegative(), w: fin.positive(), h: fin.positive() }).strict();
const asset = z.object({ key: z.string().min(1).max(300), rect }).strict();
const boneId = z.string().regex(/^(x_[a-z0-9_]{1,40}|[a-z_]{3,12})$/);
const limit = z.object({ min: fin, max: fin, soft: fin.nonnegative().optional() }).strict().refine((l) => l.min <= l.max, "min > max");
const bone = z.object({
  id: boneId,
  parent: boneId.nullable(),
  rest: z.object({ x: fin, y: fin, rot: fin }).strict(),
  length: fin.nonnegative(),
  limit: limit.optional(),
  stiffness: fin.min(0).max(1).optional(),
  damping: fin.min(0).max(1).optional(),
}).strict();
const layer = z.object({
  id: z.string().min(1).max(60),
  bone: boneId,
  image: asset,
  pivot: vec,
  tip: vec,
  z: fin,
  zWhen: z.array(z.object({ flag: z.enum(["armOver_l", "armOver_r", "handNearFace_l", "handNearFace_r"]), z: fin }).strict()).max(8).optional(),
  stretch: z.tuple([fin.positive(), fin.positive()]).optional(),
  role: z.enum(["body", "cloth", "hair", "seam", "prop", "shadow"]).optional(),
}).strict();
const slots = <T extends string>(ids: readonly T[]) => z.partialRecord(z.enum(ids as [T, ...T[]]), asset);
const face = z.object({
  anchors: z.object({ mouth: vec, eye_l: vec.optional(), eye_r: vec.optional(), brow_l: vec.optional(), brow_r: vec.optional() }).strict(),
  mouthSize: z.object({ w: fin.positive(), h: fin.positive() }).strict().optional(),
  mouth: z.partialRecord(z.enum(VISEME_IDS as [VisemeId, ...VisemeId[]]), asset),
  eye_l: slots(["open", "half", "closed", "happy", "wide"]).optional(),
  eye_r: slots(["open", "half", "closed", "happy", "wide"]).optional(),
  brow_l: slots(["neutral", "up", "down", "angry", "sad"]).optional(),
  brow_r: slots(["neutral", "up", "down", "angry", "sad"]).optional(),
  patch: z.string().max(40).optional(),
}).strict();
const marker = z.object({ bone: boneId, x: fin, y: fin }).strict();
const view = z.object({
  view: z.enum(VIEW_IDS as [ViewId, ...ViewId[]]),
  canvas: z.object({ w: fin.positive(), h: fin.positive() }).strict(),
  ground: fin,
  pxPerUnit: fin.positive(),
  near: z.enum(["l", "r"]),
  bones: z.array(bone).min(CORE_BONES.length).max(80),
  markers: z.object(Object.fromEntries(JOINT_NAMES.map((n) => [n, marker])) as Record<JointName, typeof marker>).strict(),
  layers: z.array(layer).max(120),
  face: face.optional(),
  hands: z.record(z.string().regex(/^[lr]_(relaxed|open|point|fist|hold)$/), asset).optional(),
}).strict();
const body = z.object({
  label: z.string().max(80), scale: fin, headR: fin.positive(), shoulder: fin.positive(), waist: fin.positive(), hip: fin.positive(),
  torso: fin.positive(), leg: fin.positive(), arm: fin.positive(), limb: fin, stoop: fin, ankle: fin.positive().optional(), neck: fin.positive().optional(),
}).strict();
const expression = z.object({
  eyes: z.enum(["open", "half", "closed", "happy", "wide"]),
  brows: z.enum(["neutral", "up", "down", "angry", "sad"]),
  mouthIdle: z.enum(VISEME_IDS as [VisemeId, ...VisemeId[]]).optional(),
  blush: fin.min(0).max(1).optional(), tears: z.boolean().optional(), sweat: z.boolean().optional(),
}).strict();
export const rigSchema = z.object({
  format: z.literal(RIG_FORMAT),
  version: z.literal(RIG_VERSION),
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,30}$/),
  name: z.string().min(1).max(80),
  body,
  views: z.object({ front: view.optional(), threeQuarter: view, side: view.optional(), back: view.optional() }).strict(),
  expressions: z.record(z.string().max(40), expression).optional(),
  source: z.object({
    generator: z.string().min(1).max(80),
    jointModel: z.string().max(80).optional(),
    landmarker: z.string().max(80).optional(),
    promptHash: z.string().max(128).optional(),
    referenceKey: z.string().max(300).optional(),
    createdAt: z.string().max(40).optional(),
    qa: z.object({ passed: z.boolean(), checks: z.record(z.string().max(40), z.union([fin, z.boolean()])) }).strict().optional(),
  }).strict(),
}).strict();

/** بررسی‌های ساختاری که zod نمی‌بیند: پدرها، ترتیب، استخوان‌های اصلی، ارجاع نشانه‌ها و لایه‌ها. */
function checkView(v: RigView): string | null {
  const seen = new Set<string>();
  for (const b of v.bones) {
    if (seen.has(b.id)) return `استخوان تکراری: ${b.id}`;
    if (b.parent === null ? b.id !== "root" : !seen.has(b.parent)) return `پدر استخوان ${b.id} پیش از آن نیامده است.`;
    if (!b.id.startsWith("x_") && !(CORE_BONES as readonly string[]).includes(b.id)) return `استخوان ناشناخته: ${b.id}`;
    seen.add(b.id);
  }
  for (const c of CORE_BONES) if (!seen.has(c)) return `استخوان اصلی ${c} نیست.`;
  for (const n of JOINT_NAMES) if (!seen.has(v.markers[n].bone)) return `نشانهٔ ${n} به استخوان ناموجود اشاره دارد.`;
  const layerIds = new Set<string>();
  for (const l of v.layers) {
    if (!seen.has(l.bone)) return `لایهٔ ${l.id} به استخوان ناموجود اشاره دارد.`;
    if (layerIds.has(l.id)) return `لایهٔ تکراری: ${l.id}`;
    layerIds.add(l.id);
  }
  return null;
}

export function validateRig(v: unknown): { rig: BehixRig } | { error: string } {
  const r = rigSchema.safeParse(v);
  if (!r.success) return { error: `فایل ریگ معتبر نیست: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message ?? ""}`.trim() };
  const rig = r.data as BehixRig;
  for (const id of VIEW_IDS) {
    const view = rig.views[id];
    if (!view) continue;
    if (view.view !== id) return { error: `نمای ${id} برچسب اشتباه دارد.` };
    const e = checkView(view);
    if (e) return { error: e };
  }
  return { rig };
}
