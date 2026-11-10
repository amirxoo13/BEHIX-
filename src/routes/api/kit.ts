import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { gcpAccessToken } from "@/lib/gcp-auth.server";
import { gcsGet } from "@/lib/gcs.server";
import { clientIp } from "@/lib/rate-limit";
import { reserveDaily } from "@/lib/tts-quota";
import { cors, DAILY_FULL, fail, RATE_MESSAGE, requireUser, takeHits } from "@/lib/voice-limits.server";

/**
 * POST /api/kit {name, description, photo(dataURL)} → {kit}: ساخت شخصیت با Gemini (src/lib/kit.server.ts).
 * GET  /api/kit?f=<id>/<n>.png → تکه‌های کیت از Cloud Storage (هم‌دامنه تا canvas خروجی ویدیو آلوده نشود).
 * فقط کاربر واردشده؛ هر شخصیت KIT_COST واحد از سهم روزانهٔ مشترک صدا/تصویر مصرف می‌کند.
 */
const body = z.object({ name: z.string().trim().min(1).max(30), description: z.string().trim().min(3).max(600), photo: z.string().max(9_000_000) }).strict();
const PER_IP = Number(process.env.TTS_PER_IP ?? 120), PER_DAY = Number(process.env.TTS_PER_DAY ?? 3000), COST = Number(process.env.KIT_COST ?? 20);

async function post(req: Request): Promise<Response> {
  const project = process.env.GOOGLE_CLOUD_PROJECT, bucket = process.env.KIT_BUCKET || process.env.TTS_BUCKET;
  if (!project || !bucket) return fail(req, 503, "ساخت شخصیت روی این سرور فعال نیست.");
  const denied = await requireUser(req);
  if (denied) return denied;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(req, 400, "اسم، توضیح لباس و عکس سر لازم است.");
  const { makeCharacterKit, gcsKitStore, photoInput } = await import("@/lib/kit.server");
  let photo;
  try {
    photo = photoInput(parsed.data.photo);
  } catch (e) {
    return fail(req, 400, (e as Error).message);
  }
  const { getRequestIP } = await import("@tanstack/react-start/server");
  if (!takeHits(clientIp(req.headers, getRequestIP()), COST, PER_IP)) return fail(req, 429, RATE_MESSAGE);
  const auth = { authorization: `Bearer ${await gcpAccessToken()}` };
  const reserved = await reserveDaily(auth, bucket, PER_DAY, COST);
  if (!reserved) return fail(req, 429, DAILY_FULL);
  try {
    const kit = await makeCharacterKit({ project, name: parsed.data.name, description: parsed.data.description, photo, store: gcsKitStore(bucket) });
    return Response.json({ kit }, { headers: { ...cors(req), "cache-control": "no-store" } });
  } catch (e) {
    console.error("[kit]", e);
    await reserveDaily(auth, bucket, PER_DAY, -COST, reserved).catch(() => {});
    return fail(req, 502, `ساخت شخصیت انجام نشد: ${(e as Error).message}`);
  }
}

async function get(req: Request): Promise<Response> {
  const bucket = process.env.KIT_BUCKET || process.env.TTS_BUCKET;
  const f = new URL(req.url).searchParams.get("f") ?? "";
  const { KIT_FILE } = await import("@/lib/kit.server");
  if (!bucket || !KIT_FILE.test(f)) return new Response("not found", { status: 404 });
  const got = await gcsGet(bucket, `kits/${f}`, { authorization: `Bearer ${await gcpAccessToken()}` });
  if (!got) return new Response("not found", { status: 404 });
  return new Response(got.bytes, { headers: { ...cors(req), "content-type": f.endsWith(".json") ? "application/json" : "image/png", "cache-control": "public, max-age=31536000, immutable" } });
}

export const Route = createFileRoute("/api/kit")({
  server: {
    handlers: {
      POST: ({ request }) => post(request),
      GET: ({ request }) => get(request),
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: cors(request) }),
    },
  },
});
