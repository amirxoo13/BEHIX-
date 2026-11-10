/**
 * شخصیت‌های ریگ در فیلم داستانی (/story)، پشت پرچم VITE_BEHIX_RIG_CHARACTERS=1 (پیش‌فرض خاموش).
 * با پرچم خاموش drawRigCharacter پیش از هر کار دیگری false برمی‌گرداند و آدمک دقیقاً مثل قبل کشیده می‌شود.
 *
 * زمان‌بندی (جا، راه رفتن، حرف زدن، نگاه) از همان آدمکِ کارگردان خودکار گرفته می‌شود تا صحنه عوض نشود؛
 * بدن را موتور v2 می‌سازد: ژستِ متناظر با گذار پله‌ای، نفس و ضرب حرف، و قدم بی‌سُر که فازش از جابه‌جایی
 * واقعی روی صحنه حساب می‌شود. هر فریم فقط تابع زمان است.
 * محدودیت‌ها (P2): ریگ نمی‌نشیند (ژست‌های نشسته به نزدیک‌ترین ژست ایستاده نگاشته می‌شوند و روی زمین
 * کشیده می‌شود)، شیء در دست کشیده نمی‌شود، دهان از شدت صدا (talk) است نه از VisemeSpanها.
 */
import type { ActorFrame as StickFrame, ActorTrack as StickTrack } from "../stick/animate.ts";
import { actorAt as stickActorAt } from "../stick/animate.ts";
import { BODY, joints } from "../stick/figure.ts";
import type { Ctx } from "../stick/figure-base.ts";
import { POSES as STICK_POSES, type PoseId as StickPoseId } from "../stick/poses.ts";
import { blendPose, drawActor, type ActorFrame, type MouthSprite } from "./actor.ts";
import type { CharacterRef } from "./character-ref.ts";
import { WALK_DIST, WALK_SPEED, alive, poseAt, walkPose, type PoseId, type PoseKey } from "./pose.ts";
import { puppetHeight, type PuppetRig } from "./puppet.ts";
import { loadPuppet } from "./rig-adapter.ts";
import type { VisemeId } from "./mouth.ts";
import type { ViewId } from "./rig-format.ts";

/* ---------- پرچم ---------- */

let flagOverride: boolean | undefined;
/** فقط برای آزمون‌ها و ابزارها؛ undefined = برگشت به متغیر محیطی. */
export function setRigCharactersFlag(on: boolean | undefined) {
  flagOverride = on;
}
export function rigCharactersEnabled(): boolean {
  if (flagOverride !== undefined) return flagOverride;
  const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
  return env?.VITE_BEHIX_RIG_CHARACTERS === "1";
}

/* ---------- فهرست ریگ‌های بارشده ---------- */

export type RigEntry = { rig: PuppetRig; img: CanvasImageSource; mouths?: Partial<Record<VisemeId, MouthSprite>> };
const rigs = new Map<string, RigEntry>();

export const registerRig = (rigKey: string, entry: RigEntry) => void rigs.set(rigKey, entry);
export const getRig = (rigKey: string): RigEntry | undefined => rigs.get(rigKey);
export const unregisterRig = (rigKey: string) => void rigs.delete(rigKey);
export const clearRigs = () => rigs.clear();

/** ریگ را از JSON (behix.rig یا فایل عروسک قدیمی) + تصویر اطلس ثبت می‌کند. */
export function registerRigJson(rigKey: string, json: unknown, img: CanvasImageSource, view: ViewId = "threeQuarter"): { ok: true } | { error: string } {
  const r = loadPuppet(json, view);
  if ("error" in r) return r;
  registerRig(rigKey, { rig: r.puppet, img });
  return { ok: true };
}

/* ---------- نگاشت ژست آدمک به ژست ریگ ---------- */

export const STICK_TO_RIG_POSE = {
  stand: "stand", standCross: "crossed", standHips: "hips", standReachR: "explain", standReachL: "explain",
  standPointR: "point", standPointL: "point", standCheer: "cheer", standThink: "think", standShrug: "shrug",
  standWave: "wave", standExplain: "explain", standFacepalm: "sad", standHandsFace: "shock", standPhoneEar: "phone",
  standHandChest: "listen", standHoldFront: "cup", standJump: "cheer", standKick: "stand", standBow: "sad",
  sit: "relaxed", sitCross: "crossed", sitPhone: "phone", sitCupR: "cup", sitCupL: "cup", sitReachR: "explain",
  sitReachL: "explain", sitThink: "think", sitLeanBack: "relaxed", sitWave: "wave", sitDrive: "explain",
  sitHandsFace: "shock", sitEat: "sip", sitWrite: "phone", sitExplain: "explain",
} as const satisfies Record<StickPoseId, PoseId>;

