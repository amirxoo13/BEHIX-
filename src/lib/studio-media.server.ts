/**
 * هستهٔ تولید استودیو روی Google Cloud (فقط سرور):
 *   - Gemini Image روی Vertex AI: برگهٔ شخصیت و فریم کلیدی (با تصویر مرجع برای ثابت ماندن چهره)
 *   - Cloud Storage: نگهداری همهٔ خروجی‌ها
 * شناسهٔ مدل‌ها و منطقه‌ها با فراخوانی واقعی تأیید شده‌اند (scripts/gcp-media-probe.mjs) و با متغیر محیطی قابل تغییرند.
 */
import { gcpAccessToken, gcpProject } from "./gcp-auth.server.ts";
import { KEY_RE, assetKey } from "./studio-keys.ts";

export { KEY_RE };

export const IMAGE_MODEL = process.env.STUDIO_IMAGE_MODEL || "gemini-3-pro-image";
export const IMAGE_LOCATION = process.env.STUDIO_IMAGE_LOCATION || "global";
export const mediaBucket = () => process.env.MEDIA_BUCKET || process.env.TTS_BUCKET || "";

/** سبک تصویری ثابت استودیو؛ به همهٔ درخواست‌های تصویر اضافه می‌شود تا کل فیلم یک‌دست بماند. */
export const STYLE =
  "Style: premium adult 2D animation, like a prestige animated feature or graphic-novel adaptation. Realistic adult proportions, anatomically believable hands and faces, painterly cel shading, soft cinematic lighting, muted sophisticated palette, clean confident linework. NOT chibi, NOT childish, no oversized heads, no text, no captions, no watermark.";

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

/** فایلی با همین نام از قبل هست؛ نوشتن تغییرناپذیر رد شد (HTTP 412). */
export class ObjectExistsError extends Error {
  readonly key: string;
  constructor(key: string) {
    super(`storage object exists: ${key}`);
    this.name = "ObjectExistsError";
    this.key = key;
  }
}

/**
 * نوشتن یک شیء. پیش‌فرض تغییرناپذیر است (ifGenerationMatch=0: فقط اگر شیء وجود ندارد)؛
 * بازنویسی فقط با overwrite: true (هیچ مسیر استودیو از آن استفاده نمی‌کند).
 */
export async function putObjectWith(
  f: typeof fetch, authorization: string, bucket: string,
  key: string, bytes: Uint8Array | ArrayBuffer, contentType: string, opts: { overwrite?: boolean } = {},
): Promise<void> {
  const pre = opts.overwrite ? "" : "&ifGenerationMatch=0";
  const r = await f(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media${pre}&name=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { authorization, "content-type": contentType },
    body: bytes as BodyInit,
  });
  if (r.status === 412 && !opts.overwrite) throw new ObjectExistsError(key);
  if (!r.ok) throw new Error(`storage put ${r.status}`);
}

export async function putObject(key: string, bytes: Uint8Array | ArrayBuffer, contentType: string, opts: { overwrite?: boolean } = {}): Promise<void> {
  const { headers } = await ctx();
  await putObjectWith(fetch, headers.authorization, mediaBucket(), key, bytes, contentType, opts);
}

/** پاسخ خام Cloud Storage برای یک شیء (با پشتیبانی از Range). */
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

async function saveImage(folder: "cast" | "frames", owner: string, img: Img): Promise<string> {
  const key = assetKey(folder, owner, img.mimeType);
  await putObject(key, Buffer.from(img.data, "base64"), img.mimeType);
  return key;
}

/** شناسنامهٔ بازیگر: یک برگهٔ سه‌زاویه (روبه‌رو، سه‌رخ، نیم‌رخ) که مرجع همهٔ نماهای بعدی است. */
export async function createCharacter(description: string, owner: string): Promise<{ key: string }> {
  const img = await generateImage(
    `Character design sheet on a plain light-grey background. Character: ${description}. Show the SAME character three times, full body, standing: front view, three-quarter view, side profile. Identical face, hair and clothes in all three. ${STYLE}`,
  );
  return { key: await saveImage("cast", owner, img) };
}

/** فریم کلیدی یک نما با همان شخصیت‌ها (حداکثر ۳ برگهٔ مرجع؛ دسترسی به مرجع‌ها را studio-api بررسی می‌کند). */
export async function createKeyframe(castKeys: string[], direction: string, owner: string): Promise<{ key: string }> {
  const refs = await Promise.all(castKeys.slice(0, 3).map(readImage));
  const img = await generateImage(
    `Using exactly the character(s) from the reference sheet(s) (same faces, hair, clothes), create ONE cinematic 16:9 film frame. ${direction} Each character appears only once. Layered background with depth. ${STYLE}`,
    refs,
  );
  return { key: await saveImage("frames", owner, img) };
}
