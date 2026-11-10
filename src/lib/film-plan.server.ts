/**
 * Gemini روی Vertex AI برنامهٔ فیلم ۳ تا ۵ دقیقه‌ای را در دو مرحله می‌نویسد (فقط سرور، با ADC؛ هیچ کلیدی به مرورگر نمی‌رسد):
 *   ۱) طرح کلی: پرده‌ها، صحنه‌ها، شخصیت‌ها، مکان‌ها (بدون نما)
 *   ۲) نماهای هر صحنه، جدا و هم‌زمان (حداکثر FILM_PLAN_AI.concurrency تماس با هم)
 * هر دو مرحله پیش‌فرض gemini-3.8-flash با بودجهٔ فکر کم‌اند. gemini-4-argon فقط با انتخاب کاربر («کیفیت بالا»)،
 * با سقف سخت بودجهٔ فکر و زمان؛ اگر دیر کرد یا خطا داد خودکار به gemini-3.8-flash برمی‌گردد و هشدار می‌دهد.
 * خروجی همیشه از repairFilmPlan می‌گذرد؛ موتور قطعی آن را اجرا می‌کند.
 */
import { withSkills } from "../ai/skills.ts";
import { FILM_PLAN_JSON_SCHEMA } from "../studio/film-plan.schema.ts";
import { outlineVertexSchema, repairFilmPlan, shotsVertexSchema, toVertexSchema, type FilmPlan, TARGET_MAX_SEC, TARGET_MIN_SEC } from "../studio/film-plan.ts";
import { VOICE_IDS } from "../studio/stick/voice.ts";

/* ---------- تنظیم‌ها: همهٔ شناسهٔ مدل‌ها و بودجه‌ها فقط همین‌جا ---------- */

export const FILM_PLAN_AI = {
  location: "global",
  /** پیش‌فرض هر دو مرحله (طرح کلی و نماها). */
  standard: { model: "gemini-3.8-flash", thinkingBudget: 512, timeoutMs: 90_000 },
  /** فقط با انتخاب کاربر. thinkingBudget و timeoutMs سقف سخت‌اند (متغیر محیطی نمی‌تواند بالاترشان ببرد). */
  highQuality: { model: "gemini-4-argon", thinkingBudget: 2048, timeoutMs: 120_000 },
  maxOutputTokens: { outline: 8192, shots: 12_288 },
  temperature: 0.4,
  /** تماس‌های هم‌زمان مرحلهٔ نماها. */
  concurrency: 3,
  maxScenes: 30,
} as const;

export type Quality = "standard" | "high";
export type StageConfig = { model: string; thinkingBudget: number; timeoutMs: number };
export type FilmPlanConfig = { location: string; standard: StageConfig; highQuality: StageConfig };

