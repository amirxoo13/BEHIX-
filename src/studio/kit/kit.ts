/**
 * «کیت شخصیت» Gemini: تکه‌های بدن (یک طرف؛ طرف دیگر قرینه)، سر بدون دهان، ۹ دهان و جای مفصل‌ها.
 * فقط داده است؛ ساخت آن در kit/build.ts و کشیدنش روی اسکلت موتور در kit/draw.ts است.
 */
import type { Pt } from "./process.ts";
import type { VisemeId } from "../v2/viseme-timeline.ts";

export type KitImage = { src: string; w: number; h: number };
/** تکهٔ عضو: a = مفصل بالا (اتصال به والد)، b = مفصل پایین (اتصال فرزند)، به پیکسلِ همان تصویر. */
export type KitLimb = KitImage & { a: Pt; b: Pt };
export type KitEnd = KitImage & { a: Pt };
export type KitTorso = KitImage & { neck: Pt; shoulder: Pt; hip: Pt };
export type KitHead = KitImage & { neck: Pt; mouth: { x: number; y: number; w: number }; eyes: { x: number; y: number; w: number; h: number }[] };

/** ترتیب ۹ دهانِ برگهٔ Gemini (همان ترتیب پرامپت). */
export const KIT_MOUTHS = ["rest", "mbp", "ah", "eh", "ee", "oh", "oo", "fv", "l"] as const;
export type KitMouth = (typeof KIT_MOUTHS)[number];

export type CharacterKit = {
  version: 1;
  name: string;
  torso: KitTorso;
  upperArm: KitLimb;
  forearm: KitLimb;
  hand: KitEnd;
  thigh: KitLimb;
  shin: KitLimb;
  foot: KitEnd;
  head: KitHead;
  mouths: Record<KitMouth, KitImage>;
  /** پلک بسته (با پوست دورش)، برای پلک زدن. */
  blink?: KitImage;
  skin: string;
};

/** visemeهای موتور (viseme-timeline) → یکی از ۹ دهان کیت. */
export function kitMouthFor(v: VisemeId | string): KitMouth {
  switch (v) {
    case "mbp": return "mbp";
    case "ah": case "wide": return "ah";
    case "eh": return "eh";
    case "ee": case "sz": return "ee";
    case "oh": return "oh";
    case "oo": return "oo";
    case "fv": return "fv";
    case "l": return "l";
    default: return "rest";
  }
}
