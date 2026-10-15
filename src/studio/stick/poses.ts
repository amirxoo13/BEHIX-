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

const sitLegs = { legL: L(30, -30), legR: L(30, -30), thigh: 0.45 };

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
  | "sitWave";

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
  sitLeanBack: { ...base, ...sitLegs, lean: -4, armL: L(48, -20), armR: L(48, -20), tilt: -4 },
};
