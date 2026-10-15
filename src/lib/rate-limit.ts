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

/** عدد مثبت از متغیر محیطی، یا مقدار پیش‌فرض. */
export function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
