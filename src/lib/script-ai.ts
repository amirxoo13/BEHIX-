/**
 * تماس با مدل زبانی برای فهم سناریو — فقط روی سرور، تا کلید API به مرورگر نرسد.
 *
 * هر سرویسی که «API سازگار با OpenAI» دارد کار می‌کند (Qwen، Grok/xAI، OpenAI، DeepSeek، ...).
 * عوض کردن مدل فقط با تغییر این سه متغیر محیطی در تنظیمات Vercel است، بدون تغییر کد:
 *   SCRIPT_AI_BASE_URL  آدرس پایهٔ API، مثلاً https://.../v1
 *   SCRIPT_AI_API_KEY   کلید API
 *   SCRIPT_AI_MODEL     اسم مدل
 * و یک متغیر اختیاری برای تنظیم‌های مخصوص هر سرویس (JSON که به بدنهٔ درخواست اضافه می‌شود):
 *   SCRIPT_AI_EXTRA_BODY  مثلاً برای Qwen: {"enable_thinking":false}
 *                         (بدون آن، مدل‌های Qwen 3.x اول «فکر» می‌کنند و بیش از یک دقیقه طول می‌کشد)
 */
import { createServerFn } from "@tanstack/react-start";
import { MAX_SCRIPT_CHARS, type Plan } from "@/studio/script-plan";

export type ScriptAiStatus = { configured: boolean; model: string | null };

export type UnderstandResult =
  | { ok: true; plan: Plan; model: string }
  | { ok: false; error: string };

const TIMEOUT_MS = 60_000;

async function config() {
  const { env } = await import("./env.server.ts");
  const baseUrl = env("SCRIPT_AI_BASE_URL");
  const apiKey = env("SCRIPT_AI_API_KEY");
  const model = env("SCRIPT_AI_MODEL");
  if (!baseUrl || !apiKey || !model) return null;
  let extra: Record<string, unknown> = {};
  const rawExtra = env("SCRIPT_AI_EXTRA_BODY");
  if (rawExtra) {
    try {
      const parsed: unknown = JSON.parse(rawExtra);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) extra = parsed as Record<string, unknown>;
    } catch {
      // مقدار نامعتبر نادیده گرفته می‌شود؛ درخواست بدون تنظیم اضافه فرستاده می‌شود.
    }
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, model, extra };
}

export const getScriptAiStatus = createServerFn({ method: "POST" }).handler(
  async (): Promise<ScriptAiStatus> => {
    const c = await config();
    return { configured: c !== null, model: c?.model ?? null };
  },
);

export const understandScript = createServerFn({ method: "POST" })
  .validator((data: unknown): { script: string } => {
    const script = (data as { script?: unknown } | null)?.script;
    if (typeof script !== "string" || !script.trim()) throw new Error("سناریو خالی است.");
    if (script.length > MAX_SCRIPT_CHARS) {
      throw new Error(`سناریو بیشتر از ${MAX_SCRIPT_CHARS} حرف است.`);
    }
    return { script };
  })
  .handler(async ({ data }): Promise<UnderstandResult> => {
    const c = await config();
    if (!c) return { ok: false, error: "مدل زبانی تنظیم نشده است." };
    const { buildMessages, planFromModelReply } = await import("@/studio/script-llm");

    let res: Response;
    try {
      res = await fetch(`${c.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${c.apiKey}` },
        body: JSON.stringify({
          ...c.extra,
          model: c.model,
          messages: buildMessages(data.script),
          temperature: 0,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      return { ok: false, error: timedOut ? "مدل در زمان مجاز جواب نداد." : "اتصال به مدل برقرار نشد." };
    }
    if (!res.ok) return { ok: false, error: `سرویس مدل خطای ${res.status} برگرداند.` };

    let content: unknown;
    try {
      const body = (await res.json()) as { choices?: { message?: { content?: unknown } }[] };
      content = body.choices?.[0]?.message?.content;
    } catch {
      return { ok: false, error: "پاسخ سرویس مدل خوانا نبود." };
    }
    if (typeof content !== "string") return { ok: false, error: "پاسخ مدل متن نداشت." };
    const parsed = planFromModelReply(content);
    return parsed.ok ? { ok: true, plan: parsed.plan, model: c.model } : parsed;
  });
