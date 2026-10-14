/**
 * انتخاب روش فهم سناریو و ساخت نماها، با کمترین مصرف توکن:
 * «هوشمند» (پیش‌فرض): اول دیکشنری؛ فقط اگر دیکشنری جایی را نفهمید سراغ مدل می‌رود.
 * «فقط دیکشنری»: هیچ‌وقت مدل صدا زده نمی‌شود.
 * «همیشه مدل»: مستقیم مدل (در خطا، دیکشنری).
 * جواب مدل برای یک متن یکسان در همین صفحه نگه داشته می‌شود تا دوباره هزینه نشود.
 */
import { layoutPlan, planFromDictionary, type Plan } from "./script-plan.ts";
import type { Shot } from "./types.ts";

export type AutoMethod = "smart" | "dictionary" | "model";

export type TokenUsage = { input: number; output: number };

export type ModelCall = (
  script: string,
) => Promise<
  { ok: true; plan: Plan; model: string; usage: TokenUsage | null } | { ok: false; error: string }
>;

export type AutoResult = {
  shots: Shot[];
  warnings: string[];
  used: "model" | "dictionary";
  model: string | null;
  /** توکن مصرف‌شده در همین اجرا؛ صفر یعنی مدل صدا زده نشد یا جواب از حافظه آمد. */
  usage: TokenUsage;
};

const NO_USAGE: TokenUsage = { input: 0, output: 0 };
const cache = new Map<string, { plan: Plan; model: string }>();
const CACHE_LIMIT = 20;

export function clearModelCache() {
  cache.clear();
}

function dictionaryResult(plan: Plan, notes: string[]): AutoResult {
  const laid = layoutPlan(plan);
  return {
    ...laid,
    warnings: [...notes, ...laid.warnings],
    used: "dictionary",
    model: null,
    usage: NO_USAGE,
  };
}

export async function autoLayout(
  script: string,
  method: AutoMethod,
  callModel: ModelCall | null,
): Promise<AutoResult> {
  const dict = planFromDictionary(script);
  if (method === "dictionary") return dictionaryResult(dict, []);
  if (!callModel) return dictionaryResult(dict, ["مدل زبانی تنظیم نشده؛ روش دیکشنری استفاده شد."]);
  if (method === "smart" && (dict.uncertain ?? 0) === 0 && dict.shots.length > 0) {
    return dictionaryResult(dict, ["دیکشنری همه‌چیز را فهمید؛ مدل زبانی صدا زده نشد (۰ توکن)."]);
  }

  const cached = cache.get(script);
  if (cached) {
    const laid = layoutPlan(cached.plan);
    return {
      ...laid,
      warnings: ["این متن قبلاً فرستاده شده بود؛ جواب ذخیره‌شده استفاده شد (۰ توکن).", ...laid.warnings],
      used: "model",
      model: cached.model,
      usage: NO_USAGE,
    };
  }

  let failure: string;
  try {
    const res = await callModel(script);
    if (res.ok) {
      const laid = layoutPlan(res.plan);
      if (laid.shots.length > 0) {
        if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!);
        cache.set(script, { plan: res.plan, model: res.model });
        return { ...laid, used: "model", model: res.model, usage: res.usage ?? NO_USAGE };
      }
      failure = "مدل نمایی نساخت";
    } else {
      failure = res.error;
    }
  } catch (err) {
    failure = err instanceof Error ? err.message : "خطای نامشخص";
  }
  return dictionaryResult(dict, [`مدل زبانی کار نکرد (${failure})؛ روش دیکشنری استفاده شد.`]);
}
