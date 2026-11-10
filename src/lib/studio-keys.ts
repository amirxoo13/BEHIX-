/**
 * نام فایل‌های استودیو در Cloud Storage (خالص؛ در Node قابل آزمون).
 *
 * هر فایل تازه زیر پوشهٔ صاحبش نوشته می‌شود و نامش تکراری نیست (تغییرناپذیر):
 *   cast/<owner>/<id>.png                 برگهٔ شخصیت
 *   frames/<owner>/<id>.png               فریم کلیدی
 *   cast/<owner>/<puppet>/<version>.png   اطلس عروسک (+ همان نام با .json)
 * owner = ownerId(uid) (۲۴ hex). نوشتن با ifGenerationMatch=0 است، پس هیچ فایل موجودی بازنویسی نمی‌شود.
 * فایل‌های قدیمی بی‌صاحب (cast/<name>.png) فقط‌خواندنی‌اند و هر کاربر واردشده می‌تواند بخواندشان.
 */
export const KEY_RE = /^(?!.*\.\.)(?!.*\/\/)(cast|frames)\/[A-Za-z0-9_\-.][A-Za-z0-9_\-/.]{0,199}$/;
export const OWNER_RE = /^[0-9a-f]{24}$/;

/** شناسهٔ تصادفی غیرقابل‌حدس (زمان + ۷۲ بیت تصادف). */
export function newId(now = Date.now()): string {
  const rnd = [...crypto.getRandomValues(new Uint8Array(9))].map((b) => b.toString(36).padStart(2, "0")).join("");
  return `${now.toString(36)}${rnd}`;
}

const ext = (mime: string) => (mime.includes("jpeg") ? "jpg" : "png");

export function assetKey(folder: "cast" | "frames", owner: string, mimeType: string, id = newId()): string {
  if (!OWNER_RE.test(owner)) throw new Error("bad owner");
  return `${folder}/${owner}/${id}.${ext(mimeType)}`;
}

/** نام‌های یک نسخهٔ تازهٔ عروسک؛ هر ساخت نسخهٔ جدید است و نسخهٔ قبلی دست نمی‌خورد. */
export function puppetKeys(owner: string, puppet: string, version = newId()): { png: string; json: string; version: string } {
  if (!OWNER_RE.test(owner)) throw new Error("bad owner");
  if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(puppet)) throw new Error("bad puppet id");
  const base = `cast/${owner}/${puppet}/${version}`;
  return { png: `${base}.png`, json: `${base}.json`, version };
}

/** صاحب فایل (بخش دوم نام) یا null برای فایل قدیمی بی‌صاحب. */
export function ownerOfKey(key: string): string | null {
  const parts = key.split("/");
  return parts.length >= 3 && OWNER_RE.test(parts[1]) ? parts[1] : null;
}

/** آیا این کاربر می‌تواند فایل را بخواند/به‌عنوان مرجع به کار ببرد؟ (مال خودش، یا فایل قدیمی بی‌صاحب) */
export function canRead(key: string, owner: string): boolean {
  if (!KEY_RE.test(key)) return false;
  const o = ownerOfKey(key);
  return o === owner || (o === null && key.split("/").length === 2);
}
