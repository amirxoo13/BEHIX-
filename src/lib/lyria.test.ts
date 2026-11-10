import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLyriaRequest, extractLyriaAudio, generateMusic, LYRIA_MAX_SECONDS, lyriaConfig, lyriaUrl, musicKey, musicPrompt, parseLyriaResponse } from "./lyria.server.ts";

test("disabled unless LYRIA_MODEL is set", () => {
  assert.deepEqual(lyriaConfig({}), { model: "", enabled: false });
  assert.deepEqual(lyriaConfig({ LYRIA_MODEL: "lyria-3-pro-preview" }), { model: "lyria-3-pro-preview", enabled: true });
});

test("prompt is English, instrumental and capped at 184 s", () => {
  const p = musicPrompt({ mood: "tense", seconds: 400, style: "سنتور dark ambient", bpm: 90 });
  assert.ok(/Instrumental only/.test(p));
  assert.ok(p.includes(`about ${LYRIA_MAX_SECONDS} seconds`));
  assert.ok(p.includes("Style: dark ambient."));
  assert.ok(!/[\u0600-\u06FF]/.test(p), "no Persian in the prompt");
  assert.ok(p.includes("90 BPM"));
});

test("request and URL follow the Interactions API (global)", () => {
  assert.equal(lyriaUrl("p1"), "https://aiplatform.googleapis.com/v1/projects/p1/locations/global/interactions");
  assert.deepEqual(buildLyriaRequest("lyria-3-pro-preview", "x"), { model: "lyria-3-pro-preview", input: [{ type: "user_input", content: [{ type: "text", text: "x" }] }] });
});

const fixture = {
  id: "abc",
  status: "completed",
  model: "lyria-3-pro-preview",
  steps: [{ type: "model_output", content: [{ type: "text", text: "[Intro]" }, { type: "audio", mime_type: "audio/mpeg", data: Buffer.from("ID3fake").toString("base64") }] }],
};

test("response parsing returns the MP3 bytes and text; errors on no audio / not completed", () => {
  const r = parseLyriaResponse(fixture);
  assert.equal(new TextDecoder().decode(r.mp3), "ID3fake");
  assert.equal(r.mimeType, "audio/mpeg");
  assert.equal(r.text, "[Intro]");
  assert.throws(() => parseLyriaResponse({ status: "completed", steps: [] }), /no audio/);
  assert.throws(() => parseLyriaResponse({ status: "failed" }), /failed/);
});

test("generateMusic posts once with project header and surfaces API errors", async () => {
  const seen: { url: string; body: unknown; headers: Record<string, string> }[] = [];
  const ok = (async (url: string, init: RequestInit) => {
    seen.push({ url, body: JSON.parse(String(init.body)), headers: init.headers as Record<string, string> });
    return Response.json(fixture);
  }) as typeof fetch;
  const r = await generateMusic({ project: "p1", model: "lyria-3-pro-preview", prompt: "x", headers: { authorization: "Bearer t" }, fetchImpl: ok });
  assert.equal(r.mp3.length, 7);
  assert.equal(seen[0].headers["x-goog-user-project"], "p1");
  const bad = (async () => Response.json({ error: { message: "quota" } }, { status: 429 })) as unknown as typeof fetch;
  await assert.rejects(generateMusic({ project: "p1", model: "m", prompt: "x", headers: {}, fetchImpl: bad }), /429: quota/);
  assert.match(await musicKey("m", "x"), /^music\/[0-9a-f]{64}\.mp3$/);
});

const MP3 = Buffer.from("ID3\u0004fake-mp3").toString("base64");
const bytesOf = (a: ReturnType<typeof extractLyriaAudio>) => (a && a.kind === "inline" ? Buffer.from(a.bytes).toString() : null);

