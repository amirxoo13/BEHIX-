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
};

export type ActorSlot = {
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
};

/** با دو بازیگر اصلی، حداکثر ۵ نفر در قاب. */
export const MAX_EXTRAS = 3;
