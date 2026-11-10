let day = "",
  today = 0;

/**
 * سهمیهٔ روزانه پیش از درخواست پولی رزرو می‌شود (و اگر ساخت شکست خورد برمی‌گردد).
 * با باکت، شمارنده در metadata یک شیء Cloud Storage است و با ifMetagenerationMatch به‌صورت اتمی
 * بین همهٔ نمونه‌های سرور و پس از راه‌اندازی دوباره مشترک می‌ماند؛ بدون باکت، شمارندهٔ حافظهٔ همین نمونه.
 */
export async function reserveDaily(auth: Record<string, string>, bucket: string | undefined, perDay: number, delta: 1 | -1, on?: string): Promise<string | null> {
  // پس‌دادن سهم همیشه به روزی برمی‌گردد که رزرو در آن انجام شد، نه روز فعلی (درخواست نزدیک نیمه‌شب)
  const d = on ?? new Date().toISOString().slice(0, 10);
  if (!bucket) {
    if (d !== day) {
      if (d < day) return d; // سهم روزی که گذشته دیگر اهمیتی ندارد
      day = d;
      today = 0;
    }
    if (delta > 0 && today >= perDay) return null;
    today = Math.max(0, today + delta);
    return d;
  }
  const url = `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(`quota/${d}`)}`;
  for (let attempt = 0; attempt < 8; attempt++) {
    const r = await fetch(`${url}?fields=metageneration,metadata`, { headers: auth });
    if (r.status === 404) {
      const made = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o?uploadType=media&ifGenerationMatch=0&name=${encodeURIComponent(`quota/${d}`)}`, { method: "POST", headers: { ...auth, "content-type": "text/plain" }, body: "" });
      if (!made.ok && made.status !== 412) throw new Error(`quota create ${made.status}`);
      continue;
    }
    if (!r.ok) throw new Error(`quota read ${r.status}`);
    const o = (await r.json()) as { metageneration: string; metadata?: { count?: string } };
    const count = Number(o.metadata?.count ?? 0);
    if (delta > 0 && count >= perDay) return null;
    const w = await fetch(`${url}?ifMetagenerationMatch=${o.metageneration}`, { method: "PATCH", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify({ metadata: { count: String(Math.max(0, count + delta)) } }) });
    if (w.ok) return d;
    if (w.status !== 412) throw new Error(`quota write ${w.status}`);
    // فاصلهٔ تصادفی فقط برای کم‌کردن برخورد هم‌زمان است، نه امنیت؛ با crypto تا هشدار امنیتی نباشد
    await new Promise((res) => setTimeout(res, 20 + (crypto.getRandomValues(new Uint8Array(1))[0] / 255) * 80 * (attempt + 1)));
  }
  throw new Error("quota contention");
}
