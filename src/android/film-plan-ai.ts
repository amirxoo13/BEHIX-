/**
 * جایگزین «برنامهٔ فیلم با Gemini» در اپ اندروید.
 * نسخهٔ وب یک تابع سرور TanStack است و کد سرور (ADC، node:crypto، ...) را با خود می‌آورد؛ اپ آفلاین
 * نباید آن را در باندل داشته باشد. vite.android.config.ts همین فایل را جای `@/lib/film-plan-ai` می‌گذارد.
 */
import type { FilmPlanAiResult } from "@/lib/film-plan-ai";

const OFFLINE = "برنامهٔ فیلم با Gemini فعلاً فقط در نسخهٔ وب در دسترس است.";

export async function planFilmFromStory(_: { data: unknown; headers?: unknown }): Promise<FilmPlanAiResult> {
  return { ok: false, error: OFFLINE, warnings: [] };
}

export async function getFilmPlanStatus(): Promise<{ configured: boolean; model: string; highQualityModel: string }> {
  return { configured: false, model: "", highQualityModel: "" };
}

export type { FilmPlanAiResult, FilmPlanUsage } from "@/lib/film-plan-ai";
