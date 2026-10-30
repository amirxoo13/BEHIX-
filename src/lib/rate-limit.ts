/**
 * محدودیت مصرف مدل زبانی، تا کسی که سایت را باز می‌کند نتواند توکن‌های کلید را تمام کند.
 *
 * - هر IP در هر ساعت حداکثر `perHour` درخواست.
 * - کل سرور در هر روز (UTC) حداکثر `dailyTokens` توکن (ورودی + خروجی).
 *
 * شمارنده‌ها در حافظهٔ همان نمونهٔ سرور است؛ Vercel ممکن است چند نمونه بسازد یا نمونه را
 * دوباره راه بیندازد، پس این سقف «تقریبی» است. سقف قطعی را باید در پنل سرویس مدل گذاشت.
 */
export type Limits = { perHour: number; dailyTokens: number };

export type Verdict = { ok: true } | { ok: false; error: string };

const HOUR = 3_600_000;

export function createLimiter(limits: Limits, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  let day = "";
  let spent = 0;

  const today = () => new Date(now()).toISOString().slice(0, 10);
  const rollDay = () => {
    const d = today();
    if (d !== day) {
      day = d;
      spent = 0;
    }
  };

  return {
    /** قبل از تماس با مدل؛ اگر مجاز بود، درخواست را می‌شمارد. */
    check(ip: string): Verdict {
      rollDay();
      if (spent >= limits.dailyTokens) {
        return { ok: false, error: "سقف مصرف روزانهٔ مدل پر شده؛ فعلاً روش دیکشنری کار می‌کند." };
      }
      const t = now();
      const list = (hits.get(ip) ?? []).filter((x) => t - x < HOUR);
      if (list.length >= limits.perHour) {
        hits.set(ip, list);
        const waitMin = Math.max(1, Math.ceil((HOUR - (t - list[0])) / 60_000));
        return { ok: false, error: `تعداد درخواست‌ها زیاد بود؛ ${waitMin} دقیقهٔ دیگر دوباره امتحان کنید.` };
      }
      list.push(t);
      hits.set(ip, list);
      // جلوی رشد بی‌اندازهٔ حافظه با IPهای زیاد
      if (hits.size > 5000) {
        for (const [k, v] of hits) if (!v.some((x) => t - x < HOUR)) hits.delete(k);
      }
      return { ok: true };
    },
    /** بعد از جواب مدل، توکن مصرف‌شده را ثبت می‌کند. */
    record(tokens: number) {
      rollDay();
      if (Number.isFinite(tokens) && tokens > 0) spent += tokens;
    },
    spentToday(): number {
      rollDay();
      return spent;
    },
  };
}

/**
 * پنجرهٔ لغزان شمارش درخواست برای هر IP با سقف تعداد کلید.
 * وقتی تعداد IPها از `maxKeys` بیشتر شود، اول IPهای بدون درخواست تازه حذف می‌شوند و اگر باز
 * زیاد بود، قدیمی‌ترین IP (کمتر از همه اخیراً دیده‌شده، LRU) حذف می‌شود؛ هرگز همهٔ شمارنده‌ها
 * پاک نمی‌شوند، پس پر کردن جدول با IPهای زیاد سقف بقیه را صفر نمی‌کند.
 */
export function createIpWindow(
  opts: { windowMs: number; max: number; maxKeys?: number },
  now: () => number = Date.now,
) {
  const hits = new Map<string, number[]>();
  const maxKeys = opts.maxKeys ?? 5000;
  const prune = (t: number) => {
    for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] >= opts.windowMs) hits.delete(k);
    // Map ترتیب درج را نگه می‌دارد و هر دسترسی کلید را به آخر می‌برد، پس اولی LRU است.
    for (const k of hits.keys()) {
      if (hits.size <= maxKeys) break;
      hits.delete(k);
    }
  };
  return {
    /** اگر مجاز بود درخواست را می‌شمارد و true می‌دهد. */
    hit(ip: string): boolean {
      const t = now();
      const list = (hits.get(ip) ?? []).filter((x) => t - x < opts.windowMs);
      hits.delete(ip);
      if (list.length >= opts.max) {
        hits.set(ip, list);
        return false;
      }
      list.push(t);
      hits.set(ip, list);
      if (hits.size > maxKeys) prune(t);
      return true;
    },
    size: () => hits.size,
  };
}

/**
 * کلید سهمیهٔ هر کاربر. هدرهای IP را کلاینت هم می‌تواند بفرستد، پس فقط هدری قبول می‌شود
 * که پراکسیِ جلوی سرور خودش می‌نویسد:
 * - روی Vercel: `x-vercel-forwarded-for`.
 * - روی سرور خودتان: نام هدر در `TRUSTED_IP_HEADER` (مثلاً `x-real-ip` پشت nginx). برای
 *   `x-forwarded-for` آخرین مقدار برداشته می‌شود، چون پراکسی (nginx، Cloud Run) آدرس واقعی را
 *   به آخر اضافه می‌کند و مقدارهای قبلی را خود کاربر فرستاده است.
 * - بدون این‌ها: آدرس اتصال (`socketIp`).
 */
export function clientIp(
  headers: Headers,
  socketIp: string | undefined,
  env: Record<string, string | undefined> = process.env,
): string {
  if (env.VERCEL) {
    const value = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    if (value) return value;
  }
  const trusted = env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (trusted) {
    const parts = (headers.get(trusted) ?? "").split(",").map((p) => p.trim()).filter(Boolean);
    const value = trusted === "x-forwarded-for" ? parts.at(-1) : parts[0];
    if (value) return value;
  }
  return socketIp || "unknown";
}

/** عدد مثبت از متغیر محیطی، یا مقدار پیش‌فرض. */
export function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
