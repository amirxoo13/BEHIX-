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

export type PlaceGroup = "home" | "out" | "venue" | "tehran";

export const PLACE_GROUPS: { id: PlaceGroup; label: string }[] = [
  { id: "home", label: "داخل ساختمان" },
  { id: "out", label: "بیرون" },
  { id: "venue", label: "قهوه‌خانه و کافه" },
  { id: "tehran", label: "تهران" },
];

/**
 * همهٔ مکان‌ها. `interior` یعنی داخل ساختمان (روز/شب فقط نور پنجره و چراغ را عوض می‌کند).
 * `variants` اسم سه طرح آمادهٔ هر مکان است، به همان ترتیبی که draw-bg.ts می‌کشد.
 */
export const WORLD: Record<
  BgId,
  { place: string; note: string; group: PlaceGroup; interior: boolean; variants: [string, string, string] }
> = {
  living: {
    place: "پذیرایی",
    note: "اتاق نشیمن و پذیرایی خانه؛ برای گفت‌وگوی خانوادگی و مهمانی.",
    group: "home",
    interior: true,
    variants: ["سنتی با پشتی", "مبل و فرش", "مدرن با تلویزیون"],
  },
  kitchen: {
    place: "آشپزخانه",
    note: "کار خانه، چای و غذا. قاب شلوغ‌تر.",
    group: "home",
    interior: true,
    variants: ["قدیمی با کاشی و سماور", "مدرن سفید", "اوپن با جزیره"],
  },
  bedroom: {
    place: "اتاق خواب",
    note: "خلوت و حرف‌های خصوصی.",
    group: "home",
    interior: true,
    variants: ["تخت دونفره", "اتاق ساده", "اتاق بچه"],
  },
  bathroom: {
    place: "حمام",
    note: "کاشی و آینهٔ بخارگرفته.",
    group: "home",
    interior: true,
    variants: ["دوش و پرده", "وان", "حمام ایرانی"],
  },
  toilet: {
    place: "دستشویی",
    note: "روشویی و آینه؛ برای صحنه‌های کوتاه و کمیک.",
    group: "home",
    interior: true,
    variants: ["ایرانی با آفتابه", "فرنگی", "روشویی و آینه"],
  },
  parking: {
    place: "پارکینگ",
    note: "پارکینگ ساختمان؛ ستون، ماشین و چراغ سقفی.",
    group: "home",
    interior: true,
    variants: ["زیرزمینی", "حیاط پارکینگ", "کرکره‌ای کوچک"],
  },
  yard: {
    place: "حیاط",
    note: "حوض و حیاط خانه. فاصلهٔ فیزیکی بین دو نفر را نشان می‌دهد.",
    group: "out",
    interior: false,
    variants: ["حوض آبی", "باغچه و درخت", "حیاط آجری"],
  },
  car: {
    place: "داخل ماشین",
    note: "قاب تنگ. گفت‌وگو بدون راه فرار.",
    group: "out",
    interior: true,
    variants: ["پیکان قدیمی", "تاکسی", "ماشین مدرن"],
  },
  street: {
    place: "خیابان",
    note: "پیاده‌رو و عبور ماشین. با راه رفتن بازیگر، خیابان حرکت می‌کند.",
    group: "out",
    interior: false,
    variants: ["خیابان آپارتمانی", "کوچهٔ قدیمی", "خیابان مغازه‌ها"],
  },
  park: {
    place: "پارک",
    note: "فضای باز و خلوت. قدم زدن بدون عجله.",
    group: "out",
    interior: false,
    variants: ["درخت و نیمکت", "حوض و فواره", "زمین بازی"],
  },
  cafe: {
    place: "قهوه‌خانه",
    note: "قهوه‌خانهٔ سنتی: تخت، سماور، قلیان.",
    group: "venue",
    interior: true,
    variants: ["تخت و قالیچه", "سماور و پرده", "آجری با فانوس"],
  },
  coffee: {
    place: "کافه",
    note: "کافهٔ مدرن و امروزی: بار قهوه، گلدان، پنجرهٔ بزرگ.",
    group: "venue",
    interior: true,
    variants: ["صنعتی آجری", "روشن و چوبی", "سبز با گیاه"],
  },
  bazaar: {
    place: "بازار تهران",
    note: "راستهٔ سرپوشیدهٔ بازار با طاق‌های آجری و حجره‌ها.",
    group: "tehran",
    interior: true,
    variants: ["راستهٔ فرش", "راستهٔ ادویه", "راستهٔ طلا"],
  },
  milad: {
    place: "برج میلاد",
    note: "برج میلاد در افق تهران.",
    group: "tehran",
    interior: false,
    variants: ["از پارک", "از بزرگراه", "پای برج"],
  },
  azadi: {
    place: "میدان آزادی",
    note: "برج آزادی و میدان دورش.",
    group: "tehran",
    interior: false,
    variants: ["روبه‌روی برج", "با فواره‌ها", "از دور با ترافیک"],
  },
  saadatabad: {
    place: "سعادت‌آباد",
    note: "برج‌های مسکونی، بلوار و مغازه‌های امروزی.",
    group: "tehran",
    interior: false,
    variants: ["بلوار با سرو", "برج‌های مسکونی", "مغازه‌ها و کافه"],
  },
  fereshteh: {
    place: "فرشته",
    note: "خیابان شیک شمال شهر: نمای شیشه‌ای، درخت چنار، ماشین‌های گران.",
    group: "tehran",
    interior: false,
    variants: ["خیابان چنار", "برج شیشه‌ای", "ویلا و دیوار سبز"],
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
