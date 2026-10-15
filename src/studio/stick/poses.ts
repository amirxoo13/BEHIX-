/** ژست‌های آماده؛ هر ژست فقط زاویه‌هاست و بین آن‌ها نرم درون‌یابی می‌شود. */
import type { Limb, Pose } from "./figure.ts";

const L = (a: number, b: number): Limb => ({ a, b });

const base: Pose = {
  px: 0,
  py: 0,
  lean: 0,
  tilt: 0,
  armL: L(24, -5),
  armR: L(24, -5),
  legL: L(9, -6),
  legR: L(9, -6),
  thigh: 1,
  look: 0,
};

/** نشسته از روبه‌رو: ران‌ها کوتاه (رو به دوربین) و رو به بیرون، زانو پیدا، ساق عمودی تا زمین. */
const sitLegs = { legL: L(68, -68), legR: L(68, -68), thigh: 0.62 };

export type PoseId =
  | "stand"
  | "standCross"
  | "standHips"
  | "standReachR"
  | "standReachL"
  | "standPointR"
  | "standCheer"
  | "standThink"
  | "standShrug"
  | "sit"
  | "sitCross"
  | "sitPhone"
  | "sitCupR"
  | "sitCupL"
  | "sitReachR"
  | "sitReachL"
  | "sitThink"
  | "sitLeanBack"
  | "sitWave"
  | "standWave"
  | "standExplain"
  | "standFacepalm"
  | "standHandsFace"
  | "standPhoneEar"
  | "standHandChest"
  | "standHoldFront"
  | "standJump"
  | "standKick"
  | "standBow"
  | "standPointL"
  | "sitDrive"
  | "sitHandsFace"
  | "sitEat"
  | "sitWrite"
  | "sitExplain";

export const POSES: Record<PoseId, Pose> = {
  stand: base,
  standCross: { ...base, armL: L(18, -128), armR: L(22, -122) },
  standHips: { ...base, armL: L(50, -73), armR: L(50, -73) },
  standReachR: { ...base, lean: 5, armR: L(74, 10), armL: L(26, -6) },
  standReachL: { ...base, lean: -5, armL: L(74, 10), armR: L(26, -6) },
  standPointR: { ...base, armR: L(84, 0), armL: L(12, -10) },
  standCheer: { ...base, armL: L(150, 12), armR: L(150, 12), legL: L(16, -4), legR: L(16, -4) },
  standThink: { ...base, armR: L(22, -152), armL: L(18, -128), tilt: 8 },
  standShrug: { ...base, armL: L(55, -125), armR: L(55, -125), tilt: -6 },
  sit: { ...base, ...sitLegs, armL: L(26, -18), armR: L(26, -18) },
  sitCross: { ...base, ...sitLegs, armL: L(18, -128), armR: L(22, -122) },
  sitPhone: { ...base, ...sitLegs, armL: L(24, -172), armR: L(25, -172), tilt: 8, look: 0.1 },
  sitCupR: { ...base, ...sitLegs, armR: L(24, -96), armL: L(26, -18) },
  sitCupL: { ...base, ...sitLegs, armL: L(24, -96), armR: L(26, -18) },
  sitReachR: { ...base, ...sitLegs, lean: 8, armR: L(72, 8), armL: L(26, -18) },
  sitReachL: { ...base, ...sitLegs, lean: -8, armL: L(72, 8), armR: L(26, -18) },
  sitThink: { ...base, ...sitLegs, armR: L(22, -152), armL: L(18, -128), tilt: 9 },
  sitWave: { ...base, ...sitLegs, armR: L(140, -25), armL: L(24, -172), tilt: -5 },
  standWave: { ...base, armR: L(150, -30), armL: L(24, -5) },
  standExplain: { ...base, armL: L(48, -70), armR: L(48, -70), tilt: 3 },
  standFacepalm: { ...base, armR: L(18, -165), armL: L(24, -5), tilt: 12 },
  standHandsFace: { ...base, armL: L(14, -168), armR: L(14, -168), tilt: 6 },
  standPhoneEar: { ...base, armR: L(30, -168), armL: L(24, -5), tilt: -8, look: 0.4 },
  standHandChest: { ...base, armR: L(14, -150), armL: L(24, -5), tilt: -4 },
  standHoldFront: { ...base, armL: L(26, -100), armR: L(26, -100) },
  standJump: { ...base, py: -40, armL: L(150, 15), armR: L(150, 15), legL: L(22, -50), legR: L(22, -50) },
  standKick: { ...base, lean: -6, armL: L(60, 0), armR: L(40, -20), legR: L(70, -10), legL: L(4, -4) },
  standBow: { ...base, lean: 0, tilt: 22, armL: L(10, -2), armR: L(10, -2) },
  standPointL: { ...base, armL: L(84, 0), armR: L(12, -10) },
  sitDrive: { ...base, ...sitLegs, armL: L(28, -92), armR: L(28, -92) },
  sitHandsFace: { ...base, ...sitLegs, armL: L(14, -168), armR: L(14, -168), tilt: 8 },
  sitEat: { ...base, ...sitLegs, armR: L(20, -158), armL: L(26, -18), tilt: -3 },
  sitWrite: { ...base, ...sitLegs, armL: L(24, -95), armR: L(30, -78), tilt: 14, look: 0.1 },
  sitExplain: { ...base, ...sitLegs, armL: L(48, -70), armR: L(48, -70) },
  sitLeanBack: { ...base, ...sitLegs, lean: -4, armL: L(48, -20), armR: L(48, -20), tilt: -4 },
};
