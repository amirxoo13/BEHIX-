/**
 * تماس با مدل زبانی برای فهم سناریو — فقط روی سرور، تا کلید API به مرورگر نرسد.
 *
 * هر سرویسی که «API سازگار با OpenAI» دارد کار می‌کند (Qwen، Grok/xAI، OpenAI، DeepSeek، ...).
 * عوض کردن مدل فقط با تغییر این سه متغیر محیطی در متغیرهای محیطی سرور است، بدون تغییر کد:
 *   SCRIPT_AI_BASE_URL  آدرس پایهٔ API، مثلاً https://.../v1
 *   SCRIPT_AI_API_KEY   کلید API
 *   SCRIPT_AI_MODEL     اسم مدل
 * و یک متغیر اختیاری برای تنظیم‌های مخصوص هر سرویس (JSON که به بدنهٔ درخواست اضافه می‌شود):
 *   SCRIPT_AI_EXTRA_BODY  مثلاً برای Qwen: {"enable_thinking":false}
 *                         (بدون آن، مدل‌های Qwen 3.x اول «فکر» می‌کنند و بیش از یک دقیقه طول می‌کشد)
 */
import { createServerFn } from "@tanstack/react-start";
import { MAX_SCRIPT_CHARS, type Plan } from "@/studio/script-plan";
import { clientIp, createLimiter, positiveInt } from "./rate-limit";
import type { ExtraCharacter } from "@/studio/script-llm";

export type ScriptAiStatus = { configured: boolean; model: string | null };

export type TokenUsage = { input: number; output: number };

export type UnderstandResult =
  | { ok: true; plan: Plan; model: string; usage: TokenUsage | null }
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

// سقف‌ها از متغیر محیطی (اختیاری): SCRIPT_AI_PER_HOUR (پیش‌فرض ۱۰ درخواست در ساعت برای هر IP)
// و SCRIPT_AI_DAILY_TOKENS (پیش‌فرض ۳۰٬۰۰۰ توکن در روز برای کل سرور).
let shared: ReturnType<typeof createLimiter> | null = null;
async function limiter() {
  if (!shared) {
    const { env } = await import("./env.server.ts");
    shared = createLimiter({
      perHour: positiveInt(env("SCRIPT_AI_PER_HOUR"), 10),
      dailyTokens: positiveInt(env("SCRIPT_AI_DAILY_TOKENS"), 30_000),
    });
  }
  return shared;
}

export const getScriptAiStatus = createServerFn({ method: "POST" }).handler(
  async (): Promise<ScriptAiStatus> => {
    const c = await config();
    return { configured: c !== null, model: c?.model ?? null };
  },
);

export const understandScript = createServerFn({ method: "POST" })
  .validator((data: unknown): { script: string; cast: ExtraCharacter[] } => {
    const script = (data as { script?: unknown } | null)?.script;
    const rawCast = (data as { cast?: unknown } | null)?.cast;
    if (typeof script !== "string" || !script.trim()) throw new Error("سناریو خالی است.");
    if (script.length > MAX_SCRIPT_CHARS) {
      throw new Error(`سناریو بیشتر از ${MAX_SCRIPT_CHARS} حرف است.`);
    }
    // شخصیت‌های سفارشی: فقط شناسه و اسم، با قالب و اندازهٔ محدود.
    const cast: ExtraCharacter[] = [];
    if (Array.isArray(rawCast)) {
      for (const c of rawCast.slice(0, 8)) {
        const o = c && typeof c === "object" ? (c as Record<string, unknown>) : null;
        if (!o || typeof o.id !== "string" || !/^u-[a-z0-9]{3,24}$/.test(o.id)) continue;
        if (typeof o.name !== "string" || !o.name.trim() || o.name.length > 30) continue;
        cast.push({ id: o.id, name: o.name.trim().replace(/[\n\r=,]/g, " ") });
      }
    }
    return { script, cast };
  })
  .handler(async ({ data }): Promise<UnderstandResult> => {
    const c = await config();
    if (!c) return { ok: false, error: "مدل زبانی تنظیم نشده است." };
    const lim = await limiter();
    const { getRequest, getRequestIP } = await import("@tanstack/react-start/server");
    const verdict = lim.check(clientIp(getRequest().headers, getRequestIP()));
    if (!verdict.ok) return verdict;
    const { buildMessages, maxOutputTokens, planFromModelReply } = await import("@/studio/script-llm");

    let res: Response;
    try {
      res = await fetch(`${c.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${c.apiKey}` },
        body: JSON.stringify({
          ...c.extra,
          model: c.model,
          messages: buildMessages(data.script, data.cast),
          temperature: 0,
          max_tokens: maxOutputTokens(data.script),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      return { ok: false, error: timedOut ? "مدل در زمان مجاز جواب نداد." : "اتصال به مدل برقرار نشد." };
    }
    if (!res.ok) return { ok: false, error: `سرویس مدل خطای ${res.status} برگرداند.` };

    let content: unknown;
    let usage: TokenUsage | null = null;
    try {
      const body = (await res.json()) as {
        choices?: { message?: { content?: unknown } }[];
        usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
      };
      content = body.choices?.[0]?.message?.content;
      const u = body.usage;
      if (u && typeof u.prompt_tokens === "number" && typeof u.completion_tokens === "number") {
        usage = { input: u.prompt_tokens, output: u.completion_tokens };
      }
    } catch {
      return { ok: false, error: "پاسخ سرویس مدل خوانا نبود." };
    }
    lim.record(usage ? usage.input + usage.output : maxOutputTokens(data.script));
    if (typeof content !== "string") return { ok: false, error: "پاسخ مدل متن نداشت." };
    const parsed = planFromModelReply(content, data.script, data.cast);
    return parsed.ok ? { ok: true, plan: parsed.plan, model: c.model, usage } : parsed;
  });
