/**
 * خروجی فیلم داستان (با صدای دیالوگ‌ها اگر صداگذاری شده باشد).
 * راه اصلی: WebCodecs + mediabunny ← MP4 (H.264 + AAC) در Worker، فریم‌به‌فریم و دقیق، با نوشتن مستقیم روی OPFS.
 * راه جایگزین برای مرورگرهای بدون WebCodecs: ضبط زندهٔ بوم با MediaRecorder.
 */
import { bitrate, canExportMp4, encodeMp4, type AudioCodecChoice, type EncodedFilm, type FilmOptions } from "./encode.ts";
import { loadRenderFonts } from "./fonts.ts";
import { frameFor } from "./layout.ts";
import { makePaper } from "./paper.ts";
import { renderStory, type Timeline } from "./story-render.ts";
import type { RenderCanvas } from "./figure-base.ts";
import type { WorkerReply, WorkerRequest } from "./story-export.worker.ts";
import { readExport } from "./opfs-export.ts";
export { canExportMp4 };
/** audioCodec: codec written into the file ("recorded" = whatever MediaRecorder chose); null = silent film. */
export type StoryFilm = { blob: Blob; ext: "mp4" | "webm"; notice: string | null; audioCodec: AudioCodecChoice | "recorded" };
/** Persian warning when the requested soundtrack is missing or not AAC. */
export function audioNotice(wanted: boolean, codec: AudioCodecChoice): string | null {
  if (!wanted) return null;
  if (codec === "opus") return "این مرورگر رمزگذار AAC ندارد و صدای فیلم با Opus ذخیره شد؛ بعضی برنامه‌ها (مثل اینستاگرام یا آیفون) ممکن است صدای آن را پخش نکنند.";
  if (codec === null) return "این مرورگر رمزگذار صدا ندارد؛ فیلم بی‌صدا ساخته شد. صدا را جداگانه روی فیلم بگذارید.";
  return null;
}
async function toFilm({ buffer, file, audioCodec }: EncodedFilm, wanted: boolean): Promise<StoryFilm> {
  const blob = file ? await readExport(file) : new Blob([buffer!], { type: "video/mp4" });
  return { blob, ext: "mp4", notice: audioNotice(wanted, audioCodec), audioCodec };
}
export type ExportOptions = FilmOptions & { worker?: boolean };
let requestId = 0;
class WorkerUnavailable extends Error {}
type Audio = NonNullable<FilmOptions["audio"]>;
/**
 * Render in a module worker. The worker announces "ready" first, so the soundtrack is transferred only to a
 * worker that actually loaded; `onAudioBack` receives it again when the worker reports "unsupported".
 */
function workerFilm(timeline: Timeline, opts: ExportOptions, onAudioBack: (a: Audio) => void): Promise<EncodedFilm> {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    let worker: Worker;
    try {
      worker = new Worker(new URL("./story-export.worker.ts", import.meta.url), { type: "module" });
    } catch {
      reject(new WorkerUnavailable());
      return;
    }
    let started = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const detach = () => opts.signal?.removeEventListener("abort", cancel);
    const clean = () => {
      detach();
      clearTimeout(killTimer);
      worker.terminate();
    };
    const cancel = () => {
      detach();
      reject(new DOMException("لغو شد", "AbortError"));
      if (!started) {
        clean();
        return;
      }
      // Let the worker close its OPFS handle and delete the partial file, then stop it anyway.
      worker.postMessage({ id, type: "cancel" } satisfies WorkerRequest);
      killTimer = setTimeout(clean, 3000);
    };
    opts.signal?.addEventListener("abort", cancel, { once: true });
    if (opts.signal?.aborted) {
      cancel();
      return;
    }
    worker.onerror = () => {
      clean();
      reject(started ? new Error("ساخت فیلم در پس‌زمینه متوقف شد؛ شاید حافظهٔ دستگاه کم است. قاب یا نرمی کمتری را امتحان کنید.") : new WorkerUnavailable());
    };
    worker.onmessage = ({ data }: MessageEvent<WorkerReply>) => {
      if (data.type === "ready") {
        if (started || opts.signal?.aborted) return;
        started = true;
        const audio = opts.audio?.data.length ? opts.audio : undefined;
        worker.postMessage(
          { id, type: "start", timeline, options: { fps: opts.fps, captions: opts.captions, format: opts.format, audio } } satisfies WorkerRequest,
          audio ? [audio.data.buffer as ArrayBuffer] : [],
        );
        return;
      }
      if (data.id !== id) return;
      if (data.type === "progress") {
        opts.onProgress?.(data.progress);
        return;
      }
      clean();
      if (opts.signal?.aborted) return;
      if (data.type === "result") resolve({ buffer: data.buffer, file: data.file, audioCodec: data.audioCodec });
      else {
        if (data.audio && opts.audio) onAudioBack({ data: data.audio, sampleRate: opts.audio.sampleRate });
        reject(data.unsupported ? new WorkerUnavailable() : new Error(data.message));
      }
    };
  });
}
/**
 * Note: when the worker path runs, `opts.audio.data` is transferred to the worker (the caller's array becomes
 * empty); build a fresh mix for each export.
 */
