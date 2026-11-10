/**
 * ساخت عروسک از هنرِ Gemini (فقط سرور): تصویر تمام‌قد → پس‌زمینهٔ شفاف → مفاصل → فایل عروسک.
 * پس از این مرحله، انیمیشن کاملاً کار موتور خودِ BEHIX است و هیچ مدلی در رندر دخالت ندارد.
 */
import { PNG } from "pngjs";
import { gcpAccessToken, gcpProject } from "./gcp-auth.server.ts";
import { STYLE, generateImage, putObject } from "./studio-media.server.ts";
import { JOINT_NAMES, buildPuppet, jointsToPixels, validateJoints, type AlphaMask, type PuppetRig } from "../studio/v2/puppet.ts";

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

export const maskOf = (png: PNG): AlphaMask => ({
  w: png.width,
  h: png.height,
  at: (x, y) => (x < 0 || y < 0 || x >= png.width || y >= png.height ? 0 : png.data[(y * png.width + x) * 4 + 3]),
});

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

/** درخواست تصویر ژست A با پس‌زمینهٔ یکدست — پایهٔ همهٔ حرکت‌های بعدی. */
export const aPosePrompt = (who: string) =>
  `Full-body character reference, THREE-QUARTER front view, standing in a relaxed A-pose: legs straight and slightly apart, both arms straight and held away from the body at about 45 degrees, palms facing forward, fingers relaxed and separated. Arms and legs do not touch or overlap the torso. Character: ${who}. The entire figure is fully visible from the top of the head to the shoes, with generous empty margin on all sides. Flat uniform pure white background (#FFFFFF), no floor, no cast shadow, no props, no text. ${STYLE}`;

/** یک شخصیت کامل می‌سازد: تصویر، شفاف‌سازی، مفاصل، فایل عروسک در Cloud Storage. */
export async function createPuppet(id: string, name: string, who: string): Promise<PuppetRig> {
  const img = await generateImage(aPosePrompt(who), [], "3:4");
  const joints1000 = await measureJoints(img);
  const png = keyOutBackground(PNG.sync.read(Buffer.from(img.data, "base64")));
  const out = PNG.sync.write(png);
  const key = `cast/${id}.png`;
  await putObject(key, out, "image/png");
  const rig = buildPuppet(id, name, key, png.width, png.height, jointsToPixels(joints1000, png.width, png.height), maskOf(png));
  await putObject(`cast/${id}.json`, Buffer.from(JSON.stringify(rig)), "application/json");
  return rig;
}
