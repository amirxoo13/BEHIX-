export type Aspect = "wide" | "square" | "story";

export type BgId =
  | "living"
  | "kitchen"
  | "yard"
  | "cafe"
  | "streetDay"
  | "streetNight"
  | "park"
  | "car";

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
  camera: CameraId;
  dialogue: string;
  speaker: Speaker;
  sfx: SfxId;
  pitch: number;
  actorA: ActorSlot;
  actorB: ActorSlot;
};
