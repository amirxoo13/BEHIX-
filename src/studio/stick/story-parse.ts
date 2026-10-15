/**
 * فهم داستان فارسی با فرهنگ لغت (بدون هوش مصنوعی و بدون اینترنت):
 * - صحنه: خطی که با «صحنه/سکانس/پلان/مکان» شروع شود، یا خط کوتاهی که فقط اسم مکان دارد؛ شب/روز از همان خط.
 * - شخصیت: «اسم (زن، سمت چپ، عینکی)»، اسم‌های رایج فارسی، یا نقش‌ها (مرد، زن، پسر، مادربزرگ، ...).
 * - دیالوگ: «اسم: جمله» یا «اسم (حالت): جمله»؛ «راوی: ...» فقط زیرنویس است.
 * - بقیهٔ جمله‌ها توصیف‌اند: نشستن/ایستادن، ورود/خروج، حرکت دست، شیء در دست، حالت چهره، فکر کردن.
 */
import { findAll, normalizeFa, type Entry, type Match } from "../catalog.ts";
import type { Expression } from "./face.ts";
import type { Hair, Hold, Kind, Look } from "./figure.ts";
import { PLACES, PLACE_IDS, type PlaceId } from "./places.ts";

export type Side = "left" | "right" | "center";

export type Gesture =
  | "cross"
  | "hips"
  | "point"
  | "wave"
  | "explain"
  | "facepalm"
  | "handsFace"
  | "phoneEar"
  | "handChest"
  | "think"
  | "shrug"
  | "cheer"
  | "jump"
  | "kick"
  | "bow"
  | "drive"
  | "eat"
  | "write"
  | "reach";

export type Move = "enter" | "exit" | "approach" | "toLeft" | "toRight" | "toCenter";

export type Act = {
  who: string;
  sit?: boolean;
  gesture?: Gesture;
  hold?: Hold;
  /** چیزی را که در دست داشت زمین گذاشت. */
  drop?: boolean;
  face?: Expression;
  move?: Move;
  /** برای «به طرف X می‌رود» و «به X اشاره می‌کند». */
  target?: string;
  thought?: boolean;
};

export type Beat =
  | { kind: "action"; text: string; acts: Act[] }
  | { kind: "line"; speaker: string; text: string; acts: Act[] }
  | { kind: "narration"; text: string };

export type StoryCastMember = { id: string; name: string; look: Look; side?: Side; guessed: boolean };

export type StoryScene = { heading: string; place: PlaceId; night: boolean; beats: Beat[] };

export type StoryPlan = { cast: StoryCastMember[]; scenes: StoryScene[]; warnings: string[] };

export const MAX_STORY_CHARS = 20000;
export const MAX_CAST = 8;

/* ---------- فرهنگ لغت ---------- */

const e = <T extends string>(id: T, aliases: string[]): Entry<T> => ({ id, label: aliases[0], aliases });

/** کلمه‌های بلندتر از ۳ حرف ریشه حساب می‌شوند تا جمع و صرف فعل هم پیدا شود (می‌خندد/می‌خندند). */
function stems<T extends string>(list: Entry<T>[]): Entry<T>[] {
  return list.map((x) => ({ ...x, aliases: x.aliases.map((a) => (normalizeFa(a).length > 3 ? `${a}*` : a)) }));
}

const PLACE_ENTRIES: Entry<PlaceId>[] = PLACE_IDS.filter((id) => id !== "blank").map((id) =>
  e(id, [PLACES[id].label, ...PLACES[id].aliases]),
);

const NIGHT = ["شب", "شبانه", "نیمه شب", "نیمه‌شب", "تاریکی", "آخر شب", "دیروقت"];
const DAY = ["روز", "صبح", "ظهر", "عصر", "بعدازظهر", "بعد از ظهر", "غروب", "روز روشن"];

