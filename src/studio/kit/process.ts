/**
 * پردازش برگه‌های Gemini برای «کیت شخصیت» (بدون مدل؛ فقط پیکسل):
 *  - پس‌زمینهٔ سبز #00FF00 → شفاف (لبهٔ نرم + حذف سبزیِ لبه)
 *  - پیدا کردن هر تکه (ناحیه‌های به‌هم‌پیوسته) و نسبت دادن به قاب قالب
 *  - مفصل‌ها: وسطِ سرِ گردِ بالا و پایینِ هر تکه
 *  - دهان‌ها: برداشتن مربع پوست دور لب‌ها (flood fill از لبهٔ مربع با رنگ پوست)
 * ورودی/خروجی: RGBA خام (Uint8Array)، تا در Node (pngjs) و مرورگر یکسان کار کند.
 */
export type Rgba = { width: number; height: number; data: Uint8Array };
export type Box = [x: number, y: number, w: number, h: number];
export type Blob = { id: number; area: number; box: Box; cx: number; cy: number };
export type Pt = { x: number; y: number };

const greenness = (r: number, g: number, b: number) => g - Math.max(r, b);

/** سبز → شفاف. پیکسل‌های نیمه‌سبز لبه، شفافیت جزئی و رنگ بدون سبزی می‌گیرند. */
export function keyGreen(img: Rgba, hard = 90, soft = 40): Rgba {
  const d = new Uint8Array(img.data);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const gr = greenness(r, g, b);
    if (gr >= hard) d[i + 3] = 0;
    else if (gr > soft) {
      d[i + 3] = Math.round(d[i + 3] * (1 - (gr - soft) / (hard - soft)));
      d[i + 1] = Math.max(r, b); // despill
    }
  }
  return { width: img.width, height: img.height, data: d };
}

/** ناحیه‌های به‌هم‌پیوستهٔ کدر (alpha > 128)؛ برچسب هر پیکسل در labels. */
export function blobs(img: Rgba, minArea = 400): { blobs: Blob[]; labels: Int32Array } {
  const { width: w, height: h, data } = img;
  const labels = new Int32Array(w * h).fill(-1);
  const out: Blob[] = [];
  const stack: number[] = [];
  for (let p = 0; p < w * h; p++) {
    if (labels[p] !== -1 || data[p * 4 + 3] <= 128) continue;
    const id = out.length;
    let area = 0, sx = 0, sy = 0, x0 = w, y0 = h, x1 = 0, y1 = 0;
    labels[p] = id;
    stack.push(p);
    while (stack.length) {
      const q = stack.pop() as number;
      const x = q % w, y = (q - x) / w;
      area++; sx += x; sy += y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const n = ny * w + nx;
        if (labels[n] === -1 && data[n * 4 + 3] > 128) { labels[n] = id; stack.push(n); }
      }
    }
    out.push({ id, area, box: [x0, y0, x1 - x0 + 1, y1 - y0 + 1], cx: sx / area, cy: sy / area });
  }
  return { blobs: out.filter((b) => b.area >= minArea), labels };
}

/** هر قاب قالب ← بزرگ‌ترین ناحیه‌ای که مرکزش به مرکز قاب نزدیک‌تر است (هر ناحیه فقط یک بار). */
export function assign<K extends string>(found: Blob[], boxes: Record<K, Box>, scale = 1): Record<K, Blob> {
  const keys = Object.keys(boxes) as K[];
  const pairs: { k: K; b: Blob; d: number }[] = [];
  for (const k of keys) {
    const [x, y, w, h] = boxes[k];
    const cx = (x + w / 2) * scale, cy = (y + h / 2) * scale;
    for (const b of found) pairs.push({ k, b, d: Math.hypot(b.cx - cx, b.cy - cy) / Math.sqrt(b.area) });
  }
  pairs.sort((a, b) => a.d - b.d);
  const res = {} as Record<K, Blob>, used = new Set<number>();
  for (const p of pairs) if (!res[p.k] && !used.has(p.b.id)) { res[p.k] = p.b; used.add(p.b.id); }
  const missing = keys.filter((k) => !res[k]);
  if (missing.length) throw new Error(`تکه پیدا نشد: ${missing.join(", ")}`);
  return res;
}

/** فقط پیکسل‌های یک ناحیه، بریده به قاب خودش (+حاشیه). */
export function cut(img: Rgba, labels: Int32Array, b: Blob, pad = 2): { img: Rgba; ox: number; oy: number } {
  const [bx, by, bw, bh] = b.box;
  const x0 = Math.max(0, bx - pad), y0 = Math.max(0, by - pad);
  const x1 = Math.min(img.width, bx + bw + pad), y1 = Math.min(img.height, by + bh + pad);
  const w = x1 - x0, h = y1 - y0, d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sp = (y + y0) * img.width + (x + x0), dp = (y * w + x) * 4;
    // پیکسل‌های نیمه‌شفاف لبه (برچسب ندارند) را هم نگه می‌داریم اگر کنار همین ناحیه باشند
    const own = labels[sp] === b.id || (labels[sp] === -1 && img.data[sp * 4 + 3] > 0 && near(labels, img.width, img.height, (x + x0), (y + y0), b.id));
    if (!own) continue;
    d.set(img.data.subarray(sp * 4, sp * 4 + 4), dp);
  }
  return { img: { width: w, height: h, data: d }, ox: x0, oy: y0 };
}
function near(labels: Int32Array, w: number, h: number, x: number, y: number, id: number): boolean {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < w && ny < h && labels[ny * w + nx] === id) return true;
  }
  return false;
}

