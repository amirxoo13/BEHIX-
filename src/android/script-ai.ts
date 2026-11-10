/**
 * جایگزین «فهم فیلمنامه با مدل زبانی» در اپ اندروید (آفلاین): تابع سرور در باندل گوشی نیست،
 * پس وضعیت «تنظیم نشده» برمی‌گردد و مرحلهٔ سناریو با روش دیکشنری (بدون اینترنت) کار می‌کند.
 * vite.android.config.ts همین فایل را جای `@/lib/script-ai` می‌گذارد.
 */
import type { ScriptAiStatus, UnderstandResult } from "@/lib/script-ai";

export type { ScriptAiStatus, TokenUsage, UnderstandResult } from "@/lib/script-ai";

export async function getScriptAiStatus(): Promise<ScriptAiStatus> {
  return { configured: false, model: null };
}

export async function understandScript(_: { data: unknown; headers?: unknown }): Promise<UnderstandResult> {
  return { ok: false, error: "فهم فیلمنامه با هوش مصنوعی فقط در نسخهٔ وب است." };
}
