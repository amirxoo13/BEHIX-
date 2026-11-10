#!/usr/bin/env node
/**
 * تأیید واقعی Google Cloud برای BEHIX (بدون هیچ دادهٔ ساختگی):
 *   - Gemini روی Vertex AI: برای هر «مدل × منطقه» یک درخواست فارسی واقعی می‌فرستد.
 *   - Gemini 3.8 TTS (Agent Platform generateContent، همان کد /api/tts): برای هر «مدل × منطقه» یک جملهٔ فارسی
 *     واقعی می‌سازد و WAV را ذخیره می‌کند (سرآیند RIFF، نرخ نمونه و مدت را گزارش می‌کند).
 *   - (اختیاری، VERIFY_STT=1) Speech-to-Text v2 chirp_2 fa-IR روی WAV واقعی همان TTS 3.8: کلمه‌ها، زمان و اطمینان.
 *   - (اختیاری، VERIFY_LYRIA=1 و LYRIA_MODEL) یک قطعهٔ کوتاه Lyria 3 Pro (global، Interactions) و ذخیرهٔ MP3.
 *   - (فقط همین، VERIFY_LYRIA_SHAPE=1) یک درخواست کوتاه Lyria و چاپ «درخت کلیدها»ی پاسخ با رشته‌های بلند/base64
 *     به‌صورت <len N>؛ هیچ آزمون دیگری اجرا نمی‌شود و هیچ داده‌ای ذخیره نمی‌شود. مدل: LYRIA_MODEL (پیش‌فرض lyria-3-pro-preview).
 * اجرا:
 *   node --experimental-strip-types scripts/gcp-verify.mjs
 * متغیرهای اختیاری: GOOGLE_CLOUD_PROJECT، VERIFY_MODELS، VERIFY_LOCATIONS، VERIFY_TTS_MODELS، VERIFY_TTS_LOCATIONS، VERIFY_OUT، VERIFY_STT، STT_LOCATION، STT_MODEL، VERIFY_LYRIA، LYRIA_MODEL
 */
import { mkdir, writeFile } from "node:fs/promises";
import { gcpAccessToken, gcpProject } from "../src/lib/gcp-auth.server.ts";
import { isWav, synthesizeGemini, wavPcm } from "../src/lib/gemini-tts.server.ts";
import { recognizeWords, sttConfig } from "../src/lib/gcp-stt.server.ts";
import { buildLyriaRequest, extractLyriaAudio, generateMusic, keyTree, lyriaConfig, lyriaUrl, musicPrompt } from "../src/lib/lyria.server.ts";

const list = (v, d) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : d);
const models = list(process.env.VERIFY_MODELS, ["gemini-3.8-flash", "gemini-3.8-flash-lite", "gemini-3.5-flash"]);
const locations = list(process.env.VERIFY_LOCATIONS, ["global", "us-central1"]);
const ttsModels = list(process.env.VERIFY_TTS_MODELS, ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"]);
const ttsLocations = list(process.env.VERIFY_TTS_LOCATIONS, ["global", "us", "eu"]);
const outDir = process.env.VERIFY_OUT || "verify-out";

const project = await gcpProject();
if (!project) {
  console.error("پروژهٔ Google Cloud پیدا نشد. GOOGLE_CLOUD_PROJECT را تنظیم کنید.");
  process.exit(1);
}
const token = await gcpAccessToken();
const auth = { authorization: `Bearer ${token}`, "x-goog-user-project": project, "content-type": "application/json" };

if (process.env.VERIFY_LYRIA_SHAPE === "1") {
  const model = process.env.LYRIA_MODEL?.trim() || "lyria-3-pro-preview";
  const prompt = musicPrompt({ mood: "calm", seconds: 5 });
  const started = Date.now();
  const r = await fetch(lyriaUrl(project), { method: "POST", headers: auth, body: JSON.stringify(buildLyriaRequest(model, prompt)), signal: AbortSignal.timeout(240_000) });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  const found = json ? extractLyriaAudio(json) : null;
  console.log(JSON.stringify({
    model, httpStatus: r.status, contentType: r.headers.get("content-type"), ms: Date.now() - started, bytes: text.length,
    keyTree: json ? keyTree(json) : `<non-JSON body, len ${text.length}>`,
    extractor: found ? { kind: found.kind, path: found.path, mimeType: found.mimeType, ...(found.kind === "inline" ? { audioBytes: found.bytes.length } : {}) } : null,
  }, null, 2));
  process.exit(r.ok && found ? 0 : 2);
}
await mkdir(outDir, { recursive: true });
const report = { project, checkedAt: new Date().toISOString(), gemini: [], tts: [], stt: [], lyria: [] };
const ttsWavs = [];

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
  for (const location of ttsLocations) {
    const row = { model, location, voice: "Kore", ok: false };
    const started = Date.now();
    try {
      // بدون جایگزین: هر مدل جدا آزموده می‌شود
      const { bytes, mimeType, wrapped } = await synthesizeGemini({
        project,
        location,
        models: [model],
        text: "سلام! امروز هوا خیلی خوبه، بریم یه قدمی بزنیم؟",
        voice: "Kore",
        style: "Read this line as an adult in natural, colloquial Tehrani Persian, warmly. Do not add words.",
        headers: { authorization: `Bearer ${token}` },
      });
      row.ms = Date.now() - started;
      row.bytes = bytes.length;
      row.apiMimeType = mimeType;
      row.riffFromApi = !wrapped; // false = API sent headerless PCM and we wrapped it
      if (!isWav(bytes)) throw new Error("not WAV after wrapping");
      const { pcm, sampleRate } = wavPcm(bytes);
      row.sampleRate = sampleRate;
      row.seconds = Math.round((pcm.length / 2 / sampleRate) * 100) / 100;
      row.file = `${outDir}/tts-${model}-${location}.wav`;
      await writeFile(row.file, bytes);
      ttsWavs.push({ model, location, bytes, seconds: row.seconds });
      row.ok = row.seconds > 0.5;
    } catch (e) {
      row.ms = Date.now() - started;
      row.error = e?.attempts ? JSON.stringify(e.attempts).slice(0, 400) : String(e?.message ?? e);
    }
    report.tts.push(row);
    console.log(`[tts] ${model} @ ${location}: ${row.ok ? "OK" : "FAIL"} ${row.ms}ms ${row.seconds ?? ""}s ${row.sampleRate ?? ""}Hz ${row.apiMimeType ?? ""} riff=${row.riffFromApi ?? ""} ${row.error ?? ""}`);
  }
}