/** Retired generations (1.x and 2.x) are never accepted from env. */
const RETIRED = /gemini-[12]\./i;
const int = (raw: string | undefined, d: number, lo: number, hi: number) => {
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isInteger(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

/**
 * متغیرهای محیطی (اختیاری): STUDIO_PLAN_MODEL، STUDIO_PLAN_LOCATION، STUDIO_PLAN_THINKING_BUDGET،
 * STUDIO_PLAN_HQ_MODEL، STUDIO_PLAN_HQ_THINKING_BUDGET، STUDIO_PLAN_HQ_TIMEOUT_MS.
 * مدل پیش‌فرض نمی‌تواند argon یا مدل بازنشسته (نسل ۱ و ۲) باشد؛ بودجه و زمان argon از سقف بالاتر نمی‌رود.
 */
export function filmPlanConfig(env: Record<string, string | undefined> = process.env): FilmPlanConfig {
  const std = FILM_PLAN_AI.standard;
  const hq = FILM_PLAN_AI.highQuality;
  const stdModel = env.STUDIO_PLAN_MODEL?.trim();
  const hqModel = env.STUDIO_PLAN_HQ_MODEL?.trim();
  return {
    location: env.STUDIO_PLAN_LOCATION?.trim() || FILM_PLAN_AI.location,
    standard: {
      model: stdModel && !RETIRED.test(stdModel) && !/argon/i.test(stdModel) ? stdModel : std.model,
      thinkingBudget: int(env.STUDIO_PLAN_THINKING_BUDGET, std.thinkingBudget, 0, 1024),
      timeoutMs: std.timeoutMs,
    },
    highQuality: {
      model: hqModel && !RETIRED.test(hqModel) ? hqModel : hq.model,
      thinkingBudget: int(env.STUDIO_PLAN_HQ_THINKING_BUDGET, hq.thinkingBudget, 0, hq.thinkingBudget),
      timeoutMs: int(env.STUDIO_PLAN_HQ_TIMEOUT_MS, hq.timeoutMs, 1, hq.timeoutMs),
    },
  };
}

/* ---------- تماس با Vertex ---------- */

export type Deps = {
  fetch: typeof fetch;
  accessToken: () => Promise<string>;
  project: string;
  config?: FilmPlanConfig;
  /** برای آزمون؛ پیش‌فرض: مهارت‌های /skills. */
  system?: (task: "film-plan.outline" | "film-plan.shots", base: string) => string;
};
export type Usage = { input: number; output: number; thoughts: number };
type CallOk = { ok: true; value: unknown; model: string };
type CallErr = { ok: false; error: string; timedOut: boolean };

const host = (loc: string) => (loc === "global" ? "aiplatform.googleapis.com" : `${loc}-aiplatform.googleapis.com`);

async function generate(deps: Deps, cfg: FilmPlanConfig, stage: StageConfig, req: { system: string; prompt: string; schema: unknown; maxOutputTokens: number }, usage: Usage): Promise<CallOk | CallErr> {
  const url = `https://${host(cfg.location)}/v1/projects/${encodeURIComponent(deps.project)}/locations/${encodeURIComponent(cfg.location)}/publishers/google/models/${encodeURIComponent(stage.model)}:generateContent`;
  let res: Response;
  try {
    res = await deps.fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${await deps.accessToken()}`, "x-goog-user-project": deps.project, "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        generationConfig: {
          temperature: FILM_PLAN_AI.temperature,
          maxOutputTokens: req.maxOutputTokens,
          responseMimeType: "application/json",
          responseSchema: req.schema,
          thinkingConfig: { thinkingBudget: stage.thinkingBudget },
        },
      }),
      signal: AbortSignal.timeout(stage.timeoutMs),
    });
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { ok: false, timedOut, error: timedOut ? `مدل ${stage.model} در ${Math.round(stage.timeoutMs / 1000)} ثانیه جواب نداد.` : `اتصال به ${stage.model} برقرار نشد.` };
  }
  type Body = {
    candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
    error?: { message?: string };
  };
  let body: Body;
  try {
    body = (await res.json()) as Body;
  } catch {
    return { ok: false, timedOut: false, error: `پاسخ ${stage.model} خوانا نبود (${res.status}).` };
  }
  const u = body.usageMetadata;
  usage.input += u?.promptTokenCount ?? 0;
  usage.output += u?.candidatesTokenCount ?? 0;
  usage.thoughts += u?.thoughtsTokenCount ?? 0;
  if (!res.ok) return { ok: false, timedOut: false, error: `Vertex AI خطای ${res.status} داد: ${(body.error?.message ?? "").slice(0, 160)}` };
  const cand = body.candidates?.[0];
  const text = (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  try {
    return { ok: true, value: JSON.parse(text), model: stage.model };
  } catch {
    const cut = cand?.finishReason === "MAX_TOKENS";
    return { ok: false, timedOut: false, error: cut ? `پاسخ ${stage.model} به سقف توکن خورد و ناقص ماند.` : `پاسخ ${stage.model} JSON معتبر نبود (${cand?.finishReason ?? "بدون پاسخ"}).` };
  }
}

/** کیفیت بالا: اول argon با سقف سخت؛ اگر نشد، همان درخواست با gemini-3.8-flash و یک هشدار. */
async function callStage(deps: Deps, cfg: FilmPlanConfig, quality: Quality, req: Parameters<typeof generate>[3], usage: Usage, warn: (m: string) => void): Promise<CallOk | CallErr> {
  if (quality === "high") {
    const hq = await generate(deps, cfg, cfg.highQuality, req, usage);
    if (hq.ok) return hq;
    warn(`حالت کیفیت بالا جواب نداد (${hq.error})؛ با ${cfg.standard.model} ادامه داده شد.`);
  }
  return generate(deps, cfg, cfg.standard, req, usage);
}

async function pool<T, R>(items: T[], limit: number, run: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await run(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/* ---------- دستورها ---------- */

const OUTLINE_SYSTEM = `You are the head writer of BEHIX, a Persian 2D cut-out animation studio. Plan the acts, scenes, cast and locations of a ${TARGET_MIN_SEC}-${TARGET_MAX_SEC} second animated short from the user's Persian story. Return JSON that matches the response schema exactly. Do not write shots yet. Every scene must list the 1-based story line numbers it covers in sourceLines, in story order, and together the scenes must cover every dialogue line. Use only enum values from the schema. Character ids and location ids are short ASCII ids (e.g. "ali", "loc1"). Persian names, labels and summaries stay in Persian.`;

const SHOTS_SYSTEM = `You are the director of BEHIX, a Persian 2D cut-out animation studio. Break ONE scene into shots for the deterministic animation engine. Return JSON {"shots": [...]} matching the response schema exactly. Dialogue text must be copied verbatim from the given story lines (never invent or paraphrase); put the line numbers each shot covers in sourceLines. Use only the given character ids and the schema enums. Times are seconds relative to the shot start.`;

const numbered = (lines: string[], picks?: number[]) =>
  (picks?.length ? picks : lines.map((_, i) => i + 1)).filter((n) => n >= 1 && n <= lines.length).map((n) => `${n}: ${lines[n - 1]}`).join("\n");

export type PlanRequest = { story: string; targetDurationSec?: number; format?: FilmPlan["meta"]["format"]; quality?: Quality };
export type PlanResult =
  | { ok: true; plan: FilmPlan; warnings: string[]; usage: Usage; models: string[] }
  | { ok: false; error: string; warnings: string[]; usage: Usage; models: string[] };

/** دو مرحلهٔ Gemini + ترمیم قطعی. فقط از راه درخواست کاربر صدا زده می‌شود (هیچ تماس خودکاری نیست). */
export async function planFilm(req: PlanRequest, deps: Deps): Promise<PlanResult> {
  const cfg = deps.config ?? filmPlanConfig();
  const quality: Quality = req.quality === "high" ? "high" : "standard";
  const target = Math.min(TARGET_MAX_SEC, Math.max(TARGET_MIN_SEC, Math.round(req.targetDurationSec ?? 240)));
  const format = req.format ?? "landscape";
  const usage: Usage = { input: 0, output: 0, thoughts: 0 };
  const warnings: string[] = [];
  const warn = (m: string) => { if (!warnings.includes(m)) warnings.push(m); };
  const models = new Set<string>();
  const system = deps.system ?? ((task: "film-plan.outline" | "film-plan.shots", base: string) => (task === "film-plan.outline" ? withSkills("film-plan.outline", base) : withSkills("film-plan.shots", base)));
  const vertex = toVertexSchema(FILM_PLAN_JSON_SCHEMA);
  const lines = req.story.split("\n");

  // ۱) طرح کلی
  const outline = await callStage(deps, cfg, quality, {
    system: system("film-plan.outline", OUTLINE_SYSTEM),
    prompt: `Target duration: ${target} s. Format: ${format}. Voice ids for characters.voice.voiceId: ${VOICE_IDS.join(", ")}.\n\nStory (numbered lines):\n${numbered(lines)}`,
    schema: outlineVertexSchema(vertex),
    maxOutputTokens: FILM_PLAN_AI.maxOutputTokens.outline,
  }, usage, warn);
  if (!outline.ok) return { ok: false, error: outline.error, warnings, usage, models: [...models] };
  models.add(outline.model);
  const raw = outline.value as { characters?: { id?: unknown; name?: unknown; kind?: unknown }[]; acts?: { scenes?: Record<string, unknown>[] }[] };
  const scenes = (Array.isArray(raw.acts) ? raw.acts : []).flatMap((a) => (Array.isArray(a?.scenes) ? a.scenes : []));
  if (!scenes.length) return { ok: false, error: "طرح کلی فیلم صحنه‌ای نداشت.", warnings, usage, models: [...models] };
  if (scenes.length > FILM_PLAN_AI.maxScenes) warn(`فقط ${FILM_PLAN_AI.maxScenes} صحنهٔ اول نما گرفت.`);
  const cast = (Array.isArray(raw.characters) ? raw.characters : []).map((c) => `${String(c?.id)} = ${String(c?.name)} (${String(c?.kind)})`).join("\n");
  const weights = scenes.map((s) => Math.max(1, Array.isArray(s.sourceLines) ? s.sourceLines.length : 1));
  const weightSum = weights.reduce((a, b) => a + b, 0);

  // ۲) نماهای هر صحنه
  const shotSchema = shotsVertexSchema(vertex);
  const replies = await pool(scenes.slice(0, FILM_PLAN_AI.maxScenes), FILM_PLAN_AI.concurrency, async (scene, i) => {
    const picks = Array.isArray(scene.sourceLines) ? (scene.sourceLines as unknown[]).filter((n): n is number => Number.isInteger(n)) : [];
    const { shots: _drop, ...head } = scene;
    void _drop;
    const res = await callStage(deps, cfg, quality, {
      system: system("film-plan.shots", SHOTS_SYSTEM),
      prompt: [
        `Scene ${i + 1} of ${scenes.length}: ${JSON.stringify(head)}`,
        `Previous scene: ${i ? JSON.stringify(scenes[i - 1].summary ?? "") : "(film opening)"}`,
        `Scene duration target: about ${Math.round((target * weights[i]) / weightSum)} s.`,
        `Characters (id = name (kind)):\n${cast}`,
        `Story lines for this scene:\n${numbered(lines, picks)}`,
      ].join("\n\n"),
      schema: shotSchema,
      maxOutputTokens: FILM_PLAN_AI.maxOutputTokens.shots,
    }, usage, warn);
    if (!res.ok) { warn(`نماهای صحنهٔ ${i + 1} ساخته نشد: ${res.error}`); return []; }
    models.add(res.model);
    const shots = (res.value as { shots?: unknown })?.shots;
    return Array.isArray(shots) ? shots : [];
  });

  let k = 0;
  const assembled = {
    ...raw,
    acts: (raw.acts ?? []).map((a) => ({ ...a, scenes: (Array.isArray(a?.scenes) ? a.scenes : []).map((s) => ({ ...s, shots: replies[k++] ?? [] })) })),
  };
  const fixed = repairFilmPlan(assembled, req.story, { targetDurationSec: target, format });
  for (const w of fixed.warnings) warn(w);
  if (!fixed.plan) return { ok: false, error: "برنامهٔ فیلم قابل اجرا نبود.", warnings, usage, models: [...models] };
  return { ok: true, plan: fixed.plan, warnings, usage, models: [...models] };
}

/** وابستگی‌های واقعی: ADC همان gcp-auth.server.ts. */
export async function defaultDeps(): Promise<Deps | null> {
  const { gcpAccessToken, gcpProject } = await import("./gcp-auth.server.ts");
  const project = await gcpProject();
  if (!project) return null;
  return { fetch: globalThis.fetch.bind(globalThis), accessToken: gcpAccessToken, project };
}
