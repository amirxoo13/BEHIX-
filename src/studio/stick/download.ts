/**
 * ذخیرهٔ فایل خروجی (فیلم، SRT، متن، تصویر).
 * - در مرورگر: دانلود معمولی با لینک.
 * - در اپ اندروید (Capacitor): WebView لینک دانلود blob را پشتیبانی نمی‌کند؛ پس فایل در حافظهٔ اپ
 *   نوشته می‌شود و پنجرهٔ «اشتراک‌گذاری» اندروید باز می‌شود (ذخیره در فایل‌ها، تلگرام، گالری و ...).
 * پلاگین‌ها فقط در اپ و فقط موقع نیاز بارگذاری می‌شوند تا به سایت حجمی اضافه نشود.
 */
import { Capacitor } from "@capacitor/core";

export function downloadBlob(blob: Blob, name: string): void {
  if (Capacitor.isNativePlatform()) {
    void shareNative(blob, name).catch((error) => {
      // پیام قابل فهم برای کاربر؛ لغو پنجرهٔ اشتراک خطا حساب نمی‌شود
      if (String(error).toLowerCase().includes("cancel")) return;
      alertSafe(`ذخیرهٔ فایل ممکن نشد: ${error instanceof Error ? error.message : String(error)}`);
    });
    return;
  }
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/** نام فایل امن برای سیستم فایل اندروید. */
export function safeFileName(name: string): string {
  const cleaned = [...name]
    .map((ch) => (ch.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(ch) ? "_" : ch))
    .join("")
    .trim();
  return cleaned || "behix-file";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("خواندن فایل ممکن نشد."));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

async function shareNative(blob: Blob, name: string): Promise<void> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
  const path = `exports/${safeFileName(name)}`;
  const written = await Filesystem.writeFile({
    path,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  });
  await Share.share({ title: name, files: [written.uri], dialogTitle: "ذخیره یا ارسال فایل" });
}

function alertSafe(message: string) {
  try {
    window.alert(message);
  } catch {
    console.error(message);
  }
}
