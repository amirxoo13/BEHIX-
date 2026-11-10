#!/usr/bin/env node
/**
 * آزمون واقعی مدل‌های تصویر و ویدیوی Google Cloud برای BEHIX (هیچ خروجی ساختگی ندارد):
 *   ۱) Gemini Image روی Vertex AI: طرح یک شخصیت (PNG)
 *   ۲) همان مدل با ورودیِ تصویر شخصیت: یک فریم کلیدی ۱۶:۹ از همان شخصیت در صحنه
 *   ۳) Veo روی Vertex AI: تبدیل فریم کلیدی به ویدیو با دیالوگ فارسی
 * اجرا:  node --experimental-strip-types scripts/gcp-media-probe.mjs
 * اختیاری: PROBE_IMAGE_MODEL، PROBE_VEO_MODELS (با ویرگول)، PROBE_OUT، PROBE_SKIP_VIDEO=1
 */
import { mkdir, writeFile } from "node:fs/promises";
import { gcpAccessToken, gcpProject } from "../src/lib/gcp-auth.server.ts";

const out = process.env.PROBE_OUT || "verify-out";
const imageModel = process.env.PROBE_IMAGE_MODEL || "gemini-3-pro-image";
const veoModels = (process.env.PROBE_VEO_MODELS || "veo-4.0-generate-001,veo-3.5-generate-001,veo-3.1-generate-001,veo-3.1-generate-preview,veo-3.0-generate-001").split(",").map((s) => s.trim()).filter(Boolean);
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
const key = sheet && (await image("keyframe", [
  { inlineData: { mimeType: sheet.mimeType, data: sheet.data } },
  { text: `Using exactly this character (same face, hair, clothes), create one cinematic 16:9 film frame: medium close-up of him sitting at a small wooden table in a warm Tehran café in late afternoon, a glass of tea in front of him, looking slightly off-camera at a friend, about to speak. Shallow depth of field, layered background with window light. Only ONE instance of the character. ${STYLE}` },
], "16:9"));
await save();

if (key && process.env.PROBE_SKIP_VIDEO !== "1") {
  for (const model of veoModels) {
    const base = `https://us-central1-aiplatform.googleapis.com/v1/projects/${project}/locations/us-central1/publishers/google/models/${model}`;
    const step = { step: "video", model, location: "us-central1", ok: false };
    report.steps.push(step);
    const started = Date.now();
    const r = await fetch(`${base}:predictLongRunning`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify({
        instances: [{
          prompt: "The man smiles warmly, lifts the tea glass slightly and says in Persian (Farsi), in a natural Tehrani accent: «سلام! خیلی وقته ندیدمت، چه خبر؟». Subtle natural head movement and blinking, gentle café ambience, slow push-in camera. Premium adult 2D animation style, consistent with the image.",
          image: { bytesBase64Encoded: key.data, mimeType: key.mimeType },
        }],
        parameters: { aspectRatio: "16:9", durationSeconds: 8, resolution: "1080p", generateAudio: true, sampleCount: 1 },
      }),
      signal: AbortSignal.timeout(60_000),
    });
    step.status = r.status;
    const j = await r.json();
    if (!r.ok) { step.error = j.error?.message?.slice(0, 300); console.log(`[video] ${model} FAIL ${r.status} ${step.error}`); await save(); continue; }
    step.operation = j.name;
    console.log(`[video] ${model} accepted; polling…`);
    for (let i = 0; i < 60; i++) {
      await new Promise((res) => setTimeout(res, 10_000));
      const p = await fetch(`${base}:fetchPredictOperation`, { method: "POST", headers: await headers(), body: JSON.stringify({ operationName: j.name }), signal: AbortSignal.timeout(60_000) });
      const pj = await p.json();
      if (!pj.done) continue;
      step.ms = Date.now() - started;
      const vid = pj.response?.videos?.[0];
      if (vid?.bytesBase64Encoded) {
        step.file = `${out}/veo-sample.mp4`;
        await writeFile(step.file, Buffer.from(vid.bytesBase64Encoded, "base64"));
        step.ok = true;
        console.log(`[video] OK ${step.ms}ms → ${step.file}`);
      } else {
        step.error = JSON.stringify(pj.error ?? pj.response ?? {}).slice(0, 500);
        console.log(`[video] FAIL ${step.error}`);
      }
      break;
    }
    await save();
    if (step.ok) break;
  }
}
await save();
console.log(`گزارش: ${out}/media-probe.json`);
