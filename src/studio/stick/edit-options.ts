import type { Gesture, Move } from "./story-parse.ts";
import type { Hold } from "./figure.ts";
export const GESTURE_LABELS = {
  cross: "دست به سینه", hips: "دست به کمر", point: "اشاره", wave: "دست تکان دادن",
  explain: "توضیح دادن", facepalm: "دست روی پیشانی", handsFace: "دست روی صورت",
  phoneEar: "تلفن کنار گوش", handChest: "دست روی سینه", think: "فکر کردن", shrug: "شانه بالا انداختن",
  cheer: "شادی", jump: "پرش", kick: "شوت", bow: "تعظیم", drive: "رانندگی",
  eat: "خوردن (نشسته)", write: "نوشتن (نشسته)", reach: "دست دراز کردن",
} satisfies Record<Gesture, string>;
export const MOVE_LABELS = { toLeft: "رفتن به چپ", toRight: "رفتن به راست", toCenter: "رفتن به وسط", enter: "ورود", exit: "خروج" } satisfies Partial<Record<Move, string>>;
export const HOLD_LABELS = {
  none: "بدون شیء", phone: "گوشی", cup: "فنجان", cookie: "شیرینی", book: "کتاب", bag: "کیف",
  ball: "توپ", flowers: "گل", remote: "کنترل", plate: "بشقاب", shopping: "کیسهٔ خرید", umbrella: "چتر", laptop: "لپ‌تاپ",
} satisfies Record<Hold, string>;