const GESTURES: Entry<Gesture>[] = stems([
  e("cross", ["دست به سینه", "دست‌به‌سینه", "دست‌هایش را به سینه", "دستاشو به سینه"]),
  e("hips", ["دست به کمر", "دست‌به‌کمر", "دست‌هایش را به کمر"]),
  e("point", ["اشاره می‌کند", "اشاره کرد", "اشاره میکنه", "با انگشت نشان"]),
  e("wave", ["دست تکان", "دست تکون", "بای بای", "خداحافظی می‌کند", "سلام می‌کند", "دست می‌دهد"]),
  e("explain", ["توضیح می‌دهد", "توضیح میده", "توضیح داد", "با دست حرف", "دست‌هایش را باز"]),
  e("facepalm", ["دست روی پیشانی", "دستش را به پیشانی", "دست به پیشونی", "دستش را به صورتش می‌زند", "می‌زند توی سرش"]),
  e("handsFace", ["صورتش را می‌پوشاند", "صورتش را با دست", "سرش را در دست", "صورتش را می‌گیرد", "صورتشو میگیره"]),
  e("phoneEar", ["با تلفن", "تلفن صحبت", "تلفنی", "زنگ می‌زند", "زنگ زد", "جواب تلفن", "گوشی را جواب", "پشت تلفن", "تلفن را جواب"]),
  e("handChest", ["دست روی قلب", "دست روی سینه", "دستش روی قلبش", "دست به دل"]),
  e("think", ["فکر می‌کند", "فکر میکنه", "فکر کرد", "در فکر", "توی فکر", "به فکر فرو", "خیال می‌کند", "رویا"]),
  e("shrug", ["شانه بالا", "شونه بالا", "شانه‌هایش را بالا", "شانه می‌اندازد"]),
  e("cheer", ["هورا", "شادی می‌کند", "خوشحالی می‌کند", "دست‌هایش را بالا", "دستاشو بالا", "تشویق می‌کند", "جشن می‌گیرد", "گل زد"]),
  e("jump", ["می‌پرد", "بالا و پایین می‌پرد", "پرید", "بالا می‌پرد"]),
  e("kick", ["شوت می‌زند", "شوت کرد", "ضربه می‌زند", "لگد", "به توپ ضربه"]),
  e("bow", ["تعظیم", "سرش را پایین", "سر به زیر"]),
  e("drive", ["رانندگی", "پشت فرمان", "می‌راند", "فرمان را"]),
  e("eat", ["می‌خورد", "غذا می‌خورد", "گاز می‌زند", "لقمه", "می‌نوشد", "سر می‌کشد"]),
  e("write", ["می‌نویسد", "تایپ می‌کند", "درس می‌خواند", "یادداشت می‌کند", "مشق می‌نویسد"]),
  e("reach", ["دستش را دراز", "دست دراز", "تعارف می‌کند", "به او می‌دهد", "می‌دهد به"]),
]);

const MOMENTARY: ReadonlySet<Gesture> = new Set(["point", "wave", "explain", "facepalm", "shrug", "cheer", "jump", "kick", "bow", "reach"]);
/** حرکت‌هایی که یک لحظه‌اند و بعدش آدمک به حالت عادی برمی‌گردد. */
export const isMomentary = (g: Gesture) => MOMENTARY.has(g);

const HOLDS: Entry<Exclude<Hold, "none">>[] = stems([
  e("phone", ["گوشی", "موبایل", "تلفن همراه"]),
  e("cup", ["چای", "چایی", "قهوه", "فنجان", "لیوان", "استکان"]),
  e("book", ["کتاب", "دفتر", "مجله", "روزنامه"]),
  e("bag", ["کیف", "ساک", "چمدان", "کوله"]),
  e("ball", ["توپ"]),
  e("flowers", ["دسته گل", "دسته‌گل", "شاخه گل"]),
  e("cookie", ["شیرینی", "بیسکویت", "کلوچه", "ساندویچ"]),
]);

const DROPS = ["زمین می‌گذارد", "زمین گذاشت", "کنار می‌گذارد", "کنار گذاشت", "روی میز می‌گذارد", "پرت می‌کند", "می‌اندازد زمین"];

