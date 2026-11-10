/**
 * ساخت عروسک از هنرِ Gemini (فقط سرور): تصویر تمام‌قد → پس‌زمینهٔ شفاف → مفاصل → فایل عروسک.
 * پس از این مرحله، انیمیشن کاملاً کار موتور خودِ BEHIX است و هیچ مدلی در رندر دخالت ندارد.
 */
import { PNG } from "pngjs";
import { gcpAccessToken, gcpProject } from "./gcp-auth.server.ts";
import { STYLE, generateImage, putObject } from "./studio-media.server.ts";
import { JOINT_NAMES, PART_DEPTH, bonesOf, jointsToPixels, measureBody, validateJoints, type Bone, type Joints, type Part, type PuppetRig } from "../studio/v2/puppet.ts";

export const TEXT_MODEL = process.env.STUDIO_TEXT_MODEL || "gemini-3.8-flash";
export const TEXT_LOCATION = process.env.STUDIO_TEXT_LOCATION || "global";

/**
 * پس‌زمینهٔ یکدستِ روشن را شفاف می‌کند.
 * از لبه‌های تصویر پخش می‌شود (flood fill) تا فقط پس‌زمینهٔ متصل به بیرون برداشته شود؛
 * پیراهن سفید یا کفش سفیدِ داخل بدن دست‌نخورده می‌ماند. لبه‌ها نرم می‌شوند تا بُرش دندانه‌دار نباشد.
 */
export function keyOutBackground(png: PNG, threshold = 234): PNG {
  const { width: w, height: h, data } = png;
  const bg = new Uint8Array(w * h);
  const lum = (i: number) => 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (bg[p] || lum(p * 4) < threshold) return;
    bg[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop() as number;
    const x = p % w, y = (p - x) / w;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }
  // لبهٔ نرم: پیکسل‌های روشنِ چسبیده به پس‌زمینه نیمه‌شفاف می‌شوند.
  const soft = threshold - 36;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x, i = p * 4;
      if (bg[p]) { data[i + 3] = 0; continue; }
      const edge = (x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) || (y > 0 && bg[p - w]) || (y < h - 1 && bg[p + w]);
      if (!edge) continue;
      const l = lum(i);
      if (l > soft) data[i + 3] = Math.round(255 * Math.max(0, Math.min(1, (threshold - l) / (threshold - soft))));
    }
  }
  return png;
}

/* ---------- برش قطعه‌ها ---------- */

const distToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax, dy = by - ay;
  const L = dx * dx + dy * dy;
  const t = L === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
};

/**
 * تصویر شخصیت را به قطعه‌های اندام می‌بُرد و همه را در یک تصویر اطلس می‌چیند.
 *
 * هر پیکسلِ بدن به نزدیک‌ترین استخوان می‌رسد (مثل وزن‌دهی پوست در نرم‌افزارهای انیمیشن)، نه به یک
 * کپسولِ هندسی. برای همین هیچ قطعه‌ای تکه‌ای از اندام کناری را با خود نمی‌برد — نه سرشانهٔ ژستِ اولیه
 * در تنه می‌ماند و نه پوستِ صورت وارد بازو می‌شود.
 *
 * نوارِ اشتراکی فقط «نزدیک مفصل‌ها» داده می‌شود، نه در تمام طول مرز؛ وگرنه هر قطعه یک باریکهٔ بلند از
 * اندام کناری را با خود می‌برد و هنگام چرخش، آن باریکه مثل تکهٔ اضافه بیرون می‌زند.
 */
