import type { Shot } from "./types";

export function newId() {
  return `s-${Math.random().toString(36).slice(2, 9)}`;
}

export const DEFAULT_TITLE = "استکان آخر";
export const DEFAULT_LOGLINE =
  "پرویز تصمیم گرفته خانه را ترک کند. پونه هنوز استکان را از دستش نگرفته، و خیابان بیرون عجله‌ای برای خداحافظی ندارد.";
export const DEFAULT_GENRE = "درام کوتاه";

export const DEFAULT_SHOTS: Shot[] = [
  {
    id: "s1",
    heading: "داخلی. نشیمن — غروب",
    actionLine:
      "نور از لای پرده روی فرش افتاده. چمدان کنار در نیمه‌باز است. پرویز استکان را با دو دست گرفته. پونه دست به کمر، نگاهش به در است.",
    duration: 6,
    background: "living",
    variant: 0,
    night: false,
    camera: "medium",
    dialogue: "این استکان را زمین بگذار. اگر الان بروی، چای همین‌جا می‌ماند و سرد می‌شود.",
    speaker: "a",
    sfx: "clink",
    pitch: 1,
    actorA: { charId: "parviz", emotion: "neutral", action: "tea" },
    actorB: { charId: "pooneh", emotion: "poker", action: "hips" },
    extras: [],
    props: [],
  },
  {
    id: "s2",
    heading: "داخلی. قهوه‌خانه — شب",
    actionLine:
      "بخار روی آینه نشسته. پرویز کتش هنوز روی دوشش است. پهلوان اژدر استکان را تکان نمی‌دهد و تعجب هم نمی‌کند.",
    duration: 5.5,
    background: "cafe",
    variant: 0,
    night: true,
    camera: "closeLeft",
    dialogue: "نگفتم می‌مانم. فقط خواستم یکی، بدون تعجب، نگاهم کند.",
    speaker: "a",
    sfx: "door",
    pitch: 1,
    actorA: { charId: "parviz", emotion: "poker", action: "idle" },
    actorB: { charId: "pahlavan", emotion: "poker", action: "tea" },
    extras: [{ charId: "reza", emotion: "smile", action: "tea" }],
    props: [
      { id: "table", x: 0.51, layer: "front" },
      { id: "samovar", x: 0.47, layer: "front" },
      { id: "hookah", x: 0.06, layer: "back" },
    ],
  },
  {
    id: "s3",
    heading: "خارجی. خیابان — روز",
    actionLine: "پیاده‌رو خلوت است. پرویز راه می‌افتد. رضا کنار ماشین ایستاده و در را باز نمی‌کند.",
    duration: 6,
    background: "street",
    variant: 0,
    night: false,
    camera: "wide",
    dialogue: "در را باز نمی‌کنم. اگر برگردی، خودت بلدی کجا بزنی.",
    speaker: "b",
    sfx: "horn",
    pitch: 1,
    actorA: { charId: "parviz", emotion: "neutral", action: "walk" },
    actorB: { charId: "reza", emotion: "neutral", action: "idle" },
    extras: [],
    props: [],
  },
];

export const KEY = "behix-project-v1";
