/**
 * Shared per-IP sliding-window limit and CORS for the paid audio routes (/api/tts, /api/voice, /api/music).
 * One counter for all routes, so splitting work across endpoints doesn't dodge the limit.
 */
const ORIGINS = new Set(["capacitor://localhost", "https://localhost", "http://localhost"]);
export const WINDOW_MS = 10 * 60_000;
const hits = new Map<string, number[]>();

export const cors = (req: Request): Record<string, string> => {
  const origin = req.headers.get("origin");
  return origin && ORIGINS.has(origin)
    ? { "access-control-allow-origin": origin, "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-expose-headers": "x-tts-model, x-cache", vary: "origin" }
    : {};
};

export const fail = (req: Request, status: number, message: string) => Response.json({ message }, { status, headers: { ...cors(req), "cache-control": "no-store" } });

export const RATE_MESSAGE = "درخواست‌ها زیاد است؛ چند دقیقه دیگر دوباره امتحان کنید.";
export const DAILY_FULL = "سقف روزانهٔ ساخت صدا پر شده است؛ فردا دوباره امتحان کنید.";

/** Record `cost` hits for ip; returns false (and records nothing) when that would pass `perIp` in the window. */
export function takeHits(ip: string, cost: number, perIp: number, now = Date.now()): boolean {
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length + cost > perIp) {
    hits.set(ip, list);
    return false;
  }
  for (let i = 0; i < cost; i++) list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) prune(now);
  return true;
}

/** Only IPs with no hit in the window are dropped (clear() would reset everyone's limit). */
function prune(now: number) {
  for (const [ip, list] of hits) if (!list.some((t) => now - t < WINDOW_MS)) hits.delete(ip);
  if (hits.size > 5000) hits.delete(hits.keys().next().value as string);
}

/** Test hook. */
export const resetHits = () => hits.clear();