test("extractLyriaAudio: every documented / plausible response shape", async () => {
  const { extractLyriaAudio } = await import("./lyria.server.ts");
  // 1) documented 2026-11: steps[].content[] {type:"audio", mime_type, data}, after lyrics + caption steps
  const documented = { id: "i1", status: "completed", object: "interaction", model: "lyria-3-pro-preview", steps: [
    { type: "model_output", content: [{ type: "text", text: "[0.0:] ..." }] },
    { type: "model_output", content: [{ type: "text", text: "Caption: ..." }] },
    { type: "model_output", content: [{ type: "audio", mime_type: "audio/mpeg", data: MP3 }] },
  ] };
  const a = extractLyriaAudio(documented);
  assert.equal(bytesOf(a), "ID3\u0004fake-mp3");
  assert.equal(a?.path, "$.steps[2].content[0].data");
  assert.equal(a?.text, "[0.0:] ...\nCaption: ...");
  // 2) outputs[] (Gemini API style / lyria-002 via Interactions)
  assert.equal(bytesOf(extractLyriaAudio({ status: "completed", outputs: [{ type: "text", text: "x" }, { type: "audio", mime_type: "audio/wav", data: MP3 }] })), "ID3\u0004fake-mp3");
  // 3) content as a single object, camelCase mimeType, URL-safe base64 without padding
  const urlSafe = MP3.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  assert.equal(bytesOf(extractLyriaAudio({ steps: [{ type: "model_output", content: { type: "audio", mimeType: "audio/mpeg", data: urlSafe } }] })), "ID3\u0004fake-mp3");
  // 4) generateContent style inlineData
  assert.equal(bytesOf(extractLyriaAudio({ candidates: [{ content: { parts: [{ text: "hi" }, { inlineData: { mimeType: "audio/mpeg", data: MP3 } }] } }] })), "ID3\u0004fake-mp3");
  // 5) predict style (lyria-002)
  assert.equal(bytesOf(extractLyriaAudio({ predictions: [{ audioContent: MP3, mimeType: "audio/wav" }] })), "ID3\u0004fake-mp3");
  // 6) URI instead of bytes (AudioContent.uri, fileData.fileUri)
  const u = extractLyriaAudio({ steps: [{ type: "model_output", content: [{ type: "audio", mime_type: "audio/mpeg", uri: "gs://b/out/song.mp3" }] }] });
  assert.deepEqual(u && { kind: u.kind, uri: u.kind === "uri" ? u.uri : "" }, { kind: "uri", uri: "gs://b/out/song.mp3" });
  assert.equal(extractLyriaAudio({ parts: [{ fileData: { mimeType: "audio/mpeg", fileUri: "https://storage.googleapis.com/b/x.mp3" } }] })?.kind, "uri");
  // 7) audio wrapper without mime
  assert.equal(bytesOf(extractLyriaAudio({ result: { audio: { data: MP3 } } })), "ID3\u0004fake-mp3");
  // no audio: text-only (e.g. a refusal), image data is not audio
  assert.equal(extractLyriaAudio({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: "cannot" }, { type: "image", mime_type: "image/png", data: MP3 }] }] }), null);
});

test("no-audio error carries a redacted key tree; failed status surfaces", async () => {
  const { keyTree, parseLyriaResponse } = await import("./lyria.server.ts");
  const big = "A".repeat(5000);
  assert.deepEqual(keyTree({ status: "completed", steps: [{ content: [{ type: "text", text: big }] }], n: 3 }), { status: "completed", steps: [{ content: [{ type: "text", text: "<len 5000>" }] }], n: 3 });
  assert.throws(() => parseLyriaResponse({ status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text: big }] }] }), (e: Error) => /key tree: .*<len 5000>/.test(e.message) && !e.message.includes("AAAA"));
  assert.throws(() => parseLyriaResponse({ status: "failed", error: { message: "safety" } }), /failed: safety/);
});

test("generateMusic polls a background interaction and fetches a gs:// URI with auth", async () => {
  const calls: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (init?.method === "POST") return Response.json({ id: "abc", status: "in_progress" });
    if (url.endsWith("/interactions/abc")) {
      return calls.filter((c) => c.endsWith("/interactions/abc")).length < 2
        ? Response.json({ id: "abc", status: "in_progress" })
        : Response.json({ id: "abc", status: "completed", steps: [{ type: "model_output", content: [{ type: "audio", mime_type: "audio/mpeg", uri: "gs://bkt/dir/song.mp3" }] }] });
    }
    assert.equal((init?.headers as Record<string, string>).authorization, "Bearer t");
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } });
  }) as typeof fetch;
  const r = await generateMusic({ project: "p", model: "lyria-3-pro-preview", prompt: "x", headers: { authorization: "Bearer t" }, fetchImpl: f, pollMs: 1 });
  assert.deepEqual([...r.mp3], [1, 2, 3]);
  assert.equal(calls.at(-1), "GET https://storage.googleapis.com/storage/v1/b/bkt/o/dir%2Fsong.mp3?alt=media");
  const none = (async () => Response.json({ status: "completed", steps: [] })) as unknown as typeof fetch;
  await assert.rejects(generateMusic({ project: "p", model: "m", prompt: "x", headers: {}, fetchImpl: none }), /no audio in Lyria response; key tree: \{"status":"completed","steps":\[\]\}/);
});

test("response_modalities is opt-in via LYRIA_RESPONSE_MODALITIES; the live empty shape gets a clear error", async () => {
  const { lyriaConfig: cfg, buildLyriaRequest: build } = await import("./lyria.server.ts");
  assert.deepEqual(cfg({ LYRIA_MODEL: "m", LYRIA_RESPONSE_MODALITIES: "AUDIO, text, bogus" }).modalities, ["audio", "text"]);
  assert.equal(cfg({ LYRIA_MODEL: "m" }).modalities, undefined);
  assert.deepEqual(build("m", "x", ["audio", "text"]).response_modalities, ["audio", "text"]);
  assert.ok(!("response_modalities" in build("m", "x")));
  // exact key tree seen live on 2026-11-10 (anime-512918, 22.5 s, 141 bytes)
  const live = { status: "completed", created: "2026-11-10T13:41:28Z", updated: "2026-11-10T13:41:28Z", object: "interaction", model: "lyria-3-pro-preview" };
  const f = (async () => Response.json(live)) as unknown as typeof fetch;
  await assert.rejects(generateMusic({ project: "p", model: "m", prompt: "x", headers: {}, fetchImpl: f }), /empty completed interaction .*LYRIA_RESPONSE_MODALITIES=audio,text/);
});
