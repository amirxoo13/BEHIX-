#!/usr/bin/env node
/**
 * آزمون واقعی مدل‌های تصویر Google Cloud برای BEHIX (هیچ خروجی ساختگی ندارد):
 *   ۱) Gemini Image روی Vertex AI: طرح یک شخصیت (PNG)
 *   ۲) همان مدل با ورودیِ تصویر شخصیت: یک فریم کلیدی ۱۶:۹ از همان شخصیت در صحنه
 * اجرا:  node --experimental-strip-types scripts/gcp-media-probe.mjs
 * اختیاری: PROBE_IMAGE_MODEL، PROBE_OUT
 */
import { mkdir, writeFile } from "node:fs/promises";
import { gcpAccessToken, gcpProject } from "../src/lib/gcp-auth.server.ts";

const out = process.env.PROBE_OUT || "verify-out";
const imageModel = process.env.PROBE_IMAGE_MODEL || "gemini-3-pro-image";
const project = await gcpProject();
if (!project) { console.error("GOOGLE_CLOUD_PROJECT تنظیم نشده است."); process.exit(1); }
const headers = async () => ({ authorization: `Bearer ${await gcpAccessToken()}`, "x-goog-user-project": project, "content-type": "application/json" });
await mkdir(out, { recursive: true });
const report = { project, at: new Date().toISOString(), steps: [] };
const save = () => writeFile(`${out}/media-probe.json`, JSON.stringify(report, null, 2));

const STYLE = "Style: premium adult 2D animation, like a prestige animated feature or graphic novel adaptation. Realistic adult proportions (about 7.5 heads tall), anatomically believable hands and face, painterly cel shading with soft cinematic lighting, muted sophisticated palette, clean confident linework. NOT chibi, NOT cartoonish, NOT childish, no big heads, no text, no watermark.";

async function image(name, parts, aspect) {
  const url = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${imageModel}:generateContent`;
  const started = Date.now();
  const step = { step: name, model: imageModel, location: "global", ok: false };
  report.steps.push(step);
  const r = await fetch(url, {
    method: "POST",
    headers: await headers(),
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"], imageConfig: { aspectRatio: aspect } } }),
    signal: AbortSignal.timeout(180_000),
  });
  step.status = r.status;
  step.ms = Date.now() - started;
  const j = await r.json();
  if (!r.ok) { step.error = j.error?.message?.slice(0, 400); console.log(`[${name}] FAIL ${r.status} ${step.error}`); return null; }
  const img = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData;
  if (!img) { step.error = `no image; finish=${j.candidates?.[0]?.finishReason}`; console.log(`[${name}] FAIL ${step.error}`); return null; }
  const ext = img.mimeType.includes("jpeg") ? "jpg" : "png";
  step.file = `${out}/${name}.${ext}`;
  step.mimeType = img.mimeType;
  step.usage = j.usageMetadata;
  step.ok = true;
  await writeFile(step.file, Buffer.from(img.data, "base64"));
  console.log(`[${name}] OK ${step.ms}ms → ${step.file}`);
  return img;
}

const sheet = await image("char-sheet", [{ text: `Character design sheet on a plain light-grey background: one Iranian man in his early thirties named Nima — tall, lean, short dark curly hair, light stubble, olive skin, wearing a dark green overshirt over a cream t-shirt, charcoal trousers, white sneakers. Show the SAME character three times, full body, standing: front view, three-quarter view, side profile. ${STYLE}` }], "16:9");
await save();
await (sheet && image("keyframe", [
  { inlineData: { mimeType: sheet.mimeType, data: sheet.data } },
  { text: `Using exactly this character (same face, hair, clothes), create one cinematic 16:9 film frame: medium close-up of him sitting at a small wooden table in a warm Tehran café in late afternoon, a glass of tea in front of him, looking slightly off-camera at a friend, about to speak. Shallow depth of field, layered background with window light. Only ONE instance of the character. ${STYLE}` },
], "16:9"));
await save();
console.log(`گزارش: ${out}/media-probe.json`);
