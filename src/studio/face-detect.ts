/**
 * پیدا کردن خودکار دهان و چشم‌ها روی عکس سر، با MediaPipe Face Landmarker (Apache-2.0).
 * مدل و موتور wasm از خود سایت بارگذاری می‌شوند (public/mediapipe)، نه از سرور گوگل،
 * و فقط وقتی کسی عکس سر آپلود کند (بارگذاری تنبل).
 * روی چهره‌های خیلی کارتونی ممکن است صورتی پیدا نشود؛ آن‌وقت null برمی‌گردد و کاربر با کلیک مشخص می‌کند.
 */
import { faceFromLandmarks, type Pt } from "./head-image.ts";

type Detector = { detect(image: HTMLCanvasElement): { faceLandmarks: { x: number; y: number }[][] } };

let loading: Promise<Detector> | null = null;

function detector(): Promise<Detector> {
  loading ??= (async () => {
    const { FaceLandmarker } = await import("@mediapipe/tasks-vision");
    return FaceLandmarker.createFromOptions(
      { wasmLoaderPath: "/mediapipe/vision_wasm_internal.js", wasmBinaryPath: "/mediapipe/vision_wasm_internal.wasm" },
      {
        baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate: "CPU" },
        runningMode: "IMAGE",
        numFaces: 1,
        minFaceDetectionConfidence: 0.3,
        minFacePresenceConfidence: 0.3,
      },
    ) as Promise<Detector>;
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

/**
 * `src` تصویر سر (شفاف). دور تصویر حاشیهٔ خاکستری روشن اضافه می‌شود چون مدل روی صورتی که
 * تا لبهٔ تصویر بریده شده ضعیف‌تر است؛ مختصات بعد به خود تصویر سر برگردانده می‌شود.
 */
export async function detectFace(src: string): Promise<{ mouth: Pt; eyes: { l: Pt; r: Pt } } | null> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const pad = Math.round(Math.max(img.width, img.height) * 0.3);
  const c = document.createElement("canvas");
  c.width = img.width + pad * 2;
  c.height = img.height + pad * 2;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#d9dde3";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, pad, pad);
  // اگر بارگذاری موتور گیر کرد (شبکهٔ کند یا مرورگر قدیمی)، بعد از ۳۰ ثانیه به حالت دستی برمی‌گردیم.
  const det = await Promise.race([
    detector(),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 30_000)),
  ]);
  const res = det.detect(c);
  const pts = res.faceLandmarks[0];
  if (!pts) return null;
  return faceFromLandmarks(pts, {
    x: pad / c.width,
    y: pad / c.height,
    w: img.width / c.width,
    h: img.height / c.height,
  });
}
