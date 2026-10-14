/**
 * کاتالوگ همهٔ دارایی‌هایی که سناریو می‌تواند به آن‌ها اشاره کند.
 * هر مورد یک شناسهٔ واقعی سایت دارد و چند اسم فارسی (مترادف) که در متن سناریو پیدا می‌شود.
 * شناسه‌ها از همان منابعی خوانده می‌شوند که سایت با آن‌ها نقاشی می‌کند (CAST، labels)،
 * پس دارایی تازه با اضافه شدن به آن منابع، خودکار در کاتالوگ می‌آید.
 */
import { CAST } from "./characters.ts";
import { ACTIONS, CAMERAS, EMOTIONS, SFXS, WORLD } from "./labels.ts";
import { PROPS, type PropId } from "./props.ts";
import type { Action, BgId, CameraId, Emotion, SfxId } from "./types.ts";

export type Entry<T extends string> = { id: T; label: string; aliases: string[] };

/** یکسان‌سازی متن فارسی برای مقایسه: ی/ک عربی، نیم‌فاصله، اعراب و فاصله‌های اضافه. */
export function normalizeFa(text: string): string {
  return text
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[ۀة]/g, "ه")
    .replace(/[أإ]/g, "ا")
    .replace(/[ً-ٰٟ]/g, "")
    .replace(/‌|‍|‎|‏/g, " ")
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[،؛.!?؟«»"'():\-—–[\]…,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** کلمه‌های عمومی که به‌تنهایی اسم یک شخصیت نیستند. */
const GENERIC_NAME_WORDS = new Set(["آقای", "آقا", "خانم"]);

export const CHARACTERS: Entry<string>[] = CAST.map((c) => {
  const parts = c.name.split(/\s+/).filter((p) => p && !GENERIC_NAME_WORDS.has(p));
  const aliases = [c.name, ...(parts.length > 1 ? parts : [])];
  return { id: c.id, label: c.name, aliases: [...new Set(aliases)] };
});

const BG_ALIASES: Record<BgId, string[]> = {
  living: ["پذیرایی", "نشیمن", "اتاق نشیمن", "هال", "سالن", "خانه", "خونه"],
  kitchen: ["آشپزخانه", "آشپزخونه", "مطبخ"],
  bedroom: ["اتاق خواب", "اتاق‌خواب", "اتاق بچه", "اتاق"],
  bathroom: ["حمام", "حموم"],
  toilet: ["دستشویی", "توالت", "سرویس بهداشتی", "مستراح"],
  parking: ["پارکینگ"],
  yard: ["حیاط", "حوض"],
  car: ["داخل ماشین", "توی ماشین", "تو ماشین", "داخل خودرو", "داخل تاکسی", "توی تاکسی", "ماشین", "خودرو", "تاکسی"],
  street: ["خیابان", "خیابون", "کوچه", "پیاده‌رو"],
  park: ["پارک", "بوستان", "باغ"],
  cafe: ["قهوه‌خانه", "قهوه خونه", "قهوه‌خونه", "قهوه‌خانهٔ سنتی", "چایخانه", "چایخونه"],
  coffee: ["کافه", "کافی‌شاپ", "کافی شاپ"],
  bazaar: ["بازار تهران", "بازار بزرگ", "بازار", "راسته", "حجره"],
  milad: ["برج میلاد", "میلاد"],
  azadi: ["میدان آزادی", "برج آزادی", "آزادی"],
  saadatabad: ["سعادت‌آباد", "سعادت آباد"],
  fereshteh: ["خیابان فرشته", "فرشته"],
};

export const BACKGROUNDS: Entry<BgId>[] = (Object.keys(WORLD) as BgId[]).map((id) => ({
  id,
  label: WORLD[id].place,
  aliases: [...new Set([WORLD[id].place, ...BG_ALIASES[id]])],
}));

const EMOTION_ALIASES: Record<Emotion, string[]> = {
  neutral: ["خنثی", "آرام", "معمولی"],
  smile: ["لبخند", "خوشحال", "شاد", "مهربان", "خرسند"],
  laugh: ["خند*", "می‌خند*", "میخند*", "قهقهه"],
  angry: ["خشم*", "عصبانی", "عصبی", "اخم*", "فریاد*", "داد می‌زند", "شاکی", "غضب*"],
  cry: ["گریه", "گریان", "می‌گرید", "گریست*", "اشک*", "بغض*"],
  shock: ["شوک", "شوکه", "تعجب", "متعجب", "جا می‌خورد", "جا خورد", "وحشت*", "ترسید*", "می‌ترسد"],
  poker: ["بی‌احساس", "بی‌تفاوت", "خونسرد", "بی‌حالت"],
};

export const EMOTION_ENTRIES: Entry<Emotion>[] = EMOTIONS.map((e) => ({
  id: e.id,
  label: e.label,
  aliases: [...new Set([e.label, ...EMOTION_ALIASES[e.id]])],
}));

const ACTION_ALIASES: Record<Action, string[]> = {
  idle: ["ایستاده", "می‌ایستد", "نشسته", "می‌نشیند"],
  walk: ["راه رفتن", "راه می‌رود", "قدم", "وارد می‌شود", "وارد شد", "می‌آید", "میاد", "بیرون می‌رود"],
  point: ["اشاره"],
  tea: ["استکان در دست", "استکان", "چای", "فنجان"],
  hips: ["دست به کمر"],
  head: ["دست روی سر", "دست به سر"],
};

export const ACTION_ENTRIES: Entry<Action>[] = ACTIONS.map((a) => ({
  id: a.id,
  label: a.label,
  aliases: [...new Set([a.label, ...ACTION_ALIASES[a.id]])],
}));

const SFX_ALIASES: Record<SfxId, string[]> = {
  none: [],
  clink: ["صدای استکان", "برخورد استکان", "جرینگ"],
  door: ["صدای در", "در می‌زند", "در زد", "در باز می‌شود", "در بسته می‌شود", "در را می‌بندد", "در را باز می‌کند", "در را محکم"],
  horn: ["بوق", "بوق ماشین", "بوق خیابان"],
  shock: ["ضربهٔ شوک", "صدای ضربه"],
  slap: ["سیلی"],
  beep: ["بوق سانسور", "سانسور", "بیپ"],
  crickets: ["سکوت سنگین", "سکوت", "جیرجیرک"],
  rimshot: ["ضرب پایان", "ریم‌شات"],
};

// برچسب‌های خیلی کوتاه («در») در متن معنی دیگری هم دارند و اسم مستقل حساب نمی‌شوند.
export const SFX_ENTRIES: Entry<SfxId>[] = SFXS.map((s) => ({
  id: s.id,
  label: s.label,
  aliases:
    s.id === "none"
      ? []
      : [...new Set([...(normalizeFa(s.label).length > 2 ? [s.label] : []), ...SFX_ALIASES[s.id]])],
}));

/** اشیاء جدا (ماشین، درخت، سماور، ...). */
export const PROP_ENTRIES: Entry<PropId>[] = PROPS.map((p) => ({
  id: p.id,
  label: p.label,
  aliases: [...new Set([p.label, ...p.aliases])],
}));

export const CAMERA_ENTRIES: Entry<CameraId>[] = CAMERAS.map((c) => ({
  id: c.id,
  label: c.label,
  aliases: [c.label],
}));

export type Match<T extends string> = { id: T; alias: string; at: number };

/** پسوندهای رایجی که بعد از یک کلمهٔ کامل هنوز همان کلمه حساب می‌شود. */
const SUFFIX = /^(?:ی|ها|های|ش|اش|م|ام|ت|ات|ه|ان) /;

/**
 * همهٔ موردهایی که اسمشان در متن آمده. هر اسم از ابتدای یک کلمه شروع می‌شود و
 * تا پایان کلمه (یا یکی از پسوندهای رایج) ادامه دارد؛ اسمی که با `*` تمام شود
 * ریشه است و هر ادامه‌ای را می‌پذیرد («خند*» ← خنده، خندان، خندید).
 * موارد هم‌پوشان: اسم بلندتر برنده است («بوق سانسور» به‌جای «بوق»).
 */
export function findAll<T extends string>(text: string, entries: Entry<T>[]): Match<T>[] {
  const hay = ` ${normalizeFa(text)} `;
  const raw: Match<T>[] = [];
  for (const e of entries) {
    for (const alias of e.aliases) {
      const stem = alias.endsWith("*");
      const needle = normalizeFa(stem ? alias.slice(0, -1) : alias);
      if (!needle) continue;
      let from = 0;
      for (;;) {
        const at = hay.indexOf(` ${needle}`, from);
        if (at === -1) break;
        from = at + 1;
        const rest = hay.slice(at + 1 + needle.length);
        if (stem || rest.startsWith(" ") || SUFFIX.test(rest)) {
          raw.push({ id: e.id, alias: needle, at });
        }
      }
    }
  }
  raw.sort((a, b) => b.alias.length - a.alias.length || a.at - b.at);
  const taken: [number, number][] = [];
  const kept: Match<T>[] = [];
  for (const m of raw) {
    const end = m.at + m.alias.length + 1;
    if (taken.some(([s, e]) => m.at < e && end > s)) continue;
    taken.push([m.at, end]);
    kept.push(m);
  }
  return kept.sort((a, b) => a.at - b.at);
}

/** بهترین (اولین در متن) مورد پیدا شده، یا undefined. */
export function findFirst<T extends string>(text: string, entries: Entry<T>[]): T | undefined {
  return findAll(text, entries)[0]?.id;
}

/** شناسه‌ها برای اعتبارسنجی خروجی مدل زبانی. */
export const IDS = {
  characters: CHARACTERS.map((e) => e.id),
  backgrounds: BACKGROUNDS.map((e) => e.id),
  emotions: EMOTION_ENTRIES.map((e) => e.id),
  actions: ACTION_ENTRIES.map((e) => e.id),
  sfx: SFX_ENTRIES.map((e) => e.id),
  cameras: CAMERA_ENTRIES.map((e) => e.id),
  props: PROP_ENTRIES.map((e) => e.id),
};
