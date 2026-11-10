/**
 * ساخت «کیت شخصیت» با Gemini روی Vertex AI (فقط سرور):
 *  ۱) برگهٔ اعضای بدن (لباس از روی توضیح) روی قالب ثابت       ← gemini-3-pro-image
 *  ۲) سر کارتونی از روی عکس واقعی (بدون دهان) + پلک بسته        ← gemini-3-pro-image (هم‌زمان با ۱)
 *  ۳) ۹ دهان لب‌خوانی با همان سبک، از روی سر ساخته‌شده          ← gemini-3-pro-image
 *  ۴) جای دهان و چشم‌ها روی سر (box_2d)                          ← gemini-3.8-flash
 *  ۵) جدا کردن تکه‌ها و مفصل‌ها بدون مدل (src/studio/kit/build.ts) و ذخیره در Cloud Storage
 * همهٔ آزمون‌های زنده روی پروژهٔ anime-512918 (منطقهٔ global) انجام شده است.
 */
import { randomBytes } from "node:crypto";
import { PNG } from "pngjs";
import { gcpAccessToken } from "./gcp-auth.server.ts";
import { gcsPut } from "./gcs.server.ts";
import { BODY_TEMPLATE_PNG, HEAD_TEMPLATE_PNG } from "./kit-templates.ts";
import { bodyParts, buildKit, checkBodyParts, headFromSheet, type FaceBoxes, type PartBoxes } from "../studio/kit/build.ts";
import type { CharacterKit } from "../studio/kit/kit.ts";
import type { Rgba } from "../studio/kit/process.ts";

export const KIT_IMAGE_MODEL = process.env.KIT_IMAGE_MODEL?.trim() || "gemini-3-pro-image";
export const KIT_TEXT_MODEL = process.env.KIT_TEXT_MODEL?.trim() || "gemini-3.8-flash";
const LOCATION = "global";
type Img = { mimeType: string; data: string };

const STYLE = "professional flat 2D cartoon style for TV animation: clean bold dark outline of even width, flat colors with one soft cel-shade tone, no texture, no gradients, no realism";

export function bodyPrompt(description: string): string {
  return `The attached image is a cut-out animation PARTS TEMPLATE for a 2D puppet rig (like Cartoon Animator / Moho cut-out characters).
Draw the body parts of ONE character, each part alone inside its own dashed box, filling the box height, centered horizontally.

Character: ${description}

Strict rules:
- ${STYLE}.
- Front view, standing pose parts. Draw only the character's RIGHT-side limbs (one upper arm, one forearm, one hand, one thigh, one shin, one foot); they will be mirrored for the left side.
- TORSO box: neck stub at the top (no head), shoulders, chest with the clothing, waist and hips/pelvis at the bottom. The torso has NO arms and NO sleeves: the clothing is cut off cleanly at the shoulders (the arms are separate parts).
- UPPER ARM: sleeve (or bare arm) from shoulder to elbow, vertical. FOREARM: from elbow to wrist, vertical. HAND: open relaxed hand, palm toward the viewer, fingers pointing down.
- THIGH: from hip to knee, vertical. SHIN: from knee to ankle, vertical. FOOT: shoe seen from the front-side, toe pointing to the viewer's left.
- The top end and the bottom end of every arm and leg part are joints: draw both ends as ROUNDED caps (like a capsule), so parts overlap without visible seams when rotated. Each part fills its box from top to bottom.
- Plain clothing only: no dots, circles, markers, stitches or symbols that are not part of the described clothing.
- Keep the background PURE flat green #00FF00 everywhere outside the parts. Remove the dashed boxes, dots and text labels from the result.
- Do not draw anything else. No shadows on the background.`;
}

