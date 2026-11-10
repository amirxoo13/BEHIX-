/**
 * منطق API استودیو (فقط سرور، بدون وابستگی به TanStack تا در Node آزمون شود).
 * src/routes/api/studio.ts فقط این را به مسیر وصل می‌کند.
 *
 * - همهٔ اقدام‌های پولی (character، keyframe، puppet) و خواندن فایل (GET) کاربرِ تأییدشده می‌خواهند
 *   (studio-auth.server.ts). GET هم بسته است چون هیچ کلاینتی آن را با <img> بی‌هدر نمی‌خواند و فایل‌ها
 *   شخصی‌اند؛ کلاینت باید با هدر Authorization بخواند و blob بسازد.
 * - هیچ کلیدی در مرورگر نیست؛ سرور با حساب سرویس Google Cloud کار می‌کند.
 */
import { z } from "zod";
import { clientIp } from "./rate-limit.ts";
import { verifyStudioRequest, type AuthResult, type StudioUser } from "./studio-auth.server.ts";
import { KEY_RE } from "./studio-media.server.ts";

export const studioBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("character"), description: z.string().trim().min(10).max(600) }).strict(),
  z.object({ action: z.literal("keyframe"), cast: z.array(z.string().regex(KEY_RE)).min(1).max(3), direction: z.string().trim().min(10).max(900) }).strict(),
  z.object({ action: z.literal("puppet"), id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,30}$/), name: z.string().trim().min(1).max(40), who: z.string().trim().min(10).max(600) }).strict(),
]);
export type StudioBody = z.infer<typeof studioBody>;

export type StudioDeps = {
  bucket: () => string;
  auth: (headers: Headers) => Promise<AuthResult>;
  ip: (req: Request) => Promise<string>;
  run: (b: StudioBody, user: StudioUser) => Promise<unknown>;
  getObject: (key: string, range?: string | null) => Promise<Response>;
  now?: () => number;
};

// سقف کوتاه‌مدت هر نشانی در حافظهٔ همین نمونه (فقط برای جلوگیری از رگبار؛ سقف روزانه جداست).
const WINDOW = 10 * 60_000, PER_IP = Number(process.env.STUDIO_PER_IP ?? 30), PER_DAY = Number(process.env.STUDIO_PER_DAY ?? 400);

export function createStudioApi(deps: StudioDeps) {
  const now = deps.now ?? Date.now;
  const hits = new Map<string, number[]>();
  let day = "", today = 0;
  function limited(ip: string): string | null {
    const t = now(), d = new Date(t).toISOString().slice(0, 10);
    if (d !== day) { day = d; today = 0; }
    if (today >= PER_DAY) return "سقف روزانهٔ ساخت پر شده است؛ فردا دوباره امتحان کنید.";
    const list = (hits.get(ip) ?? []).filter((x) => t - x < WINDOW);
    if (list.length >= PER_IP) return "درخواست‌ها زیاد است؛ چند دقیقه دیگر دوباره امتحان کنید.";
    list.push(t);
    hits.set(ip, list);
    if (hits.size > 5000) hits.clear();
    today++;
    return null;
  }

  const fail = (status: number, message: string) => Response.json({ message }, { status, headers: { "cache-control": "no-store" } });

  async function post(req: Request): Promise<Response> {
    if (!deps.bucket()) return fail(503, "استودیو روی این سرور فعال نیست (MEDIA_BUCKET تنظیم نشده).");
    const who = await deps.auth(req.headers);
    if (!who.ok) return fail(who.status, who.message);
    const parsed = studioBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return fail(400, "درخواست معتبر نیست.");
    const b = parsed.data;
    try {
      const block = limited(await deps.ip(req));
      if (block) return fail(429, block);
      const result = await deps.run(b, who.user);
      return Response.json(result, { headers: { "cache-control": "no-store" } });
    } catch (e) {
      console.error("[studio]", b.action, e);
      return fail(502, "ساخت انجام نشد؛ کمی بعد دوباره امتحان کنید.");
    }
  }

  async function get(req: Request): Promise<Response> {
    const k = new URL(req.url).searchParams.get("key") ?? "";
    if (!deps.bucket() || !KEY_RE.test(k)) return fail(404, "فایل پیدا نشد.");
    const who = await deps.auth(req.headers);
    if (!who.ok) return fail(who.status, who.message);
    try {
      const r = await deps.getObject(k, req.headers.get("range"));
      if (!r.ok && r.status !== 206) return fail(r.status === 404 ? 404 : 502, "فایل پیدا نشد.");
      const headers: Record<string, string> = { "content-type": r.headers.get("content-type") ?? "application/octet-stream", "cache-control": "private, max-age=31536000, immutable", "accept-ranges": "bytes" };
      for (const h of ["content-length", "content-range"]) { const v = r.headers.get(h); if (v) headers[h] = v; }
      return new Response(r.body, { status: r.status, headers });
    } catch (e) {
      console.error("[studio] asset", e);
      return fail(502, "خواندن فایل انجام نشد.");
    }
  }

  return { post, get };
}

/** وابستگی‌های واقعی (Google Cloud). جدا از createStudioApi تا آزمون‌ها شبکه نزنند. */
export async function liveStudioDeps(): Promise<StudioDeps> {
  const media = await import("./studio-media.server.ts");
  const { createPuppet } = await import("./puppet-build.server.ts");
  return {
    bucket: media.mediaBucket,
    auth: (h) => verifyStudioRequest(h),
    ip: async (req) => {
      const { getRequestIP } = await import("@tanstack/react-start/server");
      return clientIp(req.headers, getRequestIP());
    },
    run: (b) =>
      b.action === "puppet" ? createPuppet(b.id, b.name, b.who)
      : b.action === "character" ? media.createCharacter(b.description)
      : media.createKeyframe(b.cast, b.direction),
    getObject: media.getObject,
  };
}
