import type { Action, BgId, CameraId, Emotion, SfxId } from "./types";

export const CAMERAS: { id: CameraId; label: string; note: string }[] = [
  { id: "wide", label: "نمای باز", note: "هر دو بازیگر و فضا در قاب" },
  { id: "medium", label: "نمای متوسط", note: "گفت‌وگو، از کمر به بالا" },
  { id: "closeLeft", label: "کلوزآپ چپ", note: "صورت بازیگر چپ قاب" },
  { id: "closeRight", label: "کلوزآپ راست", note: "صورت بازیگر راست قاب" },
  { id: "push", label: "دالی این", note: "نزدیک شدن آرام دوربین" },
  { id: "comic", label: "زوم شوک", note: "نزدیک شدن تند با لرزش کوتاه" },
];

export const EMOTIONS: { id: Emotion; label: string }[] = [
  { id: "neutral", label: "خنثی" },
  { id: "smile", label: "لبخند" },
  { id: "laugh", label: "خنده" },
  { id: "angry", label: "خشم" },
  { id: "cry", label: "گریه" },
  { id: "shock", label: "شوک" },
  { id: "poker", label: "بی‌احساس" },
];

export const ACTIONS: { id: Action; label: string }[] = [
  { id: "idle", label: "ایستاده" },
  { id: "walk", label: "راه رفتن" },
  { id: "point", label: "اشاره" },
  { id: "tea", label: "استکان در دست" },
  { id: "hips", label: "دست به کمر" },
  { id: "head", label: "دست روی سر" },
];

export const SFXS: { id: SfxId; label: string }[] = [
  { id: "none", label: "بدون افکت" },
  { id: "clink", label: "برخورد استکان" },
  { id: "door", label: "در" },
  { id: "horn", label: "بوق خیابان" },
  { id: "shock", label: "ضربهٔ شوک" },
  { id: "slap", label: "سیلی" },
  { id: "beep", label: "بوق سانسور" },
  { id: "crickets", label: "سکوت سنگین" },
  { id: "rimshot", label: "ضرب پایان" },
];

export const WORLD: Record<BgId, { place: string; note: string }> = {
  living: {
    place: "نشیمن",
    note: "نور بستهٔ عصر، فرش و پرده. مناسب مکالمهٔ نزدیک و خداحافظی.",
  },
  kitchen: {
    place: "آشپزخانه",
    note: "فضای کار خانه. قاب شلوغ‌تر، حرکت کوتاه بین پیشخوان و در.",
  },
  yard: {
    place: "حیاط",
    note: "حوض و حیاط. فاصلهٔ فیزیکی بین دو نفر را نشان می‌دهد.",
  },
  cafe: {
    place: "قهوه‌خانه",
    note: "بخار، آینهٔ کدر، جمعیت کم. برای مواجههٔ بی‌تعارف.",
  },
  streetDay: {
    place: "خیابان روز",
    note: "پیاده‌رو و عبور ماشین. خروج از خانه را بیرونی می‌کند.",
  },
  streetNight: {
    place: "خیابان شب",
    note: "همان خیابان با نور سرد. مناسب تردید و برگشتن.",
  },
  park: {
    place: "پارک",
    note: "فضای باز و خلوت. قدم زدن بدون عجله.",
  },
  car: {
    place: "داخل ماشین",
    note: "قاب تنگ. گفت‌وگو بدون راه فرار.",
  },
};

export const ROLES: Record<string, string> = {
  parviz: "مرد میان‌سال. تصمیم را گرفته، اما دستش هنوز به خانه بند است.",
  pooneh: "روبه‌روی پرویز. جمله را کوتاه می‌کند و در را نگاه می‌کند، نه او را.",
  pahlavan: "ناظر بی‌تعارف. تعجب نمی‌کند و استکانش را تکان نمی‌دهد.",
  reza: "بیرون خانه. در ماشین را باز نمی‌کند تا تصمیم، تصمیم خود پرویز بماند.",
  khaleh: "حضور خانوادگی. اگر به قصه بیاید، لحنش نصیحت نیست؛ شاهد است.",
  doctor: "بیرون از دعوای خانه. حرفش تشخیص است، دلداری نیست.",
  sara: "نسل جوان‌تر قاب. نگاهش مستقیم است و معطل تعارف نمی‌ماند.",
  kian: "کودک صحنه. اگر باشد، بازی بزرگ‌ترها را بی‌حرف لو می‌دهد.",
};

export const GENRES = ["درام کوتاه", "کمدی موقعیت", "خانوادگی", "اجتماعی", "فانتزی"] as const;
