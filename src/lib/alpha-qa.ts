/**
 * بررسی کیفیت بُرش (کانال آلفا) تصویر شخصیت پیش از ریگ کردن (خالص؛ در Node و مرورگر).
 * شفافیت در خروجی مدل تصویر تضمین‌شده نیست و پس‌زمینه با keyOutBackground برداشته می‌شود؛ این ماژول
 * می‌سنجد نتیجه قابل استفاده است یا نه:
 *  - coverage: سهم پیکسل‌های پر (آلفا ≥ ۱۲۸)؛ با expected (تعداد پیکسل مورد انتظار) نسبت هم می‌دهد.
 *  - halo: سهم پیکسل‌های لبه که رنگشان هنوز به رنگ پس‌زمینه نزدیک است (هالهٔ سفید دور بدن).
 *  - bbox: قاب محتوا لبهٔ تصویر را نبریده باشد و اندازه‌اش معقول باشد.
 *  - holes: سوراخ‌های شفاف بسته داخل بدن (پس‌زمینهٔ متصل به لبه حساب نمی‌شود).
 */
export type Rgba = { width: number; height: number; data: Uint8Array | Uint8ClampedArray | Buffer };
export type Box = { x0: number; y0: number; x1: number; y1: number };

export type AlphaQaOpts = {
  /** رنگ پس‌زمینهٔ برداشته‌شده (پیش‌فرض سفید). */
  bg?: [number, number, number];
  /** تعداد پیکسل مورد انتظار شخصیت (مثلاً از ماسک مرجع)؛ اگر باشد نسبت coverage در [۰٫۸۵، ۱٫۱۵] لازم است. */
  expectedPixels?: number;
  /** کمترین فاصله از لبهٔ تصویر (پیکسل) تا شخصیت بریده‌شده حساب نشود. */
  margin?: number;
  /** کوچک‌ترین سوراخ شمرده‌شده (سهم از مساحت قاب محتوا). */
  minHole?: number;
};

export type AlphaQa = {
  passed: boolean;
  checks: {
    hasTransparency: boolean;
    coverage: number;
    coverageRatio: number | null;
    haloScore: number;
    bboxOk: boolean;
    bboxFill: number;
    holes: number;
    largestHole: number;
  };
  bbox: Box | null;
  reasons: string[];
};

export const LIMITS = { coverageRatio: [0.85, 1.15] as const, halo: 0.15, maxHoleShare: 0.01, minHeightShare: 0.5, minFill: 0.15 };

const OPAQUE = 128;

export function contentBox(img: Rgba): Box | null {
  const { width: w, height: h, data } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] < OPAQUE) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** سهم پیکسل‌های پر و آیا اصلاً شفافیتی هست. */
export function alphaCoverage(img: Rgba): { coverage: number; opaque: number; hasTransparency: boolean } {
  const n = img.width * img.height;
  let opaque = 0, clear = 0;
  for (let i = 0; i < n; i++) {
    const a = img.data[i * 4 + 3];
    if (a >= OPAQUE) opaque++;
    if (a < 255) clear++;
  }
  return { coverage: n ? opaque / n : 0, opaque, hasTransparency: clear > 0 };
}

/** سهم پیکسل‌های لبه (پر، با همسایهٔ شفاف) که رنگشان نزدیک رنگ پس‌زمینه است. */
export function haloScore(img: Rgba, bg: [number, number, number] = [255, 255, 255], tol = 40): number {
  const { width: w, height: h, data } = img;
  let edge = 0, halo = 0;
  const clear = (x: number, y: number) => x < 0 || y < 0 || x >= w || y >= h || data[(y * w + x) * 4 + 3] < OPAQUE;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (data[i + 3] < OPAQUE) continue;
    if (!(clear(x - 1, y) || clear(x + 1, y) || clear(x, y - 1) || clear(x, y + 1))) continue;
    edge++;
    const d = Math.max(Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]), Math.abs(data[i + 2] - bg[2]));
    if (d <= tol) halo++;
  }
  return edge ? halo / edge : 0;
}

/** سوراخ‌های شفاف بسته: نواحی شفافی که به لبهٔ تصویر راه ندارند. */
export function alphaHoles(img: Rgba, minArea = 1): { count: number; largest: number; areas: number[] } {
  const { width: w, height: h, data } = img;
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  const isClear = (p: number) => data[p * 4 + 3] < OPAQUE;
  const flood = (start: number) => {
    let area = 0, border = false;
    stack.push(start); seen[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      area++;
      const x = p % w, y = (p / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && !seen[q] && isClear(q)) { seen[q] = 1; stack.push(q); }
      }
    }
    return { area, border };
  };
  const areas: number[] = [];
  for (let p = 0; p < w * h; p++) {
    if (seen[p] || !isClear(p)) continue;
    const r = flood(p);
    if (!r.border && r.area >= minArea) areas.push(r.area);
  }
  areas.sort((a, b) => b - a);
  return { count: areas.length, largest: areas[0] ?? 0, areas };
}

/** همهٔ بررسی‌ها + نتیجه. passed=false یعنی بُرش برای ریگ مناسب نیست (باید از مسیر جایگزین ساخت). */
export function runAlphaQa(img: Rgba, o: AlphaQaOpts = {}): AlphaQa {
  const reasons: string[] = [];
  const cov = alphaCoverage(img);
  const bbox = contentBox(img);
  const margin = o.margin ?? 2;
  let bboxOk = false, bboxFill = 0, holesCount = 0, largestShare = 0;
  if (!cov.hasTransparency) reasons.push("no-transparency");
  if (!bbox) reasons.push("empty");
  else {
    const bw = bbox.x1 - bbox.x0 + 1, bh = bbox.y1 - bbox.y0 + 1;
    bboxFill = cov.opaque / (bw * bh);
    const touches = bbox.x0 < margin || bbox.y0 < margin || bbox.x1 > img.width - 1 - margin || bbox.y1 > img.height - 1 - margin;
    bboxOk = !touches && bh >= img.height * LIMITS.minHeightShare && bboxFill >= LIMITS.minFill && bh > bw * 0.8;
    if (touches) reasons.push("cropped-at-edge");
    if (bh < img.height * LIMITS.minHeightShare) reasons.push("figure-too-small");
    if (bboxFill < LIMITS.minFill) reasons.push("sparse-content");
    if (bh <= bw * 0.8) reasons.push("not-a-standing-figure");
    const holes = alphaHoles(img, Math.max(1, Math.round((o.minHole ?? 0.0005) * bw * bh)));
    holesCount = holes.count;
    largestShare = holes.largest / (bw * bh);
    if (largestShare > LIMITS.maxHoleShare) reasons.push("hole-in-body");
  }
  const halo = haloScore(img, o.bg);
  if (halo > LIMITS.halo) reasons.push("edge-halo");
  const ratio = o.expectedPixels ? cov.opaque / o.expectedPixels : null;
  if (ratio !== null && (ratio < LIMITS.coverageRatio[0] || ratio > LIMITS.coverageRatio[1])) reasons.push("coverage-off");
  return {
    passed: reasons.length === 0,
    checks: {
      hasTransparency: cov.hasTransparency,
      coverage: round(cov.coverage), coverageRatio: ratio === null ? null : round(ratio),
      haloScore: round(halo), bboxOk, bboxFill: round(bboxFill), holes: holesCount, largestHole: round(largestShare),
    },
    bbox, reasons,
  };
}

const round = (v: number) => Math.round(v * 10000) / 10000;