export function headPrompt(description: string): string {
  return `Image 1 is a photo of a real person. Image 2 is a HEAD PARTS TEMPLATE for a 2D cut-out animation puppet.
Turn this person into a cartoon character and draw the parts into the template boxes.
${description ? `Character notes: ${description}\n` : ""}
Style (must match the body already drawn for this character): ${STYLE}. Keep the person's likeness: face shape, hairline and hair, facial hair, eyebrows, skin tone.

Boxes:
- Big box: the HEAD seen from the front, with hair, ears and a short neck at the bottom. Leave the MOUTH AREA EMPTY: plain skin (or beard) where the mouth would be, no lips drawn. Eyes open, looking at the viewer.
- Wide box at the bottom right: the two CLOSED EYES (eyelids and lashes only, same spacing as on the head), for blinking.
- Leave the nine small boxes empty.

Background: PURE flat green #00FF00 everywhere outside the drawings. Remove the dashed boxes and the text labels.`;
}

export const MOUTH_PROMPT = `The attached image is a cartoon head (drawn with the mouth area left empty). Draw ONLY this character's MOUTH in 9 shapes for lip-sync, in exactly the same flat 2D cartoon style, line weight and lip/skin colors.

Layout: a 3 x 3 grid on a pure flat green #00FF00 background. Each mouth is small, the same width (about one quarter of the image width), centered in its grid cell, with lots of green space between them. Draw ONLY the lips, and the teeth/tongue/mouth cavity where visible. NO skin patch, NO beard, NO chin, NO face, NO text, NO numbers, NO frames.

Order, left to right, top to bottom:
1 relaxed closed lips
2 lips pressed together (M, B, P)
3 wide open (AA)
4 half open with upper teeth visible (EH)
5 wide with teeth together (EE)
6 round open (OH)
7 small round pucker (OO)
8 upper teeth resting on the lower lip (F, V)
9 open with tongue tip behind the upper teeth (L, TH)`;

const host = "aiplatform.googleapis.com";
const modelUrl = (project: string, model: string) => `https://${host}/v1/projects/${encodeURIComponent(project)}/locations/${LOCATION}/publishers/google/models/${encodeURIComponent(model)}:generateContent`;

async function headers(project: string) {
  return { authorization: `Bearer ${await gcpAccessToken()}`, "content-type": "application/json", "x-goog-user-project": project };
}

