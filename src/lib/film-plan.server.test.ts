import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FIXTURE_PLAN, FIXTURE_STORY } from "../studio/film-plan.fixture.ts";
import { directFilm } from "../studio/film-plan.ts";
import { FILM_PLAN_AI, filmPlanConfig, planFilm, type Deps, type FilmPlanConfig } from "./film-plan.server.ts";

type Call = { url: string; model: string; body: { systemInstruction: { parts: { text: string }[] }; contents: { parts: { text: string }[] }[]; generationConfig: Record<string, unknown> } };
type Reply = (call: Call, signal: AbortSignal | undefined) => Promise<Response> | Response;

const json = (value: unknown, finishReason = "STOP", text?: string) =>
  new Response(JSON.stringify({
    candidates: [{ finishReason, content: { parts: [{ text: text ?? JSON.stringify(value) }] } }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, thoughtsTokenCount: 10 },
  }), { status: 200, headers: { "content-type": "application/json" } });

const fixture = () => structuredClone(FIXTURE_PLAN) as unknown as { acts: { scenes: { shots: unknown[] }[] }[] };
const outline = () => {
  const p = fixture();
  for (const a of p.acts) for (const s of a.scenes) delete (s as { shots?: unknown }).shots;
  return p;
};
const sceneShots = () => fixture().acts.flatMap((a) => a.scenes.map((s) => s.shots));

/** fetch ساختگی: مرحلهٔ ۱ طرح کلی، مرحلهٔ ۲ نماهای صحنهٔ n (از روی شمارهٔ صحنه در متن درخواست). */
function mock(reply?: Reply) {
  const calls: Call[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetchFn = (async (url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Call["body"];
    const call: Call = { url, model: /models\/([^:]+):generateContent/.exec(url)![1], body };
    calls.push(call);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await new Promise((r) => setTimeout(r, 5));
      if (reply) return await reply(call, init.signal ?? undefined);
      return standard(call);
    } finally {
      inFlight--;
    }
  }) as unknown as typeof fetch;
  return { fetchFn, calls, max: () => maxInFlight };
}
function standard(call: Call): Response {
  const prompt = call.body.contents[0].parts[0].text;
  const m = /^Scene (\d+) of/.exec(prompt);
  if (!m) return json(outline());
  return json({ shots: sceneShots()[Number(m[1]) - 1] });
}
const deps = (fetchFn: typeof fetch, config?: FilmPlanConfig): Deps => ({ fetch: fetchFn, accessToken: async () => "token", project: "behix-test", config, system: (task, base) => `[skills:${task}]\n${base}` });
// AbortSignal.timeout تایمرِ unref دارد و حلقهٔ رویداد Node را زنده نگه نمی‌دارد؛ بدون این تایمرِ ref،
// Node پیش از رسیدن abort خارج می‌شود و تست «لغو» حساب می‌شود (CI با کد ۱ می‌میرد).
const hangUntilAbort = (signal: AbortSignal | undefined) =>
  new Promise<Response>((_, reject) => {
    const keepAlive = setInterval(() => {}, 1000);
    signal?.addEventListener("abort", () => {
      clearInterval(keepAlive);
      reject(signal.reason);
    });
  });

