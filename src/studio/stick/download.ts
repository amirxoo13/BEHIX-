import { Capacitor, registerPlugin } from "@capacitor/core";

/** Native plugin in android/app (MediaSavePlugin.java): copies a cache file into MediaStore Movies/BEHIX. */
type BehixMediaPlugin = { saveVideo(options: { path: string; name: string; mime: string }): Promise<{ uri: string }> };
const BehixMedia = registerPlugin<BehixMediaPlugin>("BehixMedia");
/** Export folders older than this are removed before a new save (the share target has long read them). */
const NATIVE_EXPORT_TTL_MS = 60 * 60 * 1000;

/**
 * ذخیرهٔ فایل خروجی (فیلم، SRT، متن، تصویر).
 * - در مرورگر: دانلود معمولی با لینک.
 * - در اپ اندروید (Capacitor): WebView لینک دانلود blob را پشتیبانی نمی‌کند؛ پس فایل تکه‌تکه در حافظهٔ اپ
 *   نوشته می‌شود (فقط یک تکهٔ ۳ مگابایتی هم‌زمان در حافظه)، فیلم‌ها در گالری (Movies/BEHIX، اندروید ۱۰ به بعد)
 *   ذخیره می‌شوند و پنجرهٔ «اشتراک‌گذاری» اندروید باز می‌شود.
 * پلاگین‌ها فقط در اپ و فقط موقع نیاز بارگذاری می‌شوند تا به سایت حجمی اضافه نشود.
 */
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

/** Read a blob as base64 without the data URL prefix, rejecting on file read errors. */
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

/** Remove old `Cache/exports/<id>/` folders so exported films do not pile up on the phone. Never throws. */
async function cleanNativeExports(fs: typeof import("@capacitor/filesystem")): Promise<void> {
  try {
    const { files } = await fs.Filesystem.readdir({ path: "exports", directory: fs.Directory.Cache });
    const now = Date.now();
    for (const entry of files) {
      if (now - (entry.mtime ?? 0) < NATIVE_EXPORT_TTL_MS) continue;
      await fs.Filesystem.rmdir({ path: `exports/${entry.name}`, directory: fs.Directory.Cache, recursive: true }).catch(() => undefined);
    }
  } catch {
    /* no exports folder yet */
  }
}

const isVideo = (blob: Blob, name: string) => blob.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(name);

/**
 * Stream the blob (usually a disk-backed OPFS File) into a unique cache file 3 MB at a time, save videos to the
 * gallery, then open the native share dialog. Only one chunk's base64 exists at any time.
 */
async function shareNative(blob: Blob, name: string): Promise<void> {
  const [fs, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
  const { Filesystem, Directory } = fs;
  await cleanNativeExports(fs);
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
  let inGallery = false;
  if (isVideo(blob, name)) {
    try {
      await BehixMedia.saveVideo({ path, name: safeFileName(name), mime: blob.type || "video/mp4" });
      inGallery = true;
    } catch {
      /* Android 9 or older, or plugin missing: the share sheet still lets the user save it */
    }
  }
  await Share.share({
    title: name,
    files: [uri],
    dialogTitle: inGallery ? "فیلم در گالری ذخیره شد (Movies/BEHIX)؛ ارسال به برنامهٔ دیگر" : "ذخیره یا ارسال فایل",
  });
}

/** Show a download error in an alert, falling back to the console if alerts throw. */
function alertSafe(message: string) {
  try {
    window.alert(message);
  } catch {
    console.error(message);
  }
}
