// T09: اشتراک‌گذاری ویدیوی خروجی با Web Share Level 2 و بازگشت به دانلود.

/** پسوند و MIME را از blob.type (یا mime صریح) می‌گیرد؛ هم MP4 و هم WebM. */
export function filmFileInfo(blob: Blob, mimeHint?: string): { ext: string; mime: string } {
  const mime = (blob.type || mimeHint || "video/webm").split(";")[0].trim().toLowerCase();
  const sub = mime.split("/")[1] || "webm";
  const ext = sub === "quicktime" ? "mov" : sub === "x-matroska" ? "mkv" : sub.replace(/[^a-z0-9]/g, "") || "webm";
  return { ext, mime };
}

export function filmFile(blob: Blob, mimeHint?: string, stamp = Date.now()): File {
  const { ext, mime } = filmFileInfo(blob, mimeHint);
  return new File([blob], `behix-${stamp}.${ext}`, { type: mime });
}

export function downloadFile(file: File) {
  const href = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = href;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

export type ShareResult = "shared" | "cancelled" | "not-allowed" | "unsupported" | "failed";

/**
 * share فقط وقتی canShare({files}) true باشد. share اولین await است تا user activation حفظ شود.
 * AbortError → بدون دانلود. سایر حالت‌ها → دانلود جایگزین با نتیجهٔ مشخص برای پیام درست.
 */
export async function shareOrDownload(file: File): Promise<ShareResult> {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  let can = false;
  try {
    can = !!nav && typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] });
  } catch {
    can = false;
  }
  if (!can) {
    downloadFile(file);
    return "unsupported";
  }
  try {
    await nav!.share({ files: [file], title: "BEHIX" });
    return "shared";
  } catch (err) {
    const name = err instanceof DOMException || err instanceof Error ? err.name : "";
    if (name === "AbortError") return "cancelled";
    downloadFile(file);
    return name === "NotAllowedError" ? "not-allowed" : "failed";
  }
}

export const SHARE_MESSAGES: Record<ShareResult, string> = {
  shared: "ویدیو برای اشتراک‌گذاری فرستاده شد.",
  cancelled: "اشتراک‌گذاری لغو شد.",
  "not-allowed":
    "مرورگر اجازهٔ اشتراک‌گذاری نداد (نیاز به یک لمس تازه یا مجوز دارد). ویدیو دانلود شد؛ می‌توانید دوباره روی «اشتراک‌گذاری» بزنید.",
  unsupported: "این مرورگر اشتراک‌گذاری فایل ویدیو را پشتیبانی نمی‌کند؛ ویدیو دانلود شد تا خودتان بفرستید.",
  failed: "اشتراک‌گذاری انجام نشد؛ ویدیو دانلود شد تا خودتان بفرستید.",
};

/** پیام پایان ساخت بر اساس پسوند واقعی و مسیر ساخت. */
export function exportMessage(ext: string, notice: string | null): string {
  const kind = ext === "mp4" ? "MP4" : ext === "webm" ? "WebM" : ext.toUpperCase();
  const base = `فایل ${kind} ساخته و دانلود شد.`;
  const hint = ext === "webm" ? " برخی برنامه‌ها (مثل اینستاگرام یا آیفون) WebM را نمی‌پذیرند." : "";
  return notice ? `${base}${hint} ${notice}` : base + hint;
}
