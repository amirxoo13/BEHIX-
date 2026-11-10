import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLyriaRequest, generateMusic, LYRIA_MAX_SECONDS, lyriaConfig, lyriaUrl, musicKey, musicPrompt, parseLyriaResponse } from "./lyria.server.ts";

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
