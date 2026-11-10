/**
 * سه برگهٔ Gemini (بدن، سر، دهان‌ها) + جای دهان/چشم (Gemini) → CharacterKit با تصویرهای PNG جدا.
 * encode تابع تبدیل RGBA به PNG است (سرور: pngjs) تا این فایل به کتابخانهٔ خاصی وابسته نباشد.
 */
import { assign, blobInBox, blobs, cut, inset, keyGreen, limbJoints, peelSkin, removeThin, trim, type Blob, type Box, type Pt, type Rgba } from "./process.ts";
import { KIT_MOUTHS, type CharacterKit, type KitImage, type KitMouth } from "./kit.ts";

/** قاب‌های قالب برگهٔ بدن (روی تصویر ۱۰۲۴×۱۰۲۴؛ همان template.png). */
export const BODY_BOXES = {
  torso: [40, 40, 380, 560],
  upperArm: [460, 40, 140, 380],
  forearm: [640, 40, 140, 380],
  hand: [820, 40, 164, 240],
  thigh: [460, 460, 170, 420],
  shin: [670, 460, 150, 420],
  foot: [840, 620, 150, 220],
} satisfies Record<string, Box>;

/** box_2d نرمال‌شدهٔ Gemini ([ymin,xmin,ymax,xmax] از ۰ تا ۱۰۰۰). */
export type FaceBoxes = { mouth: number[]; leftEye: number[]; rightEye: number[] };
export type BodyPartName = keyof typeof BODY_BOXES;
/** جای هر تکه روی برگهٔ بدن طبق تشخیص Gemini (box_2d). */
export type PartBoxes = Record<BodyPartName, number[]>;

const fromBox2d = (b: number[], w: number, h: number): Box => [(b[1] / 1000) * w, (b[0] / 1000) * h, ((b[3] - b[1]) / 1000) * w, ((b[2] - b[0]) / 1000) * h];

/** برگهٔ بدن تمیزشده (سبز → شفاف، خط‌های نازک قاب حذف) و تکه‌هایش؛ اول از قاب‌های Gemini، وگرنه از قالب. */
export function bodyParts(sheet: Rgba, detected?: PartBoxes): Record<BodyPartName, Rgba> {
  const body = removeThin(keyGreen(sheet), Math.max(2, Math.round(sheet.width / 300)));
  const { blobs: bb, labels } = blobs(body, Math.round(body.width * body.height * 0.0015));
  let got: Record<BodyPartName, Blob>;
  if (detected) {
    const used = new Set<number>();
    got = {} as Record<BodyPartName, Blob>;
    // تکه‌های بزرگ‌تر اول، تا تکهٔ کوچک ناحیهٔ بزرگ را نگیرد
    for (const k of ["torso", "thigh", "shin", "forearm", "upperArm", "hand", "foot"] as BodyPartName[]) {
      const b = blobInBox(bb, labels, body.width, fromBox2d(detected[k], body.width, body.height), used);
      if (!b) throw new Error(`تکهٔ ${k} روی برگه جدا نیست`);
      used.add(b.id);
      got[k] = b;
    }
  } else got = assign(bb, BODY_BOXES, body.width / 1024);
  const out = {} as Record<BodyPartName, Rgba>;
  for (const k of Object.keys(BODY_BOXES) as BodyPartName[]) out[k] = cut(body, labels, got[k]).img;
  return out;
}

/** تکه‌ها شکل درستی دارند؟ (اندام‌ها کشیده، تنه بی‌دست، پنجه و کفش کوچک‌تر از تنه) — پیام خطا یا null. */
export function checkBodyParts(p: Record<BodyPartName, Rgba>): string | null {
  for (const k of ["upperArm", "forearm", "thigh", "shin"] as const) if (p[k].height < p[k].width * 1.6) return `${k} کشیده نیست`;
  if (p.torso.width > p.torso.height * 1.25) return "تنه پهن‌تر از حد (احتمالاً با دست کشیده شده)";
  for (const k of ["hand", "foot"] as const) if (p[k].width * p[k].height > p.torso.width * p.torso.height * 0.6) return `${k} بیش از حد بزرگ است`;
  return null;
}

type Encode = (img: Rgba) => string;

function span(img: Rgba, y: number): [number, number] | null {
  let l = -1, r = -1;
  for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3] > 128) { if (l < 0) l = x; r = x; }
  return l < 0 ? null : [l, r];
}

/** مفصل‌های تنه: گردن (بالای وسط)، شانه (جایی که پهنا به ۸۵٪ بیشینه می‌رسد)، لگن (نزدیک پایین). */
export function torsoJoints(t: Rgba): { neck: Pt; shoulder: Pt; hip: Pt } {
  let maxW = 0;
  for (let y = 0; y < t.height; y++) { const s = span(t, y); if (s) maxW = Math.max(maxW, s[1] - s[0]); }
  let top = 0;
  for (let y = 0; y < t.height; y++) if (span(t, y)) { top = y; break; }
  let shY = Math.round(t.height * 0.2);
  for (let y = top; y < t.height * 0.45; y++) { const s = span(t, y); if (s && s[1] - s[0] >= maxW * 0.85) { shY = y; break; } }
  const sh = span(t, Math.min(t.height - 1, shY + Math.round(t.height * 0.04))) ?? [0, t.width - 1];
  const hipY = Math.round(t.height * 0.88);
  const hp = span(t, hipY) ?? [t.width * 0.25, t.width * 0.75];
  const cx = t.width / 2;
  const shoulderInset = (sh[1] - sh[0]) * 0.13;
  return {
    neck: { x: cx, y: top + t.height * 0.13 },
    shoulder: { x: sh[0] + shoulderInset, y: shY + t.height * 0.05 },
    hip: { x: cx - (hp[1] - hp[0]) * 0.22, y: hipY },
  };
}

