import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clientIp } from "@/lib/rate-limit";
import { KEY_RE, OP_RE, createCharacter, createKeyframe, getObject, mediaBucket, startVideo, videoStatus } from "@/lib/studio-media.server";
import { createPuppet } from "@/lib/puppet-build.server";

/**
 * API استودیو: شناسنامهٔ بازیگر، فریم کلیدی، نمای متحرک (Veo) و خواندن فایل‌ها از Cloud Storage.
 * هیچ کلیدی در مرورگر نیست؛ سرور با حساب سرویس Google Cloud کار می‌کند.
 */
const key = z.string().regex(KEY_RE);
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("character"), description: z.string().trim().min(10).max(600) }).strict(),
  z.object({ action: z.literal("keyframe"), cast: z.array(key).min(1).max(3), direction: z.string().trim().min(10).max(900) }).strict(),
  z.object({ action: z.literal("video"), frame: key, prompt: z.string().trim().min(10).max(1200), seconds: z.union([z.literal(4), z.literal(6), z.literal(8)]) }).strict(),
  z.object({ action: z.literal("puppet"), id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,30}$/), name: z.string().trim().min(1).max(40), who: z.string().trim().min(10).max(600) }).strict(),
  z.object({ action: z.literal("status"), op: z.string().regex(OP_RE) }).strict(),
]);

// سقف ساخت برای هر نشانی در ده دقیقه و سقف کل روزانهٔ همین نمونهٔ سرور (ویدیو گران است).
const WINDOW = 10 * 60_000, PER_IP = Number(process.env.STUDIO_PER_IP ?? 30), PER_DAY = Number(process.env.STUDIO_PER_DAY ?? 400);
const hits = new Map<string, number[]>();
let day = "", today = 0;
function limited(ip: string): string | null {
  const now = Date.now(), d = new Date().toISOString().slice(0, 10);
  if (d !== day) { day = d; today = 0; }
  if (today >= PER_DAY) return "سقف روزانهٔ ساخت پر شده است؛ فردا دوباره امتحان کنید.";
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (list.length >= PER_IP) return "درخواست‌ها زیاد است؛ چند دقیقه دیگر دوباره امتحان کنید.";
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  today++;
  return null;
}

const fail = (status: number, message: string) => Response.json({ message }, { status, headers: { "cache-control": "no-store" } });

async function post(req: Request): Promise<Response> {
  if (!mediaBucket()) return fail(503, "استودیو روی این سرور فعال نیست (MEDIA_BUCKET تنظیم نشده).");
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(400, "درخواست معتبر نیست.");
  const b = parsed.data;
  try {
    if (b.action === "status") return Response.json(await videoStatus(b.op), { headers: { "cache-control": "no-store" } });
    const { getRequestIP } = await import("@tanstack/react-start/server");
    const block = limited(clientIp(req.headers, getRequestIP()));
    if (block) return fail(429, block);
    const result =
      b.action === "puppet" ? await createPuppet(b.id, b.name, b.who)
      : b.action === "character" ? await createCharacter(b.description)
      : b.action === "keyframe" ? await createKeyframe(b.cast, b.direction)
      : await startVideo(b.frame, b.prompt, b.seconds);
    return Response.json(result, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("[studio]", b.action, e);
    return fail(502, "ساخت انجام نشد؛ کمی بعد دوباره امتحان کنید.");
  }
}

async function get(req: Request): Promise<Response> {
  const k = new URL(req.url).searchParams.get("key") ?? "";
  if (!mediaBucket() || !KEY_RE.test(k)) return fail(404, "فایل پیدا نشد.");
  try {
    const r = await getObject(k, req.headers.get("range"));
    if (!r.ok && r.status !== 206) return fail(r.status === 404 ? 404 : 502, "فایل پیدا نشد.");
    const headers: Record<string, string> = { "content-type": r.headers.get("content-type") ?? "application/octet-stream", "cache-control": "private, max-age=31536000, immutable", "accept-ranges": "bytes" };
    for (const h of ["content-length", "content-range"]) { const v = r.headers.get(h); if (v) headers[h] = v; }
    return new Response(r.body, { status: r.status, headers });
  } catch (e) {
    console.error("[studio] asset", e);
    return fail(502, "خواندن فایل انجام نشد.");
  }
}

export const Route = createFileRoute("/api/studio")({
  server: { handlers: { POST: ({ request }) => post(request), GET: ({ request }) => get(request) } },
});