export function sliceParts(png: PNG, bones: Bone[], heightPx: number): { atlas: PNG; parts: Part[] } {
  const { width: w, height: h, data } = png;
  const n = bones.length;
  const overlap = Math.max(4, heightPx * 0.014);
  const jointR = Math.max(10, heightPx * 0.05);
  const ends = bones.map((b) => [b.sa, b.sb] as const);
  const depth = bones.map((b) => PART_DEPTH[b.name]);
  const own = new Uint32Array(w * h);
  const box = bones.map(() => ({ x0: w, y0: h, x1: -1, y1: -1 }));
  const d: number[] = new Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (data[p * 4 + 3] < 8) continue;
      let best = Infinity, owner = 0;
      for (let i = 0; i < n; i++) {
        const b = bones[i];
        d[i] = distToSegment(x, y, b.sa.x, b.sa.y, b.sb.x, b.sb.y);
        if (d[i] < best) { best = d[i]; owner = i; }
      }
      let bits = 0;
      for (let i = 0; i < n; i++) {
        if (d[i] > best + overlap) continue;
        if (i !== owner) {
          // اشتراک فقط دور مفصل‌ها و فقط به سمت تنه
          // فقط داخل خودِ عضو (ساعد→بازو، دست→ساعد، ساق→ران، پا→ساق). به تنه چیزی داده نمی‌شود،
          // وگرنه پارچهٔ ژستِ اولیه روی تنهٔ ثابت می‌ماند و مثل بال بیرون می‌زند.
          if (depth[i] < 1 || depth[i] !== depth[owner] - 1) continue;
          const [ea, eb] = ends[i];
          if (Math.min(Math.hypot(x - ea.x, y - ea.y), Math.hypot(x - eb.x, y - eb.y)) > jointR) continue;
        }
        bits |= 1 << i;
        const bx = box[i];
        if (x < bx.x0) bx.x0 = x;
        if (y < bx.y0) bx.y0 = y;
        if (x > bx.x1) bx.x1 = x;
        if (y > bx.y1) bx.y1 = y;
      }
      own[p] = bits;
    }
  }
  // چیدن قطعه‌ها در اطلس (ردیف به ردیف).
  const pad = 1, maxW = 2048;
  const placed = bones.map((b, i) => {
    const bx = box[i];
    const empty = bx.x1 < bx.x0;
    return { i, name: b.name, x0: empty ? 0 : bx.x0, y0: empty ? 0 : bx.y0, w: empty ? 1 : bx.x1 - bx.x0 + 1, hh: empty ? 1 : bx.y1 - bx.y0 + 1 };
  });
  const order = [...placed].sort((a, b) => b.hh - a.hh);
  let cx = pad, cy = pad, rowH = 0, atlasW = 1, atlasH = 1;
  const rect = new Map<number, { x: number; y: number }>();
  for (const q of order) {
    if (cx + q.w + pad > maxW) { cx = pad; cy += rowH + pad; rowH = 0; }
    rect.set(q.i, { x: cx, y: cy });
    cx += q.w + pad;
    rowH = Math.max(rowH, q.hh);
    atlasW = Math.max(atlasW, cx);
    atlasH = Math.max(atlasH, cy + rowH + pad);
  }
  const atlas = new PNG({ width: atlasW, height: atlasH });
  atlas.data.fill(0);
  const parts: Part[] = [];
  for (const q of placed) {
    const r = rect.get(q.i) as { x: number; y: number };
    const bit = 1 << q.i;
    for (let y = 0; y < q.hh; y++) {
      for (let x = 0; x < q.w; x++) {
        const sp = (q.y0 + y) * w + (q.x0 + x);
        if (!(own[sp] & bit)) continue;
        const dp = ((r.y + y) * atlasW + (r.x + x)) * 4;
        atlas.data.set(data.subarray(sp * 4, sp * 4 + 4), dp);
      }
    }
    const b = bones[q.i];
    parts.push({ name: b.name, a: b.a, b: b.b, src: { x: r.x, y: r.y, w: q.w, h: q.hh }, off: { x: q.x0, y: q.y0 } });
  }
  const order2 = new Map(bones.map((b, i) => [b.name, i]));
  parts.sort((a, b) => (order2.get(a.name) ?? 0) - (order2.get(b.name) ?? 0));
  return { atlas, parts };
}

/** عروسک کامل از تصویر شفاف‌شده و مفاصل. */
export function assemblePuppet(id: string, name: string, image: string, png: PNG, joints: Joints): { rig: PuppetRig; atlas: PNG } {
  const { bones, near } = bonesOf(joints);
  const { body, u, ground } = measureBody(name, joints);
  const { atlas, parts } = sliceParts(png, bones, ground - joints.headTop.y);
  return { rig: { id, name, image, w: png.width, h: png.height, joints, parts, body, u, ground, near }, atlas };
}

