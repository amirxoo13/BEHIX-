import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSttRequest, durationSeconds, parseSttResponse, recognizeWords, SttError, sttConfig, sttHost, sttUrl, STT_MAX_SECONDS } from "./gcp-stt.server.ts";

/** Shape copied from the v2 RecognizeResponse docs (results → alternatives → words with Duration offsets). */
const FIXTURE = {
  results: [
    {
      alternatives: [
        {
          transcript: "سلام امروز",
          confidence: 0.91,
          words: [
            { word: "سلام", endOffset: "0.610s", confidence: 0.93 },
            { startOffset: "0.820s", endOffset: "1.240s", word: "امروز", confidence: 0 },
          ],
        },
        { transcript: "alt", words: [{ startOffset: "9s", endOffset: "10s", word: "ignored" }] },
      ],
      resultEndOffset: "1.300s",
      languageCode: "fa-ir",
    },
    { alternatives: [{ transcript: "آماده‌ای", words: [{ startOffset: { seconds: "1", nanos: 260000000 }, endOffset: "1.76s", word: "آماده‌ای" }, { startOffset: "2s", endOffset: "2s", word: "zero" }] }] },
    { alternatives: [] },
  ],
  metadata: { totalBilledDuration: "2s" },
};

test("config defaults: europe-west4, chirp_2, enabled", () => {
  assert.deepEqual(sttConfig({}), { location: "europe-west4", model: "chirp_2", enabled: true });
  assert.deepEqual(sttConfig({ STT_LOCATION: "us-central1", STT_MODEL: "chirp_3", STT_ENABLED: "off" }), { location: "us-central1", model: "chirp_3", enabled: false });
});

test("regional endpoint with the implicit _ recognizer", () => {
  assert.equal(sttHost("europe-west4"), "europe-west4-speech.googleapis.com");
  assert.equal(sttUrl("p1", "europe-west4"), "https://europe-west4-speech.googleapis.com/v2/projects/p1/locations/europe-west4/recognizers/_:recognize");
});

test("request: auto-decoded WAV, fa-IR, word offsets + confidence on", () => {
  const body = buildSttRequest(new Uint8Array([82, 73, 70, 70]));
  assert.deepEqual(body, {
    config: { autoDecodingConfig: {}, languageCodes: ["fa-IR"], model: "chirp_2", features: { enableWordTimeOffsets: true, enableWordConfidence: true } },
    content: "UklGRg==",
  });
});

test("Duration parsing", () => {
  assert.equal(durationSeconds("3.5s"), 3.5);
  assert.equal(durationSeconds("0.000000001s"), 1e-9);
  assert.equal(durationSeconds({ seconds: "2", nanos: 5e8 }), 2.5);
  assert.ok(Number.isNaN(durationSeconds("3.5")));
});

test("response → TimedWord[] in seconds from the top alternative only", () => {
  assert.deepEqual(parseSttResponse(FIXTURE), [
    { text: "سلام", start: 0, end: 0.61, source: "stt-words", confidence: 0.93 },
    { text: "امروز", start: 0.82, end: 1.24, source: "stt-words" },
    { text: "آماده‌ای", start: 1.26, end: 1.76, source: "stt-words" },
  ]);
  assert.deepEqual(parseSttResponse({}), []);
  assert.deepEqual(parseSttResponse(null), []);
});

test("recognizeWords: posts to the regional URL, refuses clips over the sync limit, surfaces HTTP errors", async () => {
  let url = "";
  const ok = (async (u: string | URL, init?: RequestInit) => {
    url = String(u);
    assert.equal((init?.headers as Record<string, string>)["x-goog-user-project"], "p");
    return Response.json(FIXTURE);
  }) as typeof fetch;
  const words = await recognizeWords({ project: "p", wav: new Uint8Array(4), seconds: 2, headers: {}, fetchImpl: ok, config: sttConfig({}) });
  assert.equal(words.length, 3);
  assert.match(url, /europe-west4-speech\.googleapis\.com/);
  await assert.rejects(recognizeWords({ project: "p", wav: new Uint8Array(4), seconds: STT_MAX_SECONDS + 1, headers: {}, fetchImpl: ok }), SttError);
  const bad = (async () => new Response("denied", { status: 403 })) as unknown as typeof fetch;
  await assert.rejects(recognizeWords({ project: "p", wav: new Uint8Array(4), seconds: 2, headers: {}, fetchImpl: bad }), (e: unknown) => e instanceof SttError && e.status === 403);
});