/** یک تصویر از Gemini؛ سهمیهٔ پر (429) و خطای سرور با مکث ۵، ۱۵ و ۳۰ ثانیه دوباره امتحان می‌شود. */
export async function geminiImage(project: string, prompt: string, refs: Img[], aspectRatio = "1:1"): Promise<Img> {
  let last = "";
  // 429 (سهمیهٔ لحظه‌ای Vertex) و 5xx با مکث بیشتر دوباره امتحان می‌شوند؛ پاسخ بدون تصویر یک بار
  const waits = [5_000, 15_000, 30_000];
  for (let attempt = 0; attempt <= waits.length; attempt++) {
    if (attempt > 0 && /^(429|5\d\d)/.test(last)) await new Promise((res) => setTimeout(res, waits[attempt - 1]));
    else if (attempt > 1) break;
    const r = await fetch(modelUrl(project, KIT_IMAGE_MODEL), {
      method: "POST",
      headers: await headers(project),
      body: JSON.stringify({
        contents: [{ role: "user", parts: [...refs.map((inlineData) => ({ inlineData })), { text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio } },
      }),
      signal: AbortSignal.timeout(150_000),
    });
    const j = (await r.json().catch(() => ({}))) as { candidates?: { finishReason?: string; content?: { parts?: { inlineData?: Img }[] } }[]; error?: { message?: string } };
    if (!r.ok) {
      last = `${r.status}: ${j.error?.message?.slice(0, 160) ?? ""}`;
      if (r.status < 500 && r.status !== 429) break;
      continue;
    }
    const img = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
    if (img) return img;
    last = `بدون تصویر (${j.candidates?.[0]?.finishReason ?? "?"})`;
  }
  throw new Error(`Gemini تصویر نساخت: ${last}`);
}

const BOX = { type: "ARRAY", items: { type: "INTEGER" } };
const PARTS_SCHEMA = {
  type: "OBJECT",
  properties: { torso: BOX, upperArm: BOX, forearm: BOX, hand: BOX, thigh: BOX, shin: BOX, foot: BOX, torsoHasArms: { type: "BOOLEAN" }, allSeparate: { type: "BOOLEAN" } },
  required: ["torso", "upperArm", "forearm", "hand", "thigh", "shin", "foot", "torsoHasArms", "allSeparate"],
};

/** Gemini برگهٔ بدن را بررسی می‌کند: جای هر تکه (box_2d) و اینکه تنه دست دارد یا تکه‌ها به هم چسبیده‌اند. */
export async function detectParts(project: string, sheet: Img): Promise<PartBoxes & { torsoHasArms: boolean; allSeparate: boolean }> {
  const text = await geminiJson(project, sheet, "This is a sheet of separate cut-out body parts of one cartoon character on a green background. Return box_2d [ymin, xmin, ymax, xmax] normalized 0-1000 for each part: torso (neck to hips, the largest piece), upperArm (shoulder to elbow sleeve), forearm (elbow to wrist, with the cuff), hand, thigh (hip to knee), shin (knee to ankle), foot (shoe). torsoHasArms = true if the torso piece has sleeves or arms attached to it. allSeparate = true only if every part is its own separate piece not touching the others.", PARTS_SCHEMA);
  return text as PartBoxes & { torsoHasArms: boolean; allSeparate: boolean };
}

async function geminiJson(project: string, image: Img, prompt: string, schema: unknown): Promise<Record<string, unknown>> {
  const r = await fetch(modelUrl(project, KIT_TEXT_MODEL), {
    method: "POST",
    headers: await headers(project),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inlineData: image }, { text: prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingBudget: 0 } },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const j = (await r.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  if (!r.ok) throw new Error(`Gemini ${r.status}`);
  return JSON.parse(j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "{}") as Record<string, unknown>;
}

const FACE_SCHEMA = {
  type: "OBJECT",
  properties: { mouth: { type: "ARRAY", items: { type: "INTEGER" } }, leftEye: { type: "ARRAY", items: { type: "INTEGER" } }, rightEye: { type: "ARRAY", items: { type: "INTEGER" } } },
  required: ["mouth", "leftEye", "rightEye"],
};

/** جای دهان و چشم‌ها روی سرِ بدون دهان (box_2d، نرمال ۰ تا ۱۰۰۰). */
export async function detectFace(project: string, head: Img): Promise<FaceBoxes> {
  const r = await fetch(modelUrl(project, KIT_TEXT_MODEL), {
    method: "POST",
    headers: await headers(project),
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inlineData: head }, { text: "This cartoon head was drawn with the mouth left blank. Return box_2d boxes [ymin, xmin, ymax, xmax] normalized 0-1000 for: mouth = where the lips belong (natural lip width and position), leftEye and rightEye (image left/right, eye whites and lids only)." }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: FACE_SCHEMA, thinkingConfig: { thinkingBudget: 0 } },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  const j = (await r.json().catch(() => ({}))) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const v = JSON.parse(text) as FaceBoxes;
  const ok = (b: unknown) => Array.isArray(b) && b.length === 4 && b.every((n) => typeof n === "number" && n >= 0 && n <= 1000) && b[2] > b[0] && b[3] > b[1];
  if (!r.ok || !ok(v.mouth) || !ok(v.leftEye) || !ok(v.rightEye)) throw new Error("جای دهان و چشم روی سر پیدا نشد.");
  return v;
}

const decode = (img: Img): Rgba => {
  const p = PNG.sync.read(Buffer.from(img.data, "base64"));
  return { width: p.width, height: p.height, data: new Uint8Array(p.data.buffer, p.data.byteOffset, p.data.length) };
};
const encodePng = (i: Rgba): Buffer => {
  const p = new PNG({ width: i.width, height: i.height });
  p.data = Buffer.from(i.data);
  return PNG.sync.write(p);
};

/**
 * برگهٔ بدنِ قابل‌استفاده: Gemini می‌کشد، Gemini بررسی می‌کند (جای تکه‌ها، تنهٔ بی‌دست، تکه‌های جدا)،
 * و شکل تکه‌ها بدون مدل سنجیده می‌شود؛ اگر نشد تا سه بار از نو کشیده می‌شود.
 */
async function goodBody(project: string, description: string, ref: Img): Promise<{ body: Img; parts: PartBoxes }> {
  let why = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    const body = await geminiImage(project, bodyPrompt(description) + (why ? `\n\nThe previous attempt was rejected: ${why}. Follow the rules exactly.` : ""), [ref]);
    const det = await detectParts(project, body).catch(() => null);
    if (!det) { why = "parts could not be located"; continue; }
    if (det.torsoHasArms) { why = "the torso had arms or sleeves attached"; continue; }
    if (!det.allSeparate) { why = "some parts touched each other"; continue; }
    try {
      const p = bodyParts(decode(body), det);
      const bad = checkBodyParts(p);
      if (!bad) return { body, parts: det };
      why = bad;
    } catch (e) {
      why = (e as Error).message;
    }
    console.warn("[kit] body sheet rejected:", why);
  }
  throw new Error(`Gemini تکه‌های بدن را درست نکشید (${why}). دوباره امتحان کنید یا توضیح لباس را ساده‌تر کنید.`);
}

/** ورودی عکس: PNG یا JPEG، حداکثر ۶ مگابایت. */
export function photoInput(dataUrl: string): Img {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error("عکس سر باید PNG، JPEG یا WebP باشد.");
  if (m[2].length > 8_000_000) throw new Error("عکس سر بزرگ‌تر از ۶ مگابایت است.");
  return { mimeType: m[1], data: m[2] };
}

export type KitStore = { put: (name: string, bytes: Uint8Array) => Promise<void>; url: (name: string) => string };

/** کل خط تولید؛ مدت معمول حدود یک دقیقه. */
export async function makeCharacterKit(opts: { project: string; name: string; description: string; photo: Img; store: KitStore; onStep?: (s: string) => void }): Promise<CharacterKit> {
  const { project, store } = opts;
  const bodyRef: Img = { mimeType: "image/png", data: BODY_TEMPLATE_PNG };
  const headRef: Img = { mimeType: "image/png", data: HEAD_TEMPLATE_PNG };
  opts.onStep?.("body+head");
  const [{ body, parts }, head] = await Promise.all([goodBody(project, opts.description, bodyRef), geminiImage(project, headPrompt(opts.description), [opts.photo, headRef])]);
  // دهان‌ها و جای دهان از روی سرِ بریده‌شده ساخته می‌شوند (نه کل برگه)
  const headSheet = decode(head);
  opts.onStep?.("mouths+face");
  const headOnly = (() => {
    const k = headFromSheet(headSheet).head;
    return { mimeType: "image/png", data: encodePng(k).toString("base64") };
  })();
  const [mouths, face] = await Promise.all([geminiImage(project, MOUTH_PROMPT, [headOnly]), detectFace(project, headOnly)]);
  opts.onStep?.("build");
  const id = randomBytes(9).toString("base64url");
  const files: { name: string; bytes: Buffer }[] = [];
  const kit = buildKit(opts.name, { body: decode(body), head: headSheet, mouths: decode(mouths), face, parts }, (img) => {
    const name = `${id}/${files.length}.png`;
    files.push({ name, bytes: encodePng(img) });
    return store.url(name);
  });
  await Promise.all(files.map((f) => store.put(f.name, f.bytes)));
  await store.put(`${id}/kit.json`, new TextEncoder().encode(JSON.stringify(kit)));
  return kit;
}

/** ذخیره در Cloud Storage: kits/<id>/<n>.png؛ خواندن از /api/kit?f=… (هم‌دامنه، پس canvas آلوده نمی‌شود). */
export function gcsKitStore(bucket: string): KitStore {
  return {
    put: async (name, bytes) => {
      const auth = { authorization: `Bearer ${await gcpAccessToken()}` };
      const type = name.endsWith(".json") ? "application/json" : "image/png";
      if (!(await gcsPut(bucket, `kits/${name}`, bytes, type, auth))) throw new Error("ذخیرهٔ کیت در Cloud Storage انجام نشد.");
    },
    url: (name) => `/api/kit?f=${encodeURIComponent(name)}`,
  };
}

/** فقط فایل‌های همین کیت‌ها خوانده می‌شوند (شناسهٔ تصادفی ۱۲ حرفی). */
export const KIT_FILE = /^[A-Za-z0-9_-]{12}\/(?:\d{1,3}\.png|kit\.json)$/;