if (process.env.VERIFY_STT === "1") {
  const cfg = { ...sttConfig(), enabled: true };
  const src = ttsWavs[0];
  const row = { model: cfg.model, location: cfg.location, lang: "fa-IR", ok: false };
  const started = Date.now();
  try {
    if (!src) throw new Error("no TTS WAV to transcribe (all TTS probes failed)");
    row.from = `${src.model}@${src.location}`;
    const words = await recognizeWords({ project, wav: src.bytes, seconds: src.seconds, headers: { authorization: `Bearer ${token}` }, config: cfg });
    row.ms = Date.now() - started;
    row.words = words;
    row.withConfidence = words.filter((w) => typeof w.confidence === "number").length;
    row.ok = words.length > 0 && words.every((w) => w.end >= w.start);
  } catch (e) {
    row.ms = Date.now() - started;
    row.error = String(e?.message ?? e).slice(0, 400);
  }
  report.stt.push(row);
  console.log(`[stt] ${row.model} @ ${row.location}: ${row.ok ? "OK" : "FAIL"} ${row.ms}ms ${row.words?.map((w) => `${w.text}[${w.start}-${w.end}]`).join(" ") ?? ""} ${row.error ?? ""}`);
}

if (process.env.VERIFY_LYRIA === "1") {
  const cfg = lyriaConfig();
  const row = { model: cfg.model || "(LYRIA_MODEL unset)", location: "global", ok: false };
  const started = Date.now();
  try {
    if (!cfg.enabled) throw new Error("set LYRIA_MODEL=lyria-3-pro-preview");
    row.prompt = musicPrompt({ mood: "playful", seconds: 20 });
    const made = await generateMusic({ project, model: cfg.model, prompt: row.prompt, headers: { authorization: `Bearer ${token}` } });
    row.ms = Date.now() - started;
    row.bytes = made.mp3.length;
    row.mimeType = made.mimeType;
    row.text = made.text?.slice(0, 300);
    row.file = `${outDir}/lyria-${cfg.model}.mp3`;
    await writeFile(row.file, made.mp3);
    row.ok = made.mp3.length > 10_000;
  } catch (e) {
    row.ms = Date.now() - started;
    row.error = String(e?.message ?? e).slice(0, 400);
  }
  report.lyria.push(row);
  console.log(`[lyria] ${row.model}: ${row.ok ? "OK" : "FAIL"} ${row.ms}ms ${row.bytes ?? ""}B ${row.mimeType ?? ""} ${row.error ?? ""}`);
}

await writeFile(`${outDir}/gcp-verify.json`, JSON.stringify(report, null, 2));
console.log(`گزارش: ${outDir}/gcp-verify.json`);
const optional = [...report.stt, ...report.lyria];
process.exit(report.gemini.some((r) => r.ok) && report.tts.some((r) => r.ok) && optional.every((r) => r.ok) ? 0 : 2);