const FACES_FA: Entry<Expression>[] = stems([
  e("laugh", ["می‌خندد", "خنده", "قهقهه", "خندید", "زیر خنده", "خندان", "می‌خنده"]),
  e("grin", ["نیشش باز", "ذوق", "هیجان‌زده", "با هیجان"]),
  e("smile", ["لبخند", "خوشحال", "شاد", "مهربان", "خندون", "با محبت"]),
  e("smirk", ["پوزخند", "زیرکانه", "شیطنت", "شیطون"]),
  e("furious", ["فریاد", "داد می‌زند", "داد زد", "داد میزنه", "خشمگین", "از کوره در", "خیلی عصبانی"]),
  e("angry", ["عصبانی", "اخم", "عصبی", "شاکی", "با تندی", "دعوا"]),
  e("pout", ["قهر", "لب ورچیده", "لب‌ورچیده"]),
  e("cry", ["گریه", "اشک", "گریان", "زار می‌زند", "بغض"]),
  e("sad", ["ناراحت", "غمگین", "دلخور", "غصه", "دلگیر", "افسرده", "ناامید"]),
  e("shocked", ["شوکه", "شوک", "خشکش", "مات و مبهوت", "میخکوب"]),
  e("surprised", ["تعجب", "متعجب", "جا می‌خورد", "جا خورد", "حیرت"]),
  e("scared", ["می‌ترسد", "ترسیده", "ترس", "وحشت", "ترسید"]),
  e("worried", ["نگران", "استرس", "دلهره", "مضطرب", "دستپاچه"]),
  e("content", ["آرام", "راضی", "با آرامش", "آسوده", "سرخوش"]),
  e("kiss", ["بوس", "ماچ", "بوسه"]),
  e("sideEye", ["چپ‌چپ", "چپ چپ", "مشکوک", "با شک", "با بدگمانی"]),
  e("annoyed", ["کلافه", "بی‌حوصله", "حوصله‌اش سر", "کفری", "عاصی"]),
  e("embarrassed", ["خجالت", "سرخ می‌شود", "شرمنده", "خجل", "شرم"]),
  e("thinking", ["فکر می‌کند", "فکر کرد", "در فکر", "توی فکر", "مردد", "تردید"]),
  e("sleepy", ["خواب‌آلود", "خمیازه", "خسته", "چرت"]),
  e("neutral", ["جدی", "خنثی", "بی‌تفاوت", "خونسرد", "بی‌حالت"]),
]);

const SIT = ["نشسته", "می‌نشیند", "نشست", "می‌شیند", "میشینه", "لم داده", "ولو شده", "روی مبل", "روی صندلی", "روی نیمکت", "روی تخت", "پشت میز", "پشت فرمان"];
const STAND = ["ایستاده", "بلند می‌شود", "بلند شد", "بلند میشه", "می‌ایستد", "سر پا", "از جایش بلند", "پا می‌شود", "پاشد"];
const ENTER = ["وارد می‌شود", "وارد شد", "وارد میشه", "میاد تو", "می‌آید داخل", "از در می‌آید", "می‌رسد", "از راه می‌رسد", "داخل می‌شود", "سر می‌رسد", "می‌آید"];
const EXIT = ["بیرون می‌رود", "می‌رود بیرون", "خارج می‌شود", "ترک می‌کند", "بیرون رفت", "می‌ره بیرون", "از صحنه می‌رود", "می‌رود", "رفت"];
const APPROACH = ["به طرف", "به سمت", "نزدیک", "جلو می‌آید", "جلو می‌رود", "پیش"];
/** فعل «رفتن» در این عبارت‌ها یعنی خروج نیست. */
const NOT_EXIT = ["ور می‌رود", "ور میره", "ور رفت", "راه می‌رود", "قدم می‌زند", "از کوره در می‌رود", "یادش می‌رود", "یادش رفت"];

/* ---------- شخصیت‌ها ---------- */

