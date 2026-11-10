import { test } from "node:test";
import assert from "node:assert/strict";
import {
  audioFromResponse, buildTtsRequest, cacheKey, ensureWav, isWav, modelChain, pcmToWav, synthesizeGemini, TtsError, ttsConfig, ttsHost, ttsUrl, wavPcm,
} from "./gemini-tts.server.ts";
import { clipKey, LEGACY_CACHE_MODEL, TTS_MODEL, TTS_PREVIEW_MODEL } from "../studio/stick/voice.ts";

const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

test("config defaults: global, 3.8 Flash, 3.8 Flash-Lite preview, fallback on", () => {
  assert.deepEqual(ttsConfig({}), { location: "global", model: "gemini-3.8-flash-tts", previewModel: "gemini-3.8-flash-lite-tts", fallback: true });
  const c = ttsConfig({ TTS_LOCATION: "eu", TTS_MODEL: "m1", TTS_PREVIEW_MODEL: "m2", TTS_FALLBACK: "off" });
  assert.deepEqual(c, { location: "eu", model: "m1", previewModel: "m2", fallback: false });
  assert.equal(TTS_MODEL, "gemini-3.8-flash-tts");
  assert.equal(TTS_PREVIEW_MODEL, "gemini-3.8-flash-lite-tts");
});

test("model chain: Flash → Flash-Lite; previews only Flash-Lite; no 2.5 anywhere", () => {
  const cfg = ttsConfig({});
  assert.deepEqual(modelChain(cfg), ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"]);
  assert.deepEqual(modelChain(cfg, true), ["gemini-3.8-flash-lite-tts"]);
  assert.deepEqual(modelChain({ ...cfg, fallback: false }), ["gemini-3.8-flash-tts"]);
  assert.ok(!modelChain(cfg).some((m) => m.includes("2.5")));
});

test("endpoints per documented location", () => {
  assert.equal(ttsHost("global"), "aiplatform.googleapis.com");
  assert.equal(ttsHost("us"), "aiplatform.us.rep.googleapis.com");
  assert.equal(ttsHost("eu"), "aiplatform.eu.rep.googleapis.com");
  assert.equal(ttsUrl("p1", "global", "gemini-3.8-flash-tts"), "https://aiplatform.googleapis.com/v1/projects/p1/locations/global/publishers/google/models/gemini-3.8-flash-tts:generateContent");
});

test("request body matches the documented REST shape", () => {
  assert.deepEqual(buildTtsRequest("سلام", "Kore", " warmly "), {
    contents: [{ role: "user", parts: [{ text: "سلام", speechMetadata: { style: "warmly" } }] }],
    generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { voice: "Kore" } } },
  });
  assert.equal("speechMetadata" in buildTtsRequest("x", "Kore", "").contents[0].parts[0], false);
});

test("WAV wrapping: header fields and round trip", () => {
  const pcm = new Uint8Array([1, 0, 255, 127, 0, 128]);
  const wav = pcmToWav(pcm);
  assert.equal(wav.length, 50);
  assert.ok(isWav(wav));
  const v = new DataView(wav.buffer);
  assert.equal(v.getUint32(24, true), 24000);
  assert.equal(v.getUint16(22, true), 1);
  assert.equal(v.getUint16(34, true), 16);
  assert.equal(v.getUint32(40, true), 6);
  assert.deepEqual(wavPcm(wav), { pcm, sampleRate: 24000 });
  assert.equal(ensureWav(wav, "audio/wav"), wav, "complete WAV passes through");
  const raw = ensureWav(pcm, "audio/l16;rate=16000");
  assert.ok(isWav(raw));
  assert.equal(new DataView(raw.buffer).getUint32(24, true), 16000);
  assert.equal(ensureWav(new Uint8Array(5)).length, 44 + 4, "odd byte dropped");
  assert.throws(() => ensureWav(new Uint8Array(4), "audio/mpeg"));
});

test("response parsing: camelCase + snake_case, several parts merged", () => {
  const wav = pcmToWav(new Uint8Array([1, 2, 3, 4]));
  assert.deepEqual(audioFromResponse({ candidates: [{ content: { parts: [{ inlineData: { data: b64(wav), mimeType: "audio/wav" } }] } }] }), { bytes: wav, mimeType: "audio/wav" });
  const two = audioFromResponse({ candidates: [{ content: { parts: [{ inline_data: { data: b64(wav) } }, { inlineData: { data: b64(pcmToWav(new Uint8Array([5, 6]))) } }] } }] });
  assert.deepEqual(wavPcm(two!.bytes).pcm, new Uint8Array([1, 2, 3, 4, 5, 6]));
  assert.equal(audioFromResponse({ candidates: [{ content: { parts: [{ text: "no" }] } }] }), null);
  assert.equal(audioFromResponse(null), null);
});

test("cache keys include the model; legacy MP3 keys are unchanged", async () => {
  const a = await cacheKey("gemini-3.8-flash-tts", "Kore", "p", "سلام");
  const b = await cacheKey("gemini-3.8-flash-lite-tts", "Kore", "p", "سلام");
  assert.match(a, /^tts\/[0-9a-f]{64}\.wav$/);
  assert.notEqual(a, b);
  // The old route stored `tts/sha256("gemini-2.5-pro-tts|voice|prompt|text").mp3`; same hash must come out.
  const legacy = await cacheKey(LEGACY_CACHE_MODEL, "Kore", "p", "سلام", "mp3");
  assert.equal(legacy, `tts/${await clipKey("سلام", "Kore", "p", LEGACY_CACHE_MODEL)}.mp3`);
  assert.equal(await clipKey("سلام", "Kore", "p"), a.slice(4, -4), "device key = server key for the default model");
});

test("synthesize falls back Flash → Flash-Lite, then throws a clean TtsError", async () => {
  const wav = pcmToWav(new Uint8Array([9, 9]));
  const calls: string[] = [];
  const fake = (fail: Set<string>) => (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    calls.push(u);
    assert.equal((init?.headers as Record<string, string>)["x-goog-user-project"], "p");
    if ([...fail].some((m) => u.includes(`/${m}:`))) return new Response("boom", { status: 500 });
    return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "audio/wav", data: b64(wav) } }] } }] });
  }) as typeof fetch;
  const base = { project: "p", location: "global", models: modelChain(ttsConfig({})), text: "سلام", voice: "Kore", headers: { authorization: "Bearer t" } };
  const ok = await synthesizeGemini({ ...base, fetchImpl: fake(new Set(["gemini-3.8-flash-tts"])) });
  assert.equal(ok.model, "gemini-3.8-flash-lite-tts");
  assert.deepEqual(ok.bytes, wav);
  assert.equal(calls.length, 2);
  await assert.rejects(synthesizeGemini({ ...base, fetchImpl: fake(new Set(["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"])) }), (e: unknown) => e instanceof TtsError && e.attempts.length === 2 && e.attempts[0].status === 500);
});