const img = (encode: Encode, i: Rgba): KitImage => ({ src: encode(i), w: i.width, h: i.height });

/** میانگین رنگ پوست دست (برای سازگاری‌های بعدی، مثل گوش یا گردن). */
function skinOf(hand: Rgba): string {
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < hand.data.length; i += 4) if (hand.data[i + 3] > 250) { r += hand.data[i]; g += hand.data[i + 1]; b += hand.data[i + 2]; n++; }
  const h = (v: number) => Math.round(v / Math.max(1, n)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** سر = بزرگ‌ترین ناحیهٔ سمت چپ برگه؛ پلک بسته = ناحیهٔ پهن پایین-راست. */
export function headFromSheet(sheet: Rgba): { head: Rgba; blink?: Rgba } {
  const headSheet = removeThin(keyGreen(sheet), Math.max(2, Math.round(sheet.width / 300)));
  const hb = blobs(headSheet, Math.round(headSheet.width * headSheet.height * 0.003));
  const sorted = [...hb.blobs].sort((a, b) => b.area - a.area);
  const headB = sorted.find((b) => b.box[2] < headSheet.width * 0.6 && b.box[3] < headSheet.height * 0.95) ?? sorted[0];
  if (!headB) throw new Error("سر در برگهٔ Gemini پیدا نشد.");
  const blinkB = hb.blobs.filter((b) => b !== headB && b.cy > headSheet.height * 0.6 && b.cx > headSheet.width * 0.55 && b.box[2] > b.box[3] * 1.5).sort((a, b) => b.area - a.area)[0];
  return { head: cut(headSheet, hb.labels, headB).img, ...(blinkB ? { blink: trim(inset(cut(headSheet, hb.labels, blinkB, 0).img, 0.04)).img } : {}) };
}

export function buildKit(name: string, sheets: { body: Rgba; head: Rgba; mouths: Rgba; face: FaceBoxes; parts?: PartBoxes }, encode: Encode): CharacterKit {
  // ── بدن
  const { torso, upperArm: upper, forearm: fore, hand, thigh, shin, foot } = bodyParts(sheets.body, sheets.parts);
  const limbOf = (i: Rgba) => ({ ...img(encode, i), ...(({ top, bottom }) => ({ a: top, b: bottom }))(limbJoints(i)) });

  // ── سر و پلک بسته (همان بُرشی که برای تشخیص دهان به Gemini رفته بود)
  const { head, blink } = headFromSheet(sheets.head);

  // جای دهان و چشم از box_2d (نسبت به تصویر سرِ بریده‌شده)
  const fb = sheets.face;
  const toHead = (b: number[]) => ({ x: (b[1] / 1000) * head.width, y: (b[0] / 1000) * head.height, w: ((b[3] - b[1]) / 1000) * head.width, h: ((b[2] - b[0]) / 1000) * head.height });
  const mb = toHead(fb.mouth);
  let neckRow = head.height - 1;
  for (let y = head.height - 1; y > 0; y--) if (span(head, y)) { neckRow = y; break; }

  // ── دهان‌ها: ۹ مربع به ترتیب سطر/ستون؛ پوست دور لب برداشته می‌شود
  const ms = keyGreen(sheets.mouths);
  const mbl = blobs(ms, Math.round(ms.width * ms.height * 0.004));
  const cells = [...mbl.blobs].sort((a, b) => b.area - a.area).slice(0, 9);
  const rowH = ms.height / 3;
  cells.sort((a, b) => Math.floor(a.cy / rowH) - Math.floor(b.cy / rowH) || a.cx - b.cx);
  if (cells.length < 9) throw new Error(`برگهٔ دهان ۹ دهان ندارد (${cells.length})`);
  const mouths = {} as Record<KitMouth, KitImage>;
  KIT_MOUTHS.forEach((m, i) => { mouths[m] = img(encode, trim(peelSkin(inset(cut(ms, mbl.labels, cells[i], 0).img), 34)).img); });

  return {
    version: 1,
    name,
    torso: { ...img(encode, torso), ...torsoJoints(torso) },
    upperArm: limbOf(upper),
    forearm: limbOf(fore),
    hand: { ...img(encode, hand), a: { x: hand.width / 2, y: hand.height * 0.1 } },
    thigh: limbOf(thigh),
    shin: limbOf(shin),
    foot: { ...img(encode, foot), a: { x: foot.width * 0.62, y: foot.height * 0.18 } },
    head: {
      ...img(encode, head),
      // ته گردنِ سر روی خط یقهٔ تنه می‌نشیند (سر بعد از تنه کشیده می‌شود و گردنِ کوتاه تنه را می‌پوشاند)
      neck: { x: head.width / 2, y: neckRow - head.height * 0.015 },
      mouth: { x: mb.x + mb.w / 2, y: mb.y + mb.h / 2, w: mb.w },
      eyes: [toHead(fb.leftEye), toHead(fb.rightEye)],
    },
    mouths,
    ...(blink ? { blink: img(encode, blink) } : {}),
    skin: skinOf(hand),
  };
}