/** از Gemini می‌خواهد مختصات مفاصل تصویر را بدهد (مقیاس ۰..۱۰۰۰ در هر دو محور). */
export async function measureJoints(img: { mimeType: string; data: string }) {
  const project = await gcpProject();
  if (!project) throw new Error("GOOGLE_CLOUD_PROJECT is not set");
  const host = TEXT_LOCATION === "global" ? "aiplatform.googleapis.com" : `${TEXT_LOCATION}-aiplatform.googleapis.com`;
  const point = { type: "OBJECT", properties: { x: { type: "NUMBER" }, y: { type: "NUMBER" } }, required: ["x", "y"] };
  const r = await fetch(`https://${host}/v1/projects/${project}/locations/${TEXT_LOCATION}/publishers/google/models/${TEXT_MODEL}:generateContent`, {
    method: "POST",
    headers: { authorization: `Bearer ${await gcpAccessToken()}`, "x-goog-user-project": project, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ inlineData: img }, { text: "This is a character turnaround on a plain background. Report the position of each anatomical landmark using a coordinate system where (0,0) is the TOP-LEFT of the image, x grows right, y grows down, and BOTH axes are normalized to the range 0..1000. \"L\" means the character's own left, which appears on the RIGHT side of the image when the character faces the viewer. Estimate landmarks that are partly hidden. headTop is the top of the hair, chin the bottom of the jaw, neck the base of the neck, chest the centre of the ribcage, pelvis the centre of the hips, hand the centre of the palm, toe the tip of the shoe." }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 4000,
        responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: Object.fromEntries(JOINT_NAMES.map((n) => [n, point])), required: [...JOINT_NAMES] },
      },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } };
  if (!r.ok) throw new Error(`joints ${r.status}: ${j.error?.message?.slice(0, 200)}`);
  const parsed = validateJoints(JSON.parse(j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") || "{}"));
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed.joints;
}

/**
 * درخواست تصویر مرجع — پایهٔ همهٔ حرکت‌های بعدی.
 * ژست باید «ایستادهٔ طبیعی» باشد، نه ژست A: سرشانه و تنه در تصویر برای همان حالتی کشیده می‌شوند که
 * بیشترین زمانِ فیلم در آن است، پس در حرکت‌ها چیزی بیرون نمی‌زند. فقط آن‌قدر فاصله لازم است که
 * برش بتواند دست و پا را از تنه جدا کند.
 */
export const refPosePrompt = (who: string) =>
  `Full-body character reference sheet, three-quarter front view, in a NEUTRAL RELAXED STANDING pose. Arms hang straight down along the sides but are held about 25 degrees away from the torso, so a clear gap of empty background is visible between each arm and the body along the whole arm, from armpit to hand. Palms face the thighs, fingers slightly separated, hands fully visible and not touching the legs or hips. Legs straight, feet about shoulder width apart, with a clear gap of empty background visible between the two legs. Shoulders relaxed and natural. Nothing overlaps the body: no arm crosses the torso, no hand touches clothing. Character: ${who}. The entire figure is fully visible from the top of the head to the shoes, with generous empty margin on all sides. Flat uniform pure white background (#FFFFFF), no floor, no cast shadow, no props, no text. ${STYLE}`;

/** نام قبلی، برای سازگاری. */
export const aPosePrompt = refPosePrompt;

/** یک شخصیت کامل می‌سازد: تصویر، شفاف‌سازی، مفاصل، فایل عروسک در Cloud Storage. */
export async function createPuppet(id: string, name: string, who: string): Promise<PuppetRig> {
  const img = await generateImage(refPosePrompt(who), [], "3:4");
  const joints1000 = await measureJoints(img);
  const png = keyOutBackground(PNG.sync.read(Buffer.from(img.data, "base64")));
  const key = `cast/${id}.png`;
  const { rig, atlas } = assemblePuppet(id, name, key, png, jointsToPixels(joints1000, png.width, png.height));
  await putObject(key, PNG.sync.write(atlas), "image/png");
  await putObject(`cast/${id}.json`, Buffer.from(JSON.stringify(rig)), "application/json");
  return rig;
}
