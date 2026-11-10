/**
 * سهمیهٔ روزانهٔ پایدار استودیو (به ازای هر کاربر + کل سرور) در Cloud Storage.
 * هر شمارنده metadata یک شیء خالی است؛ نوشتن با ifMetagenerationMatch (و ساختن با ifGenerationMatch=0)
 * انجام می‌شود، پس بین همهٔ نمونه‌های سرور و پس از راه‌اندازی دوباره اتمی و مشترک است.
 * سهم پیش از کار پولی رزرو و در صورت شکست پس داده می‌شود.
 *
 *   STUDIO_PER_USER_DAY  سقف روزانهٔ هر کاربر (پیش‌فرض ۲۰)
 *   STUDIO_PER_DAY       سقف روزانهٔ کل سرور (پیش‌فرض ۴۰۰)
 */
export type QuotaDeps = { bucket: string; auth: () => Promise<Record<string, string>>; fetch?: typeof fetch; now?: () => number };
export type Reservation = { day: string; keys: string[] };

const GCS = "https://storage.googleapis.com";
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
export const studioLimits = (env: Record<string, string | undefined> = process.env) => ({
  perUser: num(env.STUDIO_PER_USER_DAY, 20),
  perDay: num(env.STUDIO_PER_DAY, 400),
});

export const quotaKey = (day: string, scope: string) => `quota/studio/${day}/${scope}`;

/** +۱ یا -۱ روی یک شمارنده؛ اگر +۱ از سقف بگذرد false. */
export async function bumpCounter(deps: QuotaDeps, key: string, limit: number, delta: 1 | -1): Promise<boolean> {
  const f = deps.fetch ?? fetch;
  const auth = await deps.auth();
  const url = `${GCS}/storage/v1/b/${deps.bucket}/o/${encodeURIComponent(key)}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = await f(`${url}?fields=metageneration,metadata`, { headers: auth });
    if (r.status === 404) {
      if (delta < 0) return true; // چیزی برای پس دادن نیست
      const made = await f(`${GCS}/upload/storage/v1/b/${deps.bucket}/o?uploadType=media&ifGenerationMatch=0&name=${encodeURIComponent(key)}`, {
        method: "POST",
        headers: { ...auth, "content-type": "text/plain" },
        body: "",
      });
      if (!made.ok && made.status !== 412) throw new Error(`quota create ${made.status}`);
      continue;
    }
    if (!r.ok) throw new Error(`quota read ${r.status}`);
    const o = (await r.json()) as { metageneration: string; metadata?: { count?: string } };
    const count = Number(o.metadata?.count ?? 0) || 0;
    if (delta > 0 && count >= limit) return false;
    const w = await f(`${url}?ifMetagenerationMatch=${encodeURIComponent(o.metageneration)}`, {
      method: "PATCH",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ metadata: { count: String(Math.max(0, count + delta)) } }),
    });
    if (w.ok) return true;
    if (w.status !== 412) throw new Error(`quota write ${w.status}`);
    await new Promise((res) => setTimeout(res, 15 + (crypto.getRandomValues(new Uint8Array(1))[0] / 255) * 60 * (attempt + 1)));
  }
  throw new Error("quota contention");
}

/**
 * یک واحد از سهم کاربر و سهم کل سرور را رزرو می‌کند. اگر یکی پر بود، رزرو دیگری پس داده می‌شود.
 * خروجی: رزرو (برای refund) یا پیام فارسیِ رد.
 */
export async function reserveStudio(deps: QuotaDeps, owner: string, limits = studioLimits()): Promise<Reservation | { error: string }> {
  const day = new Date((deps.now ?? Date.now)()).toISOString().slice(0, 10);
  const userKey = quotaKey(day, `u/${owner}`), allKey = quotaKey(day, "all");
  if (!(await bumpCounter(deps, userKey, limits.perUser, 1))) return { error: "سقف ساخت امروز شما پر شده است؛ فردا دوباره امتحان کنید." };
  let all = false;
  try {
    all = await bumpCounter(deps, allKey, limits.perDay, 1);
  } catch (e) {
    await bumpCounter(deps, userKey, limits.perUser, -1).catch(() => {});
    throw e;
  }
  if (!all) {
    await bumpCounter(deps, userKey, limits.perUser, -1).catch(() => {});
    return { error: "سقف روزانهٔ ساخت پر شده است؛ فردا دوباره امتحان کنید." };
  }
  return { day, keys: [userKey, allKey] };
}

/** پس دادن رزرو وقتی کار پولی شکست خورد (به همان روز رزرو). هرگز throw نمی‌کند. */
export async function refundStudio(deps: QuotaDeps, r: Reservation): Promise<void> {
  for (const k of r.keys) await bumpCounter(deps, k, Infinity, -1).catch((e) => console.error("[studio] refund", e));
}
