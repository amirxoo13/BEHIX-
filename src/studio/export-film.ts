import { openRecordBus, pickVideoMime, setRecordDest, stopAll, resumeAudio } from "./audio";
import { finishPlayback, resetArmed, setPlayDone, useStudio } from "./store";

export async function exportFilm(canvas: HTMLCanvasElement) {
  const store = useStudio.getState();
  if (store.playing) finishPlayback();
  await resumeAudio();
  if (typeof canvas.captureStream !== "function") {
    throw new Error("این مرورگر ضبط تصویر صحنه را پشتیبانی نمی‌کند.");
  }
  const mime = pickVideoMime();
  const dest = openRecordBus();
  let blob: Blob;
  try {
    const canvasStream = canvas.captureStream(30);
    const mixed = new MediaStream([...canvasStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(mixed, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    const stopped = new Promise<Blob>((resolve) => {
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => resolve(new Blob(chunks, { type: mime || "video/webm" }));
    });
    rec.start();
    resetArmed();
    useStudio.getState().setExporting(true);
    useStudio.getState().setPlaying(true, performance.now());
    await new Promise<void>((resolve) => setPlayDone(resolve));
    await new Promise((r) => setTimeout(r, 200));
    if (rec.state !== "inactive") rec.stop();
    stopAll();
    blob = await stopped;
  } finally {
    // BUG-04: باس ضبط در هر حالت بسته شود؛ وضعیت exporting هم در خطا ریست شود.
    setRecordDest(null);
    useStudio.getState().setExporting(false);
  }
  const ext = mime.includes("mp4") ? "mp4" : "webm";
  const a = document.createElement("a");
  const href = URL.createObjectURL(blob);
  a.href = href;
  a.download = `behix-${Date.now()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // BUG-03: آزاد کردن حافظه پس از شروع دانلود.
  setTimeout(() => URL.revokeObjectURL(href), 60_000);
  return ext;
}