import type { PropPlacement } from "./props.ts";

export type Aspect = "wide" | "square" | "story";

/** مکان‌ها. داخل ساختمان: living..parking. «streetDay/streetNight» فقط برای خواندن پروژه‌های قدیمی است. */
export type BgId =
  | "living"
  | "kitchen"
  | "bedroom"
  | "bathroom"
  | "toilet"
  | "parking"
  | "yard"
  | "car"
  | "street"
  | "park"
  | "cafe"
  | "coffee"
  | "bazaar"
  | "milad"
  | "azadi"
  | "saadatabad"
  | "fereshteh";

/** تعداد طرح آماده برای هر مکان. */
export const VARIANTS = 3;

export type CameraId =
  | "wide"
  | "medium"
  | "closeLeft"
  | "closeRight"
  | "push"
  | "comic";

export type Emotion =
  | "neutral"
  | "smile"
  | "laugh"
  | "angry"
  | "cry"
  | "shock"
  | "poker";

export type Action = "idle" | "walk" | "point" | "tea" | "hips" | "head";

export type SfxId =
  | "none"
  | "beep"
  | "slap"
  | "shock"
  | "crickets"
  | "rimshot"
  | "horn"
  | "clink"
  | "door";

export type Viseme = "rest" | "ah" | "ee" | "oo" | "fv" | "shout";

export type Speaker = "a" | "b" | "none";

export type HairStyle =
  | "messy"
  | "shawl"
  | "chador"
  | "hat"
  | "bald"
  | "cap"
  | "bob"
  | "bowl";

export type BrowStyle = "unibrow" | "thick" | "arched";

export type FacialHair = "none" | "thick" | "handlebar" | "stubble" | "beard";

export type CharacterDef = {
  id: string;
  name: string;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  brow: BrowStyle;
  facial: FacialHair;
  shirt: string;
  pants: string;
  shoe: string;
  glasses: boolean;
  eyeBags: boolean;
  scale: number;
  coat?: string;
  /** هیکل: لاغر، معمولی یا درشت (پهنای بالاتنه). */
  build?: Build;
  /** سر از روی عکس (مثلاً کارتونی Canva)؛ اگر باشد به‌جای سر نقاشی‌شده کشیده می‌شود. */
  head?: HeadImage;
};

export type Build = "slim" | "normal" | "heavy";

export type HeadImage = {
  /** تصویر PNG با پس‌زمینهٔ شفاف، به‌صورت data URL. */
  src: string;
  /** نسبت ارتفاع به عرض تصویر. */
  aspect: number;
  /** وسط دهان و چشم‌ها، نسبی (۰ تا ۱) روی تصویر. */
  mouth: { x: number; y: number };
  eyes?: { l: { x: number; y: number }; r: { x: number; y: number } };
  /** پهنای سر در واحد بدن (سر نقاشی‌شده ≈ ۸۰). */
  size: number;
  /** رنگ پوست کنار دهان؛ برای پوشاندن دهان/چشم اصلی هنگام حرف زدن و پلک زدن. */
  patch: string;
};

export type ActorSlot = {
  /** Normalized horizontal placement; omitted keeps legacy layout. */
  x?: number;
  scale?: number;
  charId: string;
  emotion: Emotion;
  action: Action;
};

export type Shot = {
  id: string;
  heading: string;
  actionLine: string;
  duration: number;
  background: BgId;
  /** کدام طرحِ آماده از این مکان (۰ تا VARIANTS-۱). */
  variant: number;
  /** شب یا روز. */
  night: boolean;
  camera: CameraId;
  dialogue: string;
  speaker: Speaker;
  sfx: SfxId;
  pitch: number;
  actorA: ActorSlot;
  actorB: ActorSlot;
  /** بقیهٔ حاضرین صحنه (حداکثر MAX_EXTRAS نفر)؛ عقب‌تر از دو بازیگر اصلی ایستاده‌اند و حرف نمی‌زنند. */
  extras: ActorSlot[];
  /** اشیاء جدا از پس‌زمینه (ماشین، درخت، سماور، ...) با جای هرکدام در قاب. */
  props: PropPlacement[];
};

/** با دو بازیگر اصلی، حداکثر ۵ نفر در قاب. */
export const MAX_EXTRAS = 3;