describe("film plan on Vertex (mocked fetch)", () => {
  it("UT-FPS-01 defaults: both stages use gemini-3.8-flash with the modest thinking budget", async () => {
    assert.equal(FILM_PLAN_AI.standard.model, "gemini-3.8-flash");
    const cfg = filmPlanConfig({});
    assert.equal(cfg.standard.model, "gemini-3.8-flash");
    const m = mock();
    const res = await planFilm({ story: FIXTURE_STORY }, deps(m.fetchFn));
    assert.ok(res.ok, JSON.stringify(res));
    assert.equal(m.calls.length, 1 + 6);
    for (const c of m.calls) {
      assert.equal(c.model, "gemini-3.8-flash");
      assert.deepEqual(c.body.generationConfig.thinkingConfig, { thinkingBudget: FILM_PLAN_AI.standard.thinkingBudget });
      assert.equal(c.body.generationConfig.responseMimeType, "application/json");
      assert.ok(c.body.generationConfig.responseSchema);
      assert.ok(c.url.startsWith("https://aiplatform.googleapis.com/v1/projects/behix-test/locations/global/"));
    }
    assert.ok(m.calls[0].body.systemInstruction.parts[0].text.startsWith("[skills:film-plan.outline]"));
    assert.ok(m.calls[1].body.systemInstruction.parts[0].text.startsWith("[skills:film-plan.shots]"));
    assert.deepEqual(res.models, ["gemini-3.8-flash"]);
    assert.deepEqual(res.usage, { input: 700, output: 350, thoughts: 70 });
  });
  it("UT-FPS-02 two-stage reply assembles into a valid plan that the engine plays for 180-300 s", async () => {
    const res = await planFilm({ story: FIXTURE_STORY, targetDurationSec: 240 }, deps(mock().fetchFn));
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(res.plan.acts.flatMap((a) => a.scenes).length, 6);
    const film = directFilm(FIXTURE_STORY, res.plan);
    assert.equal(film.mode, "plan");
    assert.ok(film.timeline.duration >= 180 && film.timeline.duration <= 300);
  });
  it("UT-FPS-03 scene calls are capped at FILM_PLAN_AI.concurrency", async () => {
    const m = mock();
    await planFilm({ story: FIXTURE_STORY }, deps(m.fetchFn));
    assert.ok(m.max() <= FILM_PLAN_AI.concurrency, String(m.max()));
  });
  it("UT-FPS-04 argon is opt-in only and falls back to gemini-3.8-flash on timeout, with a warning", async () => {
    const cfg = filmPlanConfig({ STUDIO_PLAN_HQ_TIMEOUT_MS: "30" });
    assert.equal(cfg.highQuality.model, "gemini-4-argon");
    assert.equal(cfg.highQuality.timeoutMs, 30);
    const m = mock((call, signal) => (call.model === "gemini-4-argon" ? hangUntilAbort(signal) : standard(call)));
    const res = await planFilm({ story: FIXTURE_STORY, quality: "high" }, deps(m.fetchFn, cfg));
    assert.ok(res.ok, JSON.stringify(res));
    const argon = m.calls.filter((c) => c.model === "gemini-4-argon");
    assert.equal(argon.length, 7);
    for (const c of argon) assert.deepEqual(c.body.generationConfig.thinkingConfig, { thinkingBudget: FILM_PLAN_AI.highQuality.thinkingBudget });
    assert.equal(m.calls.filter((c) => c.model === "gemini-3.8-flash").length, 7);
    assert.deepEqual(res.models, ["gemini-3.8-flash"]);
    assert.ok(res.warnings.some((w) => w.includes("کیفیت بالا") && w.includes("gemini-3.8-flash")), res.warnings.join("\n"));
    // بدون انتخاب کاربر هیچ تماسی با argon نیست
    const plain = mock();
    await planFilm({ story: FIXTURE_STORY }, deps(plain.fetchFn, cfg));
    assert.ok(plain.calls.every((c) => c.model === "gemini-3.8-flash"));
  });
  it("UT-FPS-05 argon errors also fall back; argon budget and timeout cannot be raised above the caps", async () => {
    const m = mock((call) => (call.model === "gemini-4-argon" ? new Response(JSON.stringify({ error: { message: "overloaded" } }), { status: 503 }) : standard(call)));
    const res = await planFilm({ story: FIXTURE_STORY, quality: "high" }, deps(m.fetchFn));
    assert.ok(res.ok);
    assert.ok(res.warnings.some((w) => w.includes("503")));
    const cfg = filmPlanConfig({ STUDIO_PLAN_HQ_THINKING_BUDGET: "99999", STUDIO_PLAN_HQ_TIMEOUT_MS: "9999999", STUDIO_PLAN_THINKING_BUDGET: "50000" });
    assert.equal(cfg.highQuality.thinkingBudget, FILM_PLAN_AI.highQuality.thinkingBudget);
    assert.equal(cfg.highQuality.timeoutMs, FILM_PLAN_AI.highQuality.timeoutMs);
    assert.equal(cfg.standard.thinkingBudget, 1024);
  });
  it("UT-FPS-06 env cannot make argon or a retired generation the default model", () => {
    assert.equal(filmPlanConfig({ STUDIO_PLAN_MODEL: "gemini-4-argon" }).standard.model, "gemini-3.8-flash");
    assert.equal(filmPlanConfig({ STUDIO_PLAN_MODEL: "gemini-2.9-pro" }).standard.model, "gemini-3.8-flash");
    assert.equal(filmPlanConfig({ STUDIO_PLAN_HQ_MODEL: "gemini-1.9-ultra" }).highQuality.model, "gemini-4-argon");
    assert.equal(filmPlanConfig({ STUDIO_PLAN_MODEL: "gemini-3.9-flash" }).standard.model, "gemini-3.9-flash");
    assert.equal(filmPlanConfig({ STUDIO_PLAN_LOCATION: "europe-west4" }).location, "europe-west4");
  });
  it("UT-FPS-07 truncated or invalid outline reply fails with a Persian error, no plan", async () => {
    const cut = mock((call) => (/^Scene/.test(call.body.contents[0].parts[0].text) ? standard(call) : json(null, "MAX_TOKENS", '{"meta":{"title":"x"},"acts":[{"sce')));
    const a = await planFilm({ story: FIXTURE_STORY }, deps(cut.fetchFn));
    assert.equal(a.ok, false);
    if (!a.ok) assert.match(a.error, /سقف توکن/);
    const junk = mock(() => json(null, "STOP", "not json"));
    const b = await planFilm({ story: FIXTURE_STORY }, deps(junk.fetchFn));
    assert.equal(b.ok, false);
    if (!b.ok) assert.match(b.error, /JSON معتبر نبود/);
  });
  it("UT-FPS-08 one truncated scene reply drops that scene with a warning; the rest still plays", async () => {
    const m = mock((call) => (/^Scene 3 of/.test(call.body.contents[0].parts[0].text) ? json(null, "MAX_TOKENS", '{"shots":[{"id":"x"') : standard(call)));
    const res = await planFilm({ story: FIXTURE_STORY }, deps(m.fetchFn));
    assert.ok(res.ok);
    if (!res.ok) return;
    assert.equal(res.plan.acts.flatMap((a) => a.scenes).length, 5);
    assert.ok(res.warnings.some((w) => w.includes("صحنهٔ 3") && w.includes("سقف توکن")), res.warnings.join("\n"));
  });
  it("UT-FPS-09 standard-model timeout is reported, not retried on argon", async () => {
    const cfg: FilmPlanConfig = { ...filmPlanConfig({}), standard: { ...filmPlanConfig({}).standard, timeoutMs: 20 } };
    const m = mock((_call, signal) => hangUntilAbort(signal));
    const res = await planFilm({ story: FIXTURE_STORY }, deps(m.fetchFn, cfg));
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error, /جواب نداد/);
    assert.ok(m.calls.every((c) => c.model === "gemini-3.8-flash"));
  });
});