const ROLE: Entry<Kind>[] = [
  e("oldMan", ["پیرمرد", "پدربزرگ", "بابابزرگ", "آقابزرگ", "حاج آقا"]),
  e("oldWoman", ["پیرزن", "مادربزرگ", "مامان‌بزرگ", "مامان بزرگ", "حاج خانم", "بی‌بی"]),
  e("boy", ["پسربچه", "پسر بچه", "پسرک", "پسر"]),
  e("girl", ["دختربچه", "دختر بچه", "دخترک", "دختر"]),
  e("man", ["مرد", "آقا", "پدر", "بابا", "شوهر", "فروشنده", "راننده", "دکتر", "پلیس", "داور", "بازیکن", "گارسون", "مهمان"]),
  e("woman", ["زن", "خانم", "مادر", "مامان", "همسر", "خاله", "عمه", "پرستار"]),
];

const FEMALE_NAMES = [
  "سارا", "مریم", "فاطمه", "زهرا", "نرگس", "لیلا", "الهام", "نازنین", "مینا", "پریسا", "سمیرا", "نگین",
  "هانیه", "زینب", "مهسا", "نیلوفر", "ساناز", "آزاده", "شیما", "رویا", "پونه", "نسرین", "مهناز", "ترانه", "یاسمن",
  "آیدا", "فرشته", "بهاره", "مژگان", "نیوشا", "هستی", "آناهیتا", "کیمیا",
  "ملیکا", "فرزانه", "طاهره", "معصومه", "اکرم", "پروین", "منیژه", "شهلا", "سیمین", "بتول", "نازی", "سمانه", "شبنم",
  "ستاره", "سحر", "رها", "شیرین", "غزل", "مهتاب",
];
const MALE_NAMES = [
  "علی", "محمد", "رضا", "حسین", "امیر", "مهدی", "حسن", "سعید", "احمد", "کیان", "بهرام", "پرویز", "جواد", "مجید",
  "حمید", "وحید", "نوید", "آرش", "بابک", "کامران", "فرهاد", "داریوش", "سیاوش", "پیمان", "پوریا", "آرمان", "سینا",
  "میلاد", "ماهان", "یاسین", "عرفان", "محسن", "مصطفی", "مرتضی", "ناصر", "اکبر", "اصغر", "تقی",
  "کریم", "قاسم", "رحیم", "بهزاد", "شهاب", "کاوه", "رامین", "شاهین", "هومن", "ایمان", "مسعود", "حامد", "کوروش",
  "امید",
];
/** اسم‌هایی که معنی دیگری هم دارند؛ فقط در دیالوگ یا با پرانتز شخصیت می‌شوند. */
const AMBIGUOUS = new Set(["ستاره", "سحر", "رها", "شیرین", "غزل", "مهتاب", "امید"]);

const NAME_KIND = new Map<string, Kind>();
for (const n of FEMALE_NAMES) NAME_KIND.set(normalizeFa(n), "woman");
for (const n of MALE_NAMES) NAME_KIND.set(normalizeFa(n), "man");
const ROLE_WORDS = new Map<string, Kind>();
for (const r of ROLE) for (const a of r.aliases) ROLE_WORDS.set(normalizeFa(a), r.id);

const ATTR_HAIR: [string[], Hair][] = [
  [["روسری", "حجاب", "چادر", "مقنعه"], "scarf"],
  [["دم‌اسبی", "دم اسبی", "موی بسته"], "ponytail"],
  [["فرفری", "موی فر", "مو فر"], "curly"],
  [["کچل", "طاس", "بی‌مو"], "bald"],
  [["موی بلند", "مو بلند", "گیسو بلند"], "long"],
  [["چتری", "موی کوتاه زنانه"], "bob"],
  [["موی کوتاه", "مو کوتاه"], "short"],
];

const words = (text: string) => ` ${normalizeFa(text)} `;
const hasWord = (hay: string, w: string) => hay.includes(` ${normalizeFa(w)} `);
const hasStem = (hay: string, w: string) => hay.includes(` ${normalizeFa(w)}`);
const containsAny = (text: string, list: string[]) => {
  const hay = words(text);
  return list.some((w) => hasStem(hay, w));
};

