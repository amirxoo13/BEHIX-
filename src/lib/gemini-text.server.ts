/**
 * Small JSON text calls on Agent Platform for the audio section (voice direction, music cue fields).
 * Model: AUDIO_TEXT_MODEL (default gemini-3.8-flash, BEHIX-DIRECTION point 7); retired 1.x/2.x ids are refused.
 * Skill text (src/ai/skills.ts) goes in `systemInstruction` of THESE text calls only — never in a TTS request.
 */
export const AUDIO_TEXT_DEFAULT = "gemini-3.8-flash";
const RETIRED = /gemini-[12]\./i;

export type TextConfig = { model: string; location: string; timeoutMs: number };
export function audioTextConfig(env: Record<string, string | undefined> = process.env): TextConfig {
  const m = env.AUDIO_TEXT_MODEL?.trim();
  return { model: m && !RETIRED.test(m) && !/argon/i.test(m) ? m : AUDIO_TEXT_DEFAULT, location: env.AUDIO_TEXT_LOCATION?.trim() || "global", timeoutMs: 30_000 };
}

const host = (loc: string) => (loc === "global" ? "aiplatform.googleapis.com" : `${loc}-aiplatform.googleapis.com`);
export const textUrl = (project: string, cfg: TextConfig) =>
  `https://${host(cfg.location)}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(cfg.location)}/publishers/google/models/${encodeURIComponent(cfg.model)}:generateContent`;

export function buildTextRequest(system: string, prompt: string, schema: unknown, maxOutputTokens = 2048) {
  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens, responseMimeType: "application/json", responseSchema: schema, thinkingConfig: { thinkingBudget: 0 } },
  };
}

/** Parsed JSON from the first candidate (thought parts skipped). Throws on HTTP or JSON errors. */
export async function geminiJson(opts: { project: string; system: string; prompt: string; schema: unknown; headers: Record<string, string>; config?: TextConfig; maxOutputTokens?: number; fetchImpl?: typeof fetch }): Promise<{ value: unknown; model: string }> {
  const cfg = opts.config ?? audioTextConfig();
  const r = await (opts.fetchImpl ?? fetch)(textUrl(opts.project, cfg), {
    method: "POST",
    headers: { ...opts.headers, "x-goog-user-project": opts.project, "content-type": "application/json" },
    body: JSON.stringify(buildTextRequest(opts.system, opts.prompt, opts.schema, opts.maxOutputTokens)),
    signal: AbortSignal.timeout(cfg.timeoutMs),
  });
  const body = (await r.json().catch(() => null)) as { error?: { message?: string }; candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] } | null;
  if (!r.ok) throw new Error(`${cfg.model} ${r.status}: ${(body?.error?.message ?? "").slice(0, 200)}`);
  const text = (body?.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  return { value: JSON.parse(text), model: cfg.model };
}
