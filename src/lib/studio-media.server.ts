/**
 * هستهٔ تولید استودیو روی Google Cloud (فقط سرور):
 *   - Gemini Image روی Vertex AI: برگهٔ شخصیت و فریم کلیدی (با تصویر مرجع برای ثابت ماندن چهره)
 *   - Cloud Storage: نگهداری همهٔ خروجی‌ها
 * شناسهٔ مدل‌ها و منطقه‌ها با فراخوانی واقعی تأیید شده‌اند (scripts/gcp-media-probe.mjs) و با متغیر محیطی قابل تغییرند.
 */
import { gcpAccessToken, gcpProject } from "./gcp-auth.server.ts";

export const IMAGE_MODEL = process.env.STUDIO_IMAGE_MODEL || "gemini-3-pro-image";
export const IMAGE_LOCATION = process.env.STUDIO_IMAGE_LOCATION || "global";
export const mediaBucket = () => process.env.MEDIA_BUCKET || process.env.TTS_BUCKET || "";

/** سبک تصویری ثابت استودیو؛ به همهٔ درخواست‌های تصویر اضافه می‌شود تا کل فیلم یک‌دست بماند. */
export const STYLE =
  "Style: premium adult 2D animation, like a prestige animated feature or graphic-novel adaptation. Realistic adult proportions, anatomically believable hands and faces, painterly cel shading, soft cinematic lighting, muted sophisticated palette, clean confident linework. NOT chibi, NOT childish, no oversized heads, no text, no captions, no watermark.";

export const KEY_RE = /^(cast|frames)\/[A-Za-z0-9_\-/.]{1,200}$/;
export type Img = { mimeType: string; data: string };

async function ctx() {
  const project = await gcpProject();
  if (!project) throw new Error("GOOGLE_CLOUD_PROJECT is not set");
  const headers = { authorization: `Bearer ${await gcpAccessToken()}`, "x-goog-user-project": project, "content-type": "application/json" };
  return { project, headers };
}

const host = (loc: string) => (loc === "global" ? "aiplatform.googleapis.com" : `${loc}-aiplatform.googleapis.com`);
const model = (project: string, loc: string, id: string) => `https://${host(loc)}/v1/projects/${project}/locations/${loc}/publishers/google/models/${id}`;

/* ---------- Cloud Storage ---------- */

export async function putObject(key: string, bytes: Uint8Array | ArrayBuffer, contentType: string): Promise<void> {
  const { headers } = await ctx();
  const r = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${mediaBucket()}/o?uploadType=media&name=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { authorization: headers.authorization, "content-type": contentType },
    body: bytes as BodyInit,
  });
  if (!r.ok) throw new Error(`storage put ${r.status}`);
}

/** پاسخ خام Cloud Storage برای یک شیء (پشتیبانی از Range برای پخش ویدیو در مرورگر). */
export async function getObject(key: string, range?: string | null): Promise<Response> {
  const { headers } = await ctx();
  return fetch(`https://storage.googleapis.com/storage/v1/b/${mediaBucket()}/o/${encodeURIComponent(key)}?alt=media`, {
    headers: { authorization: headers.authorization, ...(range ? { range } : {}) },
  });
}

async function readImage(key: string): Promise<Img> {
  const r = await getObject(key);
  if (!r.ok) throw new Error(`storage get ${r.status}`);
  return { mimeType: r.headers.get("content-type") || "image/png", data: Buffer.from(await r.arrayBuffer()).toString("base64") };
}

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/* ---------- Gemini Image ---------- */

export async function generateImage(prompt: string, refs: Img[] = [], aspectRatio = "16:9"): Promise<Img> {
  const { project, headers } = await ctx();
  const r = await fetch(`${model(project, IMAGE_LOCATION, IMAGE_MODEL)}:generateContent`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      contents: [{ role: "user", parts: [...refs.map((inlineData) => ({ inlineData })), { text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio } },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const j = (await r.json()) as { candidates?: { finishReason?: string; content?: { parts?: { inlineData?: Img }[] } }[]; error?: { message?: string } };
  if (!r.ok) throw new Error(`image ${r.status}: ${j.error?.message?.slice(0, 200)}`);
  const img = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!img) throw new Error(`image: no output (${j.candidates?.[0]?.finishReason ?? "unknown"})`);
  return img;
}

async function saveImage(folder: "cast" | "frames", img: Img): Promise<string> {
  const key = `${folder}/${newId()}.${img.mimeType.includes("jpeg") ? "jpg" : "png"}`;
  await putObject(key, Buffer.from(img.data, "base64"), img.mimeType);
  return key;
}

/** شناسنامهٔ بازیگر: یک برگهٔ سه‌زاویه (روبه‌رو، سه‌رخ، نیم‌رخ) که مرجع همهٔ نماهای بعدی است. */
export async function createCharacter(description: string): Promise<{ key: string }> {
  const img = await generateImage(
    `Character design sheet on a plain light-grey background. Character: ${description}. Show the SAME character three times, full body, standing: front view, three-quarter view, side profile. Identical face, hair and clothes in all three. ${STYLE}`,
  );
  return { key: await saveImage("cast", img) };
}

/** فریم کلیدی یک نما با همان شخصیت‌ها (حداکثر ۳ برگهٔ مرجع). */
export async function createKeyframe(castKeys: string[], direction: string): Promise<{ key: string }> {
  const refs = await Promise.all(castKeys.slice(0, 3).map(readImage));
  const img = await generateImage(
    `Using exactly the character(s) from the reference sheet(s) (same faces, hair, clothes), create ONE cinematic 16:9 film frame. ${direction} Each character appears only once. Layered background with depth. ${STYLE}`,
    refs,
  );
  return { key: await saveImage("frames", img) };
}
