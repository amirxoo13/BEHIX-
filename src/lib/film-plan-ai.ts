/**
 * تابع سرور «برنامهٔ فیلم با Gemini» — فقط وقتی کاربر دکمه را می‌زند صدا زده می‌شود (هیچ تماس خودکاری نیست).
 * Vertex AI با ADC روی سرور (GOOGLE_CLOUD_PROJECT)؛ هیچ کلیدی به مرورگر نمی‌رسد.
 * سقف‌ها (اختیاری): STUDIO_PLAN_PER_HOUR (پیش‌فرض ۶ برنامه در ساعت برای هر IP)،
 * STUDIO_PLAN_DAILY_TOKENS (پیش‌فرض ۲٬۰۰۰٬۰۰۰ توکن در روز برای کل سرور).
 */
import { createServerFn } from "@tanstack/react-start";
import { MAX_STORY_CHARS } from "@/studio/stick/story-parse";
import type { FilmPlan } from "@/studio/film-plan";
import { clientIp, createLimiter, positiveInt } from "./rate-limit";

export type FilmPlanUsage = { input: number; output: number; thoughts: number };
export type FilmPlanAiResult =
  | { ok: true; plan: FilmPlan; warnings: string[]; usage: FilmPlanUsage; models: string[] }
  | { ok: false; error: string; warnings: string[] };
type Input = { story: string; targetDurationSec: number; format: FilmPlan["meta"]["format"]; quality: "standard" | "high" };

let shared: ReturnType<typeof createLimiter> | null = null;
async function limiter() {
  if (!shared) {
    const { env } = await import("./env.server.ts");
    shared = createLimiter({
      perHour: positiveInt(env("STUDIO_PLAN_PER_HOUR"), 6),
      dailyTokens: positiveInt(env("STUDIO_PLAN_DAILY_TOKENS"), 2_000_000),
    });
  }
  return shared;
}

export const getFilmPlanStatus = createServerFn({ method: "POST" }).handler(async () => {
  const { filmPlanConfig } = await import("./film-plan.server.ts");
  const { gcpProject } = await import("./gcp-auth.server.ts");
  const cfg = filmPlanConfig();
  return { configured: (await gcpProject()) !== null, model: cfg.standard.model, highQualityModel: cfg.highQuality.model };
});

export const planFilmFromStory = createServerFn({ method: "POST" })
  .validator((data: unknown): Input => {
    const o = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    if (typeof o.story !== "string" || !o.story.trim()) throw new Error("داستان خالی است.");
    if (o.story.length > MAX_STORY_CHARS) throw new Error(`داستان بیشتر از ${MAX_STORY_CHARS} حرف است.`);
    const t = typeof o.targetDurationSec === "number" && Number.isFinite(o.targetDurationSec) ? o.targetDurationSec : 240;
    const format = o.format === "portrait" || o.format === "square" ? o.format : "landscape";
    return { story: o.story, targetDurationSec: Math.min(300, Math.max(180, t)), format, quality: o.quality === "high" ? "high" : "standard" };
  })
  .handler(async ({ data }): Promise<FilmPlanAiResult> => {
    const { defaultDeps, planFilm } = await import("./film-plan.server.ts");
    const deps = await defaultDeps();
    if (!deps) return { ok: false, error: "Google Cloud برای برنامهٔ فیلم تنظیم نشده است (GOOGLE_CLOUD_PROJECT).", warnings: [] };
    const { getRequest, getRequestIP } = await import("@tanstack/react-start/server");
    const { verifyStudioRequest } = await import("./studio-auth.server.ts");
    const who = await verifyStudioRequest(getRequest().headers);
    if (!who.ok) return { ok: false, error: who.message, warnings: [] };
    const lim = await limiter();
    const verdict = lim.check(clientIp(getRequest().headers, getRequestIP()));
    if (!verdict.ok) return { ok: false, error: verdict.error, warnings: [] };
    const res = await planFilm(data, deps);
    lim.record(res.usage.input + res.usage.output + res.usage.thoughts);
    return res.ok ? res : { ok: false, error: res.error, warnings: res.warnings };
  });
