/**
 * فهم سناریو با Gemini روی Vertex AI (Google Cloud) — فقط روی سرور.
 * generateContent، مدل SCRIPT_AI_GEMINI_MODEL (پیش‌فرض gemini-3.8-flash، منطقهٔ global با SCRIPT_AI_GEMINI_LOCATION)،
 * احراز با اعتبار پیش‌فرض Google Cloud (حساب سرویس Cloud Run)؛ هیچ کلید یا سرویسی بیرون از Google Cloud نیست.
 * فقط کاربر واردشده (Firebase Auth) می‌تواند درخواست بدهد.
 */
import { createServerFn } from "@tanstack/react-start";
import { MAX_SCRIPT_CHARS, type Plan } from "@/studio/script-plan";
import { clientIp, createLimiter, positiveInt } from "./rate-limit";
import type { ExtraCharacter } from "@/studio/script-llm";
import { vertexReply, vertexRequest, vertexUrl, type ChatMessage } from "./script-ai-vertex.ts";

export type ScriptAiStatus = { configured: boolean; model: string | null };

export type TokenUsage = { input: number; output: number };

export type UnderstandResult =
  | { ok: true; plan: Plan; model: string; usage: TokenUsage | null }
  | { ok: false; error: string };

const TIMEOUT_MS = 60_000;

/** پروژهٔ Google Cloud و مدل Gemini؛ بدون پروژه (مثلاً اجرای محلی بدون gcloud) هوش مصنوعی خاموش است. */
async function config() {
  const { env } = await import("./env.server.ts");
  const project = env("GOOGLE_CLOUD_PROJECT")?.trim() || env("GCLOUD_PROJECT")?.trim();
  if (!project) return null;
  const m = env("SCRIPT_AI_GEMINI_MODEL")?.trim();
  return { project, model: m && !/gemini-[12]\./i.test(m) ? m : "gemini-3.8-flash", location: env("SCRIPT_AI_GEMINI_LOCATION")?.trim() || "global" };
}

type ModelReply = { content: unknown; truncated: boolean; usage: TokenUsage | null } | { status: number };

/** یک تماس با سرویس مدل. خطای شبکه/زمان را پرتاب می‌کند؛ خطای HTTP را با status برمی‌گرداند. */
async function callModel(c: NonNullable<Awaited<ReturnType<typeof config>>>, messages: ChatMessage[], maxTokens: number): Promise<ModelReply> {
  const { gcpAccessToken } = await import("./gcp-auth.server.ts");
  const res = await fetch(vertexUrl(c), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await gcpAccessToken()}`, "x-goog-user-project": c.project },
    body: JSON.stringify(vertexRequest(messages, maxTokens)),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    console.error("[script-ai] vertex", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return { status: res.status };
  }
  return vertexReply(await res.json());
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
    const { getRequest, getRequestIP } = await import("@tanstack/react-start/server");
    const { verifyStudioRequest } = await import("./studio-auth.server.ts");
    const who = await verifyStudioRequest(getRequest().headers);
    if (!who.ok) return { ok: false, error: who.message };
    const lim = await limiter();
    const verdict = lim.check(clientIp(getRequest().headers, getRequestIP()));
    if (!verdict.ok) return verdict;
    const { buildMessages, chunkScript, maxOutputTokens, planFromModelReplies } = await import("@/studio/script-llm");

    // سناریوی بلند تکه‌تکه فرستاده می‌شود تا جواب هیچ تکه‌ای به سقف توکن نخورد؛ اگر باز هم خورد،
    // ردیف‌های سالم حفظ و هشدار دیدنی داده می‌شود (نه برگشت بی‌صدا به دیکشنری).
    const replies: { content: string; truncated: boolean; range: { from: number; to: number } }[] = [];
    const total: TokenUsage = { input: 0, output: 0 };
    let counted = false;
    let failure: string | null = null;
    for (const range of chunkScript(data.script)) {
      const budget = maxOutputTokens(data.script, range);
      let reply: ModelReply;
      try {
        reply = await callModel(c, buildMessages(data.script, data.cast, range), budget);
      } catch (err) {
        lim.record(budget);
        const timedOut = err instanceof Error && err.name === "TimeoutError";
        failure = timedOut ? "مدل در زمان مجاز جواب نداد." : err instanceof SyntaxError ? "پاسخ سرویس مدل خوانا نبود." : "اتصال به مدل برقرار نشد.";
        break;
      }
      if ("status" in reply) {
        lim.record(budget);
        failure = `سرویس مدل خطای ${reply.status} برگرداند.`;
        break;
      }
      if (reply.usage) {
        total.input += reply.usage.input;
        total.output += reply.usage.output;
        counted = true;
      }
      lim.record(reply.usage ? reply.usage.input + reply.usage.output : budget);
      const content = reply.content;
      if (typeof content !== "string") {
        failure = "پاسخ مدل متن نداشت.";
        break;
      }
      replies.push({ content, truncated: reply.truncated, range });
    }
    if (replies.length === 0) return { ok: false, error: failure ?? "مدل جوابی نداد." };
    const parsed = planFromModelReplies(replies, data.script, data.cast);
    if (parsed.ok && failure) parsed.plan.warnings.unshift(`بخشی از سناریو به مدل نرسید (${failure})؛ خط‌های بعدی نما ندارند.`);
    return parsed.ok ? { ok: true, plan: parsed.plan, model: c.model, usage: counted ? total : null } : parsed;
  });
