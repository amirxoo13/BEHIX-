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
  // هر خروجی پوشهٔ جدای خودش را دارد تا خروجی بعدی با همان اسم، فایلِ در حال اشتراکِ قبلی را عوض نکند
  const id = `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  const path = `exports/${id}/${safeFileName(name)}`;
  // فیلم می‌تواند ده‌ها مگابایت باشد؛ یک‌جا فرستادنش از پل Capacitor حافظهٔ گوشی‌های ضعیف را پر می‌کند.
  // پس تکه‌تکه نوشته می‌شود. اندازهٔ تکه مضرب ۳ بایت است تا base64 هر تکه جدا هم درست باشد.
  const CHUNK = 3 * 1024 * 1024;
  let uri = "";
  for (let start = 0; start === 0 || start < blob.size; start += CHUNK) {
    const data = await blobToBase64(blob.slice(start, start + CHUNK));
    if (start === 0) {
      uri = (await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true })).uri;
    } else {
      await Filesystem.appendFile({ path, data, directory: Directory.Cache });
    }
  }
  await Share.share({ title: name, files: [uri], dialogTitle: "ذخیره یا ارسال فایل" });
}

function alertSafe(message: string) {
  try {
    window.alert(message);
  } catch {
    console.error(message);
  }
}
