import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { vertexReply, vertexRequest, vertexUrl } from "./script-ai-vertex.ts";

describe("script-ai on Vertex (Gemini)", () => {
  it("UT-SA-01 OpenAI-style messages → generateContent body", () => {
    const b = vertexRequest([{ role: "system", content: "SYS" }, { role: "user", content: "1|سلام" }], 900);
    assert.deepEqual(b.systemInstruction, { parts: [{ text: "SYS" }] });
    assert.deepEqual(b.contents, [{ role: "user", parts: [{ text: "1|سلام" }] }]);
    assert.equal(b.generationConfig.maxOutputTokens, 900);
    assert.equal(b.generationConfig.responseMimeType, "application/json");
    assert.equal(vertexUrl({ project: "p", location: "global", model: "gemini-3.8-flash" }), "https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/gemini-3.8-flash:generateContent");
  });
  it("UT-SA-02 reply text skips thought parts; MAX_TOKENS = truncated; usage", () => {
    const r = vertexReply({ candidates: [{ content: { parts: [{ text: "x", thought: true }, { text: '{"s":' }, { text: "[]}" }] }, finishReason: "MAX_TOKENS" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 4 } });
    assert.deepEqual(r, { content: '{"s":[]}', truncated: true, usage: { input: 10, output: 4 } });
    assert.equal(vertexReply({}).content, undefined);
  });
});