const keyCache = new WeakMap<StickTrack["keys"], PoseKey[]>();
function rigKeys(track: StickTrack): PoseKey[] {
  let k = keyCache.get(track.keys);
  if (!k) {
    k = [];
    for (const key of track.keys) {
      const pose = STICK_TO_RIG_POSE[key.pose];
      if (k.at(-1)?.pose !== pose) k.push({ t: key.t, pose });
    }
    keyCache.set(track.keys, k);
  }
  return k;
}

/** قد آدمک ایستاده به واحد آدمک (از بالای سر تا کف پا)، برای هم‌قد کردن ریگ با آدمک. */
const STICK_HEIGHT = (() => {
  const p = STICK_POSES.stand;
  const j = joints(p);
  return Math.max(j.legL.end.y, j.legR.end.y) - (j.headC.y - BODY.headR);
})();

export type RigDraw = {
  /** زمان صحنه (ثانیه). */
  t: number;
  /** x کف پا روی بوم. */
  x: number;
  /** خط زمین روی بوم. */
  floorY: number;
  /** مقیاس آدمک (FRAME.scale × kindScale). */
  scale: number;
  /** پهنای قاب به پیکسل (x آدمک کسری از این است). */
  width: number;
};

/** حالت بدن ریگ در این لحظه (بدون کشیدن)؛ برای آزمون و پیش‌نمایش. */
export function rigFrame(rig: PuppetRig, track: StickTrack, f: StickFrame, o: RigDraw): { frame: ActorFrame; height: number } {
  const height = STICK_HEIGHT * o.scale;
  const unitPx = (height * rig.u) / puppetHeight(rig);
  const base = poseAt(rigKeys(track), o.t);
  let pose = alive(base.pose, o.t, track.seed, f.state.talk, base.id);
  // سرعت واقعی روی صحنه (از خود مسیر آدمک، قطعی) → دامنهٔ قدم؛ فاز از جای روی صحنه = بدون سُر خوردن.
  const h = 1 / 60;
  const vx = ((stickActorAt(track, o.t + h, null).x - stickActorAt(track, o.t - h, null).x) / (2 * h)) * o.width;
  const k = Math.min(1, Math.abs(vx) / unitPx / (WALK_SPEED * 0.6));
  const dir: 1 | -1 = vx < 0 ? -1 : 1;
  if (k > 0.001) {
    const walk = walkPose((o.x * dir) / (WALK_DIST * unitPx), k);
    pose = blendPose(pose, walk, k);
  }
  const look = f.state.pose.look;
  const facing: 1 | -1 = k > 0.05 ? dir : look < -0.15 ? -1 : 1;
  const talk = f.state.talk;
  return {
    height,
    frame: {
      pose, poseId: base.id, x: 0, facing, turn: 0.35 + 0.45 * k, walk: k,
      mouth: { id: talk > 0.05 ? "eh" : "rest", weight: 1, from: null, fromWeight: 0 }, open: talk,
    },
  };
}

/**
 * اگر پرچم روشن باشد، شخصیت از نوع rig باشد و ریگش ثبت شده باشد، ریگ را می‌کشد و true برمی‌گرداند؛
 * وگرنه بدون هیچ کشیدنی false (و صدا زننده آدمک را مثل قبل می‌کشد).
 */
export function drawRigCharacter(ctx: Ctx, member: { character?: CharacterRef }, track: StickTrack, f: StickFrame, o: RigDraw): boolean {
  if (!rigCharactersEnabled()) return false;
  const ref = member.character;
  if (ref?.kind !== "rig") return false;
  const entry = rigs.get(ref.rigKey);
  if (!entry) return false;
  const { frame, height } = rigFrame(entry.rig, track, f, o);
  // OffscreenCanvasRenderingContext2D همان متدهای مورد استفادهٔ drawPuppet را دارد.
  drawActor(ctx as CanvasRenderingContext2D, entry.rig, entry.img, frame, { groundY: o.floorY, height, originX: o.x, mouths: entry.mouths });
  return true;
}
