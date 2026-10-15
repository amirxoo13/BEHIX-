/**
 * پردازش عکس سر (مثلاً خروجی کارتونی Canva) برای ساخت شخصیت سفارشی.
 * همهٔ تابع‌ها روی پیکسل‌های خام کار می‌کنند (بدون DOM) تا در Node قابل تست باشند.
 */
export type Pixels = { data: Uint8ClampedArray; width: number; height: number };
export type Pt = { x: number; y: number };

/** آیا تصویر جای شفاف دارد (پس‌زمینه از قبل حذف شده)؟ */
export function hasTransparency(img: Pixels): boolean {
  const d = img.data;
  let clear = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 16) clear++;
  return clear > (d.length / 4) * 0.02;
}

function dist2(d: Uint8ClampedArray, i: number, r: number, g: number, b: number) {
  const dr = d[i] - r;
  const dg = d[i + 1] - g;
  const db = d[i + 2] - b;
  return dr * dr + dg * dg + db * db;
}

/**
 * حذف پس‌زمینهٔ یک‌رنگ (یا نزدیک به یک‌رنگ): از لبه‌های تصویر شروع می‌کند و هر پیکسل
 * هم‌رنگِ پس‌زمینه را که به لبه راه دارد شفاف می‌کند (flood fill). پیکسل‌های داخل صورت
 * که با لبه‌ها ارتباط ندارند دست نمی‌خورند، حتی اگر هم‌رنگ پس‌زمینه باشند.
 * رنگ پس‌زمینه = میانگین چهار گوشه. `tolerance` فاصلهٔ رنگی مجاز (۰ تا ۴۴۲).
 */
export function removeFlatBackground(img: Pixels, tolerance = 42): Pixels {
  const { width: w, height: h } = img;
  const d = new Uint8ClampedArray(img.data);
  const corners = [0, w - 1, (h - 1) * w, h * w - 1];
  let r = 0;
  let g = 0;
  let b = 0;
  for (const c of corners) {
    r += d[c * 4];
    g += d[c * 4 + 1];
    b += d[c * 4 + 2];
  }
  r /= 4;
  g /= 4;
  b /= 4;
  const tol2 = tolerance * tolerance;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (p: number) => {
    if (seen[p]) return;
    seen[p] = 1;
    if (dist2(d, p * 4, r, g, b) <= tol2) stack.push(p);
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const p = stack.pop()!;
    d[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  return { data: d, width: w, height: h };
}

/** کادر کوچک‌ترین مستطیلی که همهٔ پیکسل‌های غیرشفاف را دارد؛ null اگر تصویر خالی است. */
export function contentBox(img: Pixels): { x: number; y: number; w: number; h: number } | null {
  const { width: w, height: h, data: d } = img;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 16) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * رنگ پوست برای پوشاندن دهان/چشم اصلی و رنگ دست‌ها: میانگین پیکسل‌های غیرشفاف
 * روی دو گونه (کمی بالا و دو طرف دهان). `mouth` نسبی (۰ تا ۱).
 */
export function sampleSkin(img: Pixels, mouth: Pt): string {
  const { width: w, height: h, data: d } = img;
  const spots = [
    { x: mouth.x - 0.17, y: mouth.y - 0.06 },
    { x: mouth.x + 0.17, y: mouth.y - 0.06 },
  ];
  const rad = Math.max(1, Math.round(Math.min(w, h) * 0.03));
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const s of spots) {
    const cx = Math.round(s.x * w);
    const cy = Math.round(s.y * h);
    for (let y = cy - rad; y <= cy + rad; y++) {
      for (let x = cx - rad; x <= cx + rad; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = (y * w + x) * 4;
        if (d[i + 3] < 200) continue;
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n++;
      }
    }
  }
  if (n === 0) return "#e0b07a";
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** اندازهٔ جدید برای کوچک کردن (بزرگ‌ترین ضلع حداکثر `max`)، بدون بزرگ کردن. */
export function fitSize(w: number, h: number, max: number): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}
