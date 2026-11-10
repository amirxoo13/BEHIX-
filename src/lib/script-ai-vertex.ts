/**
 * فهم سناریو با Gemini روی Vertex AI (generateContent): تبدیل پیام‌های همان قالب OpenAI به درخواست Vertex و خواندن جواب.
 * مستند: https://cloud.google.com/vertex-ai/generative-ai/docs/model-reference/inference
 * بدون وابستگی به سرور تا در Node و آزمون مستقیم اجرا شود؛ تماس واقعی در script-ai.ts است.
 */
export type ChatMessage = { role: string; content: string };
export type TokenUsage = { input: number; output: number };

const vertexHost = (loc: string) => (loc === "global" ? "aiplatform.googleapis.com" : `${loc}-aiplatform.googleapis.com`);
export const vertexUrl = (c: { project: string; location: string; model: string }) =>
  `https://${vertexHost(c.location)}/v1/projects/${encodeURIComponent(c.project)}/locations/${encodeURIComponent(c.location)}/publishers/google/models/${encodeURIComponent(c.model)}:generateContent`;

/** پیام‌های system/user همان قالب OpenAI → درخواست generateContent (جواب فقط JSON، بدون «فکر کردن» برای سرعت). */
export function vertexRequest(messages: ChatMessage[], maxTokens: number) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { temperature: 0, maxOutputTokens: maxTokens, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
  };
}

/** متن جواب (بدون بخش‌های thought)، بریده‌شدن با MAX_TOKENS و مصرف توکن از usageMetadata. */
export function vertexReply(body: unknown): { content: unknown; truncated: boolean; usage: TokenUsage | null } {
  const b = body as { candidates?: { content?: { parts?: { text?: unknown; thought?: unknown }[] }; finishReason?: unknown }[]; usageMetadata?: { promptTokenCount?: unknown; candidatesTokenCount?: unknown } };
  const cand = b.candidates?.[0];
  const parts = (cand?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === "string");
  const u = b.usageMetadata;
  return {
    content: parts.length ? parts.map((p) => p.text as string).join("") : undefined,
    truncated: cand?.finishReason === "MAX_TOKENS",
    usage: u && typeof u.promptTokenCount === "number" ? { input: u.promptTokenCount, output: typeof u.candidatesTokenCount === "number" ? u.candidatesTokenCount : 0 } : null,
  };
}