/** ویژگی‌های داخل پرانتز جلوی اسم: جنسیت/سن، سمت، ظاهر. */
export function parseAttrs(text: string): { kind?: Kind; side?: Side; look: Partial<Look> } {
  const hay = words(text);
  let kind: Kind | undefined = findAll(text, ROLE)[0]?.id;
  const child = ["بچه", "کودک", "نوجوان", "کوچک", "کوچولو"].some((w) => hasWord(hay, w));
  const old = ["پیر", "مسن", "سالمند"].some((w) => hasWord(hay, w));
  const female = kind === "woman" || kind === "girl" || kind === "oldWoman";
  if (child) kind = female ? "girl" : "boy";
  if (old) kind = female ? "oldWoman" : "oldMan";
  let side: Side | undefined;
  if (hasStem(hay, "چپ") && !hasStem(hay, "چپ چپ")) side = "left";
  else if (hasStem(hay, "راست")) side = "right";
  else if (hasWord(hay, "وسط")) side = "center";
  const look: Partial<Look> = {};
  if (hasStem(hay, "عینک")) look.glasses = true;
  if (hasStem(hay, "سبیل")) look.mustache = true;
  if (hasWord(hay, "ریش") || hasWord(hay, "ریشو") || hasWord(hay, "ریشی")) look.beard = true;
  if (hasStem(hay, "کلاه")) look.cap = true;
  for (const [ws, hair] of ATTR_HAIR) {
    if (ws.some((w) => hasStem(hay, w))) {
      look.hair = hair;
      break;
    }
  }
  return { kind, side, look };
}

const hasAnyAttr = (a: ReturnType<typeof parseAttrs>) => !!a.kind || !!a.side || Object.keys(a.look).length > 0;

function kindOfName(name: string): Kind | undefined {
  const n = normalizeFa(name);
  const first = n.split(" ")[0];
  if (first === "آقای" || first === "عمو" || first === "دایی") return "man";
  if (first === "خانم" || first === "خاله" || first === "عمه") return "woman";
  return NAME_KIND.get(n) ?? ROLE_WORDS.get(n) ?? NAME_KIND.get(first);
}

const SPEAK_WORDS = new Set(["می", "گفت", "گوید", "میگه", "گه", "پرسید", "پرسد", "جواب", "داد", "زد", "گفته", "با", "به", "رو"]);
const LEAD_WORDS = new Set(["یک", "یه", "ناگهان", "یهو", "بعد", "سپس", "آنگاه", "دوباره"]);

/** «ناگهان علی گفت» ← «علی»: اسم گوینده را از قید و فعل «گفتن» جدا می‌کند. */
export function cleanSpeaker(raw: string): string {
  const ws = normalizeFa(raw)
    .split(" ")
    .filter((w) => w && !SPEAK_WORDS.has(w) && !LEAD_WORDS.has(w));
  if (ws.length <= 1) return ws.join(" ");
  const all = ws.join(" ");
  if (kindOfName(all)) return all;
  for (const w of ws) if (NAME_KIND.has(w) || ROLE_WORDS.has(w)) return w;
  return all;
}

const DIALOGUE = /^([^:：()（）]{1,40})(?:\s*[(（]([^)）]*)[)）])?\s*[:：]\s*(.+)$/;
const DECL = /([^\s()（）،,:：.]+(?:\s+[^\s()（）،,:：.]+)?)\s*[(（]([^)）]{1,80})[)）]/g;
const NARRATOR = new Set(["راوی", "گوینده", "صدای راوی", "متن", "زیرنویس", "نوشته"]);
const HEAD_PREFIX = /^(صحنه|سکانس|پلان|مکان|لوکیشن)(?:\s|$)/;
const VERBISH = new Set(["می", "است", "هست", "هستند", "شد", "بود", "رفت", "آمد", "نشسته", "ایستاده", "میره", "میاد", "میشه"]);

