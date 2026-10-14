/**
 * انتخاب روش فهم سناریو و ساخت نماها.
 * «خودکار»: اول مدل زبانی (اگر تنظیم شده باشد)، در هر خطا برگشت به دیکشنری.
 * «دیکشنری»: فقط روش بدون هوش مصنوعی.
 */
import { layoutPlan, planFromDictionary, type Plan } from "./script-plan.ts";
import type { Shot } from "./types.ts";

export type AutoMethod = "auto" | "dictionary";

export type ModelCall = (
  script: string,
) => Promise<{ ok: true; plan: Plan; model: string } | { ok: false; error: string }>;

export type AutoResult = {
  shots: Shot[];
  warnings: string[];
  used: "model" | "dictionary";
  model: string | null;
};

export async function autoLayout(
  script: string,
  method: AutoMethod,
  callModel: ModelCall | null,
): Promise<AutoResult> {
  if (method === "auto" && callModel) {
    let failure: string;
    try {
      const res = await callModel(script);
      if (res.ok) {
        const laid = layoutPlan(res.plan);
        if (laid.shots.length > 0) return { ...laid, used: "model", model: res.model };
        failure = "مدل نمایی نساخت";
      } else {
        failure = res.error;
      }
    } catch (err) {
      failure = err instanceof Error ? err.message : "خطای نامشخص";
    }
    const laid = layoutPlan(planFromDictionary(script));
    return {
      ...laid,
      warnings: [`مدل زبانی کار نکرد (${failure})؛ روش دیکشنری استفاده شد.`, ...laid.warnings],
      used: "dictionary",
      model: null,
    };
  }
  const laid = layoutPlan(planFromDictionary(script));
  const note = method === "auto" ? ["مدل زبانی تنظیم نشده؛ روش دیکشنری استفاده شد."] : [];
  return { ...laid, warnings: [...note, ...laid.warnings], used: "dictionary", model: null };
}