export async function exportStoryFilm(tl: Timeline, opts: ExportOptions): Promise<StoryFilm> {
  opts.signal?.throwIfAborted();
  const wanted = !!opts.audio?.data.length;
  let audio = opts.audio;
  if (opts.worker !== false && typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
    try {
      return await toFilm(await workerFilm(tl, opts, (a) => (audio = a)), wanted);
    } catch (error) {
      if (!(error instanceof WorkerUnavailable)) throw error;
    }
  }
  const local = { ...opts, audio };
  await loadRenderFonts();
  opts.signal?.throwIfAborted();
  if (await canExportMp4(opts.fps, opts.format)) return toFilm(await encodeMp4(tl, local), wanted);
  const { w, h } = frameFor(opts.format);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ساخت بوم تصویر ممکن نشد.");
  const paper = makePaper(w, h, 7);
  try {
    return await recordLive(tl, canvas, ctx, paper, local);
  } finally {
    canvas.width = 1;
    canvas.height = 1;
    paper.width = 1;
    paper.height = 1;
  }
}

/** ضبط زنده (به اندازهٔ طول فیلم طول می‌کشد). */
export async function recordLive(tl: Timeline,canvas:HTMLCanvasElement,ctx:CanvasRenderingContext2D,paper:RenderCanvas,opts:ExportOptions):Promise<StoryFilm> {
  opts.signal?.throwIfAborted();
  if(typeof canvas.captureStream!=="function" || typeof MediaRecorder==="undefined")throw new Error("ضبط بوم در این مرورگر پشتیبانی نمی‌شود؛ JSON، زیرنویس و تصویر را دریافت کنید.");
  const types=["video/mp4;codecs=avc1","video/mp4","video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"];
  const mime=types.find(m=>MediaRecorder.isTypeSupported(m));
  const stream=canvas.captureStream(opts.fps);
  // صدای دیالوگ‌ها هم‌زمان با تصویر در ضبط زنده
  let audioCtx:AudioContext|null=null,audioSrc:AudioBufferSourceNode|null=null;
  if(opts.audio?.data.length && typeof AudioContext!=="undefined"){
    audioCtx=new AudioContext({sampleRate:opts.audio.sampleRate});
    const buffer=audioCtx.createBuffer(1,opts.audio.data.length,opts.audio.sampleRate);
    buffer.copyToChannel(opts.audio.data as Float32Array<ArrayBuffer>,0);
    const dest=audioCtx.createMediaStreamDestination();
    audioSrc=audioCtx.createBufferSource();audioSrc.buffer=buffer;audioSrc.connect(dest);
    dest.stream.getAudioTracks().forEach(track=>stream.addTrack(track));
  }
  let recorder:MediaRecorder|undefined;
  let raf=0;
  let cancel=()=>{};
  let visibility=()=>{};
  let stopTimer:ReturnType<typeof setTimeout>|undefined;
  try {
    const rec=new MediaRecorder(stream,mime?{mimeType:mime,videoBitsPerSecond:bitrate(opts.fps)}:undefined);
    recorder=rec;
    const chunks:Blob[]=[];
    await new Promise<void>((resolve,reject)=>{
      let finishing=false;
      const fail=(error:unknown)=>{cancelAnimationFrame(raf);reject(error);};
      cancel=()=>fail(new DOMException("لغو شد","AbortError"));
      visibility=()=>{if(document.hidden)fail(new Error("ضبط زنده با پنهان شدن صفحه متوقف شد؛ صفحه را باز نگه دارید و دوباره خروجی بگیرید."));};
      opts.signal?.addEventListener("abort",cancel,{once:true});
      document.addEventListener("visibilitychange",visibility);
      rec.onerror=()=>fail(new Error("ضبط ویدیو با خطای مرورگر متوقف شد."));
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      rec.onstop=()=>{if(finishing)resolve();else fail(new Error("ضبط پیش از پایان فیلم متوقف شد."));};
      try{
        visibility();
        if(document.hidden)return;
        renderStory(ctx,tl,0,paper,opts);rec.start(500);audioSrc?.start();
        let start:number|undefined;
        const tick=()=>{
          try{
            opts.signal?.throwIfAborted();
            start ??= performance.now();
            const t=Math.min((performance.now()-start)/1000,tl.duration);
            renderStory(ctx,tl,Math.min(t,Math.max(0,tl.duration-0.001)),paper,opts);
            opts.onProgress?.(Math.min(1,t/tl.duration));
            if(t>=tl.duration){finishing=true;stopTimer=setTimeout(()=>fail(new Error("مرورگر پایان ضبط را تأیید نکرد.")),5000);rec.stop();}
            else raf=requestAnimationFrame(tick);
          }catch(error){fail(error);}
        };
        raf=requestAnimationFrame(tick);
      }catch(error){fail(error);}
    });
    const type=rec.mimeType || chunks[0]?.type;
    if(!type || !chunks.length)throw new Error("مرورگر فایل ویدیویی تولید نکرد.");
    return {blob:new Blob(chunks,{type}),ext:type.startsWith("video/mp4")?"mp4":"webm",audioCodec:audioSrc?"recorded":null,notice:"ضبط زنده است؛ افت فریم و تفاوت جزئی زمان‌بندی ممکن است. برای خروجی فریم‌دقیق از مرورگر دارای WebCodecs استفاده کنید."};
  }finally{
    clearTimeout(stopTimer);cancelAnimationFrame(raf);
    opts.signal?.removeEventListener("abort",cancel);document.removeEventListener("visibilitychange",visibility);
    if(recorder){recorder.ondataavailable=null;recorder.onerror=null;recorder.onstop=null;if(recorder.state!=="inactive")recorder.stop();}
    stream.getTracks().forEach(track=>track.stop());
    try{audioSrc?.stop();}catch{/* هنوز شروع نشده */}
    void audioCtx?.close();
  }
}
