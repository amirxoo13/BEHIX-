#!/usr/bin/env node
/**
 * تأیید واقعی Google Cloud برای BEHIX (بدون هیچ دادهٔ ساختگی):
 *   - Gemini روی Vertex AI: برای هر «مدل × منطقه» یک درخواست فارسی واقعی می‌فرستد.
 *   - Gemini TTS (Cloud Text-to-Speech): یک جملهٔ فارسی واقعی می‌سازد و MP3 را ذخیره می‌کند.
 * اجرا:
 *   node --experimental-strip-types scripts/gcp-verify.mjs
 * متغیرهای اختیاری: GOOGLE_CLOUD_PROJECT، VERIFY_MODELS، VERIFY_LOCATIONS، VERIFY_TTS_MODELS، VERIFY_OUT
 */
import { mkdir, writeFile } from "node:fs/promises";
import { gcpAccessToken, gcpProject } from "../src/lib/gcp-auth.server.ts";

const list = (v, d) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : d);
const models = list(process.env.VERIFY_MODELS, ["gemini-3.8-flash", "gemini-3.8-flash-lite", "gemini-3.5-flash"]);
const locations = list(process.env.VERIFY_LOCATIONS, ["global", "us-central1"]);
const ttsModels = list(process.env.VERIFY_TTS_MODELS, ["gemini-2.5-pro-tts", "gemini-2.5-flash-tts"]);
const outDir = process.env.VERIFY_OUT || "verify-out";

const project = await gcpProject();
if (!project) {
  console.error("پروژهٔ Google Cloud پیدا نشد. GOOGLE_CLOUD_PROJECT را تنظیم کنید.");
  process.exit(1);
}
const token = await gcpAccessToken();
const auth = { authorization: `Bearer ${token}`, "x-goog-user-project": project, "content-type": "application/json" };
await mkdir(outDir, { recursive: true });
const report = { project, checkedAt: new Date().toISOString(), gemini: [], tts: [] };

for (const model of models) {
  for (const location of locations) {
    const host = location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`;
    const url = `https://${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
    const started = Date.now();
    const row = { model, location, ok: false };
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "یک دیالوگ کوتاه فارسی محاوره‌ای بین دو دوست در کافه بنویس. فقط JSON." }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2000,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: { lines: { type: "ARRAY", items: { type: "OBJECT", properties: { speaker: { type: "STRING" }, text: { type: "STRING" } }, required: ["speaker", "text"] } } },
              required: ["lines"],
            },
          },
        }),
        signal: AbortSignal.timeout(60_000),
      });
      row.status = r.status;
      row.ms = Date.now() - started;
      const j = await r.json();
      if (r.ok) {
        const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
        row.modelVersion = j.modelVersion;
        row.usage = j.usageMetadata;
        row.reply = text.slice(0, 400);
        row.persian = /[؀-ۿ]{3,}/.test(text);
        row.ok = row.persian;
      } else row.error = j.error?.message?.slice(0, 300);
    } catch (e) {
      row.error = String(e?.message ?? e);
    }
    report.gemini.push(row);
    console.log(`[gemini] ${model} @ ${location}: ${row.ok ? "OK" : "FAIL"} ${row.status ?? ""} ${row.ms ?? ""}ms ${row.error ?? row.reply ?? ""}`);
  }
}

for (const model of ttsModels) {
  const row = { model, voice: "Kore", languageCode: "fa-IR", ok: false };
  const started = Date.now();
  try {
    const r = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        input: { text: "سلام! امروز هوا خیلی خوبه، بریم یه قدمی بزنیم؟", prompt: "Read this line as an adult in natural, colloquial Tehrani Persian, warmly. Do not add words." },
        voice: { languageCode: "fa-IR", name: "Kore", modelName: model },
        audioConfig: { audioEncoding: "MP3", sampleRateHertz: 24000 },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    row.status = r.status;
    row.ms = Date.now() - started;
    const j = await r.json();
    if (r.ok && j.audioContent) {
      const bytes = Buffer.from(j.audioContent, "base64");
      row.bytes = bytes.length;
      row.file = `${outDir}/tts-${model}.mp3`;
      await writeFile(row.file, bytes);
      row.ok = bytes.length > 2000;
    } else row.error = j.error?.message?.slice(0, 300);
  } catch (e) {
    row.error = String(e?.message ?? e);
  }
  report.tts.push(row);
  console.log(`[tts] ${model}: ${row.ok ? "OK" : "FAIL"} ${row.status ?? ""} ${row.ms ?? ""}ms ${row.bytes ?? ""} ${row.error ?? ""}`);
}

await writeFile(`${outDir}/gcp-verify.json`, JSON.stringify(report, null, 2));
console.log(`گزارش: ${outDir}/gcp-verify.json`);
process.exit(report.gemini.some((r) => r.ok) && report.tts.some((r) => r.ok) ? 0 : 2);