/** پهنای کدرِ یک ردیف: [چپ، راست] یا null. */
function span(img: Rgba, y: number): [number, number] | null {
  let l = -1, r = -1;
  for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3] > 128) { if (l < 0) l = x; r = x; }
  return l < 0 ? null : [l, r];
}

/**
 * مفصل‌های بالا و پایینِ یک تکهٔ عمودی (بازو، ساعد، ران، ساق): مرکزِ سرِ گرد،
 * یعنی نیم‌پهنای تکه پایین‌تر از لبهٔ بالا (و بالاتر از لبهٔ پایین).
 */
export function limbJoints(part: Rgba): { top: Pt; bottom: Pt } {
  const h = part.height;
  const rowAt = (frac: number) => {
    const y = Math.round(h * frac);
    return span(part, Math.min(h - 1, Math.max(0, y)));
  };
  const top = rowAt(0.18), bot = rowAt(0.82);
  if (!top || !bot) throw new Error("تکه برای مفصل خوانا نیست");
  const firstRow = (() => { for (let y = 0; y < h; y++) if (span(part, y)) return y; return 0; })();
  const lastRow = (() => { for (let y = h - 1; y >= 0; y--) if (span(part, y)) return y; return h - 1; })();
  const tw = top[1] - top[0], bw = bot[1] - bot[0];
  return {
    top: { x: (top[0] + top[1]) / 2, y: Math.min(firstRow + tw * 0.5, h * 0.35) },
    bottom: { x: (bot[0] + bot[1]) / 2, y: Math.max(lastRow - bw * 0.5, h * 0.65) },
  };
}

/** میانگین رنگ نوار بیرونی یک تصویر (برای پیدا کردن رنگ پوستِ مربع دور دهان). */
function borderColor(img: Rgba): [number, number, number] {
  let r = 0, g = 0, b = 0, n = 0;
  const { width: w, height: h, data } = img;
  const take = (x: number, y: number) => { const i = (y * w + x) * 4; if (data[i + 3] > 200) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; } };
  for (let x = 4; x < w - 4; x++) { take(x, 4); take(x, h - 5); }
  for (let y = 4; y < h - 4; y++) { take(4, y); take(w - 5, y); }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}

/**
 * مربع پوستِ دور لب‌ها را برمی‌دارد: از لبهٔ مربع با رنگ نزدیک به پوست پخش می‌شود.
 * لب‌ها (تیره‌تر/صورتی‌تر و با خط دور) و دندان باقی می‌مانند؛ لبه نرم می‌شود.
 */
export function peelSkin(img: Rgba, tol = 30): Rgba {
  const { width: w, height: h } = img;
  const d = new Uint8Array(img.data);
  const [sr, sg, sb] = borderColor(img);
  const dist = (p: number) => Math.hypot(d[p * 4] - sr, d[p * 4 + 1] - sg, d[p * 4 + 2] - sb);
  const bg = new Uint8Array(w * h);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (bg[p]) return;
    if (d[p * 4 + 3] > 0 && dist(p) > tol) return;
    bg[p] = 1; stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) { const p = stack.pop() as number; const x = p % w, y = (p - x) / w; push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1); }
  for (let p = 0; p < w * h; p++) {
    if (bg[p]) { d[p * 4 + 3] = 0; continue; }
    // پیکسل لب کنار پوست برداشته‌شده: کمی نرم
    const x = p % w, y = (p - x) / w;
    let edge = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < w && ny < h && bg[ny * w + nx]) edge++; }
    if (edge) d[p * 4 + 3] = Math.round(d[p * 4 + 3] * (edge >= 2 ? 0.55 : 0.8));
  }
  return { width: w, height: h, data: d };
}

/** بریدن به کوچک‌ترین قابِ پیکسل‌های کدر (+حاشیه). */
export function trim(img: Rgba, pad = 2): { img: Rgba; ox: number; oy: number } {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return { img, ox: 0, oy: 0 };
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1, d = new Uint8Array(nw * nh * 4);
  for (let y = 0; y < nh; y++) d.set(data.subarray(((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4), y * nw * 4);
  return { img: { width: nw, height: nh, data: d }, ox: x0, oy: y0 };
}

/** بُرشِ داخلیِ یک قاب (حذف خط قاب دور مربع‌های دهان). */
export function inset(img: Rgba, frac = 0.06): Rgba {
  const dx = Math.round(img.width * frac), dy = Math.round(img.height * frac);
  const w = img.width - 2 * dx, h = img.height - 2 * dy, d = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) d.set(img.data.subarray(((y + dy) * img.width + dx) * 4, ((y + dy) * img.width + dx + w) * 4), y * w * 4);
  return { width: w, height: h, data: d };
}