function placeIn(text: string): PlaceId | undefined {
  // اسم بلندتر دقیق‌تر است («اتاق کار» به‌جای «اتاق»)
  return [...findAll(text, PLACE_ENTRIES)].sort((a, b) => b.alias.length - a.alias.length)[0]?.id;
}

function nightIn(text: string): boolean | undefined {
  const hay = words(text);
  if (NIGHT.some((w) => hasWord(hay, w) || hasWord(hay, `${w} هنگام`))) return true;
  if (DAY.some((w) => hasWord(hay, w))) return false;
  return undefined;
}

function sentences(line: string): string[] {
  return line
    .split(/(?<=[.!؟?…])\s+/)
    .map((s) => s.replace(/[.]+$/, "").trim())
    .filter(Boolean);
}

/* ---------- تحلیل ---------- */

export function parseStory(story: string): StoryPlan {
  const warnings: string[] = [];
  const cast: StoryCastMember[] = [];
  const scenes: StoryScene[] = [];
  const lines = story
    .slice(0, MAX_STORY_CHARS)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const castEntries = (): Entry<string>[] => cast.map((c) => ({ id: c.id, label: c.name, aliases: [c.name] }));
  const byId = (id: string) => cast.find((c) => c.id === id);

  const addCast = (rawName: string, attrs?: string): StoryCastMember | null => {
    const name = normalizeFa(rawName).replace(/^(یک|یه) /, "").trim();
    if (!name || NARRATOR.has(name) || name.split(" ").length > 3) return null;
    let c = byId(name);
    const a = attrs ? parseAttrs(attrs) : { look: {} as Partial<Look> };
    const known = kindOfName(name);
    if (!c) {
      if (cast.length >= MAX_CAST) {
        if (!warnings.some((w) => w.startsWith("حداکثر"))) warnings.push(`حداکثر ${MAX_CAST} شخصیت ساخته می‌شود.`);
        return null;
      }
      c = { id: name, name: rawName.trim().replace(/^(یک|یه)\s+/, "") || name, look: { kind: a.kind ?? known ?? "man", ...a.look }, side: a.side, guessed: !a.kind && !known };
      cast.push(c);
    } else {
      if (a.kind) {
        c.look = { ...c.look, kind: a.kind };
        c.guessed = false;
      }
      c.look = { ...c.look, ...a.look };
      if (a.side) c.side = a.side;
    }
    return c;
  };

  const isHeading = (line: string): boolean => {
    const n = normalizeFa(line);
    if (HEAD_PREFIX.test(n)) return true;
    if (/[:：]/.test(line) || /[.!؟?]$/.test(line.trim())) return false;
    const ws = n.split(" ");
    if (ws.length > 7 || !placeIn(line)) return false;
    // جمله‌ای که فعل یا شخصیت دارد صحنه نیست («علی بیرون می‌رود»)
    if (ws.some((w) => VERBISH.has(w))) return false;
    if (findAll(line, castEntries()).length > 0) return false;
    return true;
  };

  // دور ۱: گوینده‌های دیالوگ و شخصیت‌هایی که با پرانتز معرفی شده‌اند
  for (const line of lines) {
    if (HEAD_PREFIX.test(normalizeFa(line))) continue;
    const d = DIALOGUE.exec(line);
    if (d) {
      const speaker = cleanSpeaker(d[1]);
      if (!NARRATOR.has(speaker)) addCast(speaker, d[2] && hasAnyAttr(parseAttrs(d[2])) ? d[2] : undefined);
    }
    const body = d ? d[3] : line;
    for (const m of body.matchAll(DECL)) {
      if (!hasAnyAttr(parseAttrs(m[2]))) continue;
      const ws = normalizeFa(m[1]).split(" ");
      const two = ws.join(" ");
      const name = ws.length === 2 && kindOfName(two) && !ROLE_WORDS.has(ws[1]) && !NAME_KIND.has(ws[1]) ? two : ws[ws.length - 1];
      if (!kindOfName(name) && !byId(name) && !parseAttrs(m[2]).kind) continue; // «(با لبخند)» بعد از یک کلمهٔ معمولی
      addCast(name, m[2]);
    }
  }
  // دور ۲: اسم‌های آشنا و نقش‌ها که اول جمله (فاعل) آمده‌اند
  for (const line of lines) {
    if (HEAD_PREFIX.test(normalizeFa(line)) || DIALOGUE.test(line)) continue;
    for (const s of sentences(line)) {
      const ws = normalizeFa(s.replace(/[(（][^)）]*[)）]/g, " ")).split(" ");
      let i = 0;
      while (i < ws.length && (LEAD_WORDS.has(ws[i]) || ["همان", "لحظه", "موقع", "کمی", "آرام", "شب", "صبح", "روز"].includes(ws[i]))) i++;
      for (;;) {
        const w = ws[i];
        if (!w) break;
        const two = `${w} ${ws[i + 1] ?? ""}`.trim();
        if (ROLE_WORDS.has(two)) {
          if (!byId(two)) addCast(two);
          i += 2;
        } else if ((NAME_KIND.has(w) && !AMBIGUOUS.has(w)) || ROLE_WORDS.has(w)) {
          if (!byId(w)) addCast(w);
          i += 1;
        } else if (byId(w)) i += 1;
        else break;
        if (ws[i] === "و") i++;
        else break;
      }
    }
  }

  let scene: StoryScene | null = null;
  let placeSet = false;
  let nightSet = false;
  let lastPlace: PlaceId = "blank";
  let lastNight = false;
  const open = (heading: string): StoryScene => {
    const place = placeIn(heading);
    const night = nightIn(heading);
    placeSet = !!place;
    nightSet = night !== undefined;
    const sc: StoryScene = { heading, place: place ?? lastPlace, night: night ?? lastNight, beats: [] };
    if (heading && !place && sc.place === "blank") warnings.push(`مکانِ «${heading}» شناخته نشد؛ زمینهٔ ساده گذاشته شد.`);
    scenes.push(sc);
    scene = sc;
    return sc;
  };

  /** حرکت‌های یک جمله. اگر `speaker` داده شود (توضیح داخل پرانتز دیالوگ)، همه مال گوینده است. */
  const actsFor = (text: string, speaker: string | null): Act[] => {
    const names = findAll(text, castEntries());
    const n = normalizeFa(text);
    const acts = new Map<string, Act>();
    const act = (who: string) => {
      let a = acts.get(who);
      if (!a) acts.set(who, (a = { who }));
      return a;
    };
    let subj: string[];
    if (speaker) subj = [speaker];
    else {
      if (names.length === 0) return [];
      subj = [names[0].id];
      for (let i = 1; i < names.length; i++) {
        const between = n.slice(names[i - 1].at + names[i - 1].alias.length, names[i].at).trim();
        if (between === "و" || between === "") subj.push(names[i].id);
        else break;
      }
    }
    const objects = names.filter((m) => !subj.includes(m.id));
    const all = (fn: (a: Act) => void) => subj.forEach((w) => fn(act(w)));
    const approach = containsAny(text, APPROACH) && objects.length > 0 && !containsAny(text, ["کنار هم"]);
    if (containsAny(text, SIT)) all((a) => (a.sit = true));
    if (containsAny(text, STAND)) all((a) => (a.sit = false));
    if (containsAny(text, ENTER) && !containsAny(text, ["جلو می‌آید"])) {
      all((a) => {
        a.move = "enter";
        if (approach) a.target = objects[0].id;
      });
    } else if (approach) {
      all((a) => {
        a.move = "approach";
        a.target = objects[0].id;
      });
    }
    else if (containsAny(text, ["سمت چپ", "به چپ", "طرف چپ"])) all((a) => (a.move = "toLeft"));
    else if (containsAny(text, ["سمت راست", "به راست", "طرف راست"])) all((a) => (a.move = "toRight"));
    else if (containsAny(text, ["وسط"]) && containsAny(text, ["می‌رود", "می‌آید", "میره"])) all((a) => (a.move = "toCenter"));
    else if (containsAny(text, EXIT) && !containsAny(text, NOT_EXIT)) all((a) => (a.move = "exit"));

    /** هر کلمهٔ حالت مال نزدیک‌ترین فاعلِ قبل از آن است؛ اگر بعد از همهٔ فاعل‌ها بیاید مال همه. */
    const owner = (m: Match<string>): string[] => {
      if (speaker) return [speaker];
      const subjMatches = names.filter((x) => subj.includes(x.id));
      const lastSubj = subjMatches[subjMatches.length - 1];
      const before = names.filter((x) => x.at <= m.at);
      const near = before[before.length - 1];
      if (!near || !subj.includes(near.id)) return [subj[0]]; // «به سارا لبخند می‌زند» ← فاعل
      if (near === lastSubj && subj.length > 1) return subj;
      return [near.id];
    };
    for (const m of findAll(text, GESTURES)) {
      for (const w of owner(m)) {
        const a = act(w);
        a.gesture ??= m.id;
        if (m.id === "think") a.thought = true;
        if ((m.id === "point" || m.id === "reach") && objects[0]) a.target ??= objects[0].id;
      }
    }
    for (const m of findAll(text, HOLDS)) for (const w of owner(m)) act(w).hold ??= m.id;
    for (const m of findAll(text, FACES_FA)) for (const w of owner(m)) act(w).face ??= m.id;
    if (containsAny(text, DROPS)) all((a) => (a.drop = true));
    for (const a of acts.values()) {
      if (a.gesture === "phoneEar") a.hold = "phone";
      if (a.gesture === "drive") a.sit = true;
      if (a.gesture === "think") a.face ??= "thinking";
    }
    return [...acts.values()];
  };

  for (const line of lines) {
    if (isHeading(line)) {
      open(line);
      continue;
    }
    const sc: StoryScene = scene ?? open("");
    const d = DIALOGUE.exec(line);
    if (d) {
      const speakerName = cleanSpeaker(d[1]);
      const inner: string[] = d[2] ? [d[2]] : [];
      const said = d[3]
        .replace(/[(（]([^)）]*)[)）]/g, (_m, x: string) => {
          inner.push(x);
          return " ";
        })
        .replace(/\s+/g, " ")
        .trim();
      const who = byId(speakerName);
      if (NARRATOR.has(speakerName) || !who) {
        if (said) sc.beats.push({ kind: "narration", text: said });
        continue;
      }
      const dir = inner.join("، ");
      sc.beats.push({ kind: "line", speaker: who.id, text: said, acts: dir ? actsFor(dir, who.id) : [] });
      continue;
    }
    for (const s of sentences(line)) {
      // جملهٔ توصیفی در صحنه‌ای که مکان/زمانش هنوز معلوم نیست، آن را معلوم می‌کند
      if (!placeSet) {
        const p = placeIn(s);
        if (p) {
          sc.place = p;
          placeSet = true;
        }
      }
      if (!nightSet) {
        const nt = nightIn(s);
        if (nt !== undefined) {
          sc.night = nt;
          nightSet = true;
        }
      }
      // معرفی‌های داخل پرانتز («علی (مرد، سمت راست)») جزو حرکت جمله نیستند
      const plain = s.replace(/[(（][^)）]*[)）]/g, " ").replace(/\s+/g, " ").trim();
      sc.beats.push({ kind: "action", text: plain, acts: actsFor(plain, null) });
    }
    lastPlace = sc.place;
    lastNight = sc.night;
  }
  if (scenes.length === 0) open("");

  for (const c of cast) {
    if (c.guessed) warnings.push(`جنسیت «${c.name}» از متن معلوم نبود؛ مرد در نظر گرفته شد. اگر زن است بنویسید «${c.name} (زن)».`);
  }
  if (cast.length === 0) warnings.push("هیچ شخصیتی پیدا نشد. شخصیت‌ها را این‌طور معرفی کنید: «علی (مرد، سمت راست)».");
  return { cast, scenes, warnings };
}
