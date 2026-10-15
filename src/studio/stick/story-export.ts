/**
 * خروجی فیلم بی‌صدا از داستان (صداگذاری را بعداً یک انسان انجام می‌دهد).
 * راه اصلی: WebCodecs + mediabunny ← MP4 (H.264)، فریم‌به‌فریم و دقیق (سریع‌تر از زمان واقعی).
 * راه جایگزین برای مرورگرهای بدون WebCodecs: ضبط زندهٔ بوم با MediaRecorder.
 */
import { bitrate, canExportMp4, encodeMp4, type FilmOptions } from "./encode.ts";
import { loadRenderFonts } from "./fonts.ts";
import { frameFor } from "./layout.ts";
import { makePaper } from "./paper.ts";
import { renderStory, type Timeline } from "./story-render.ts";
import type { RenderCanvas } from "./figure-base.ts";
import type { WorkerReply, WorkerRequest } from "./story-export.worker.ts";
export { canExportMp4 };
export type StoryFilm = { blob: Blob; ext: "mp4" | "webm"; notice: string | null };
export type ExportOptions = FilmOptions & { worker?: boolean };
let requestId = 0;
class WorkerUnavailable extends Error {}
function workerFilm(timeline:Timeline,opts:ExportOptions):Promise<ArrayBuffer> {
  return new Promise((resolve,reject)=>{
    const id=++requestId;
    let worker:Worker;
    try { worker=new Worker(new URL("./story-export.worker.ts",import.meta.url),{type:"module"}); }
    catch { reject(new WorkerUnavailable());return; }
    const clean=()=>{worker.terminate();opts.signal?.removeEventListener("abort",cancel);};
    const cancel=()=>{worker.postMessage({id,type:"cancel"} satisfies WorkerRequest);clean();reject(new DOMException("لغو شد","AbortError"));};
    opts.signal?.addEventListener("abort",cancel,{once:true});
    if(opts.signal?.aborted){cancel();return;}
    worker.onerror=()=>{clean();reject(new WorkerUnavailable());};
    worker.onmessage=({data}:MessageEvent<WorkerReply>)=>{
      if(data.id!==id)return;
      if(data.type==="progress")opts.onProgress?.(data.progress);
      else {clean();if(data.type==="result")resolve(data.buffer);else reject(data.unsupported?new WorkerUnavailable():new Error(data.message));}
    };
    worker.postMessage({id,type:"start",timeline,options:{fps:opts.fps,captions:opts.captions,format:opts.format}} satisfies WorkerRequest);
  });
}
export async function exportStoryFilm(tl:Timeline,opts:ExportOptions):Promise<StoryFilm> {
  opts.signal?.throwIfAborted();
  if(opts.worker!==false && typeof Worker!=="undefined" && typeof OffscreenCanvas!=="undefined"){
    try {return {blob:new Blob([await workerFilm(tl,opts)],{type:"video/mp4"}),ext:"mp4",notice:null};}
    catch(error){if(!(error instanceof WorkerUnavailable))throw error;}
  }
  await loadRenderFonts();
  opts.signal?.throwIfAborted();
  if(await canExportMp4(opts.fps,opts.format))return {blob:new Blob([await encodeMp4(tl,opts)],{type:"video/mp4"}),ext:"mp4",notice:null};
  const {w,h}=frameFor(opts.format);
  const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw new Error("ساخت بوم تصویر ممکن نشد.");
  const paper=makePaper(w,h,7);
  try{return await recordLive(tl,canvas,ctx,paper,opts);}
  finally{canvas.width=1;canvas.height=1;paper.width=1;paper.height=1;}
}

/** ضبط زنده (به اندازهٔ طول فیلم طول می‌کشد). */
export async function recordLive(tl: Timeline,canvas:HTMLCanvasElement,ctx:CanvasRenderingContext2D,paper:RenderCanvas,opts:ExportOptions):Promise<StoryFilm> {
  opts.signal?.throwIfAborted();
  if(typeof canvas.captureStream!=="function" || typeof MediaRecorder==="undefined")throw new Error("ضبط بوم در این مرورگر پشتیبانی نمی‌شود؛ JSON، زیرنویس و تصویر را دریافت کنید.");
  const types=["video/mp4;codecs=avc1","video/mp4","video/webm;codecs=vp9","video/webm;codecs=vp8","video/webm"];
  const mime=types.find(m=>MediaRecorder.isTypeSupported(m));
  const stream=canvas.captureStream(opts.fps);
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
        renderStory(ctx,tl,0,paper,opts);rec.start(500);
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
    return {blob:new Blob(chunks,{type}),ext:type.startsWith("video/mp4")?"mp4":"webm",notice:"ضبط زنده است؛ افت فریم و تفاوت جزئی زمان‌بندی ممکن است. برای خروجی فریم‌دقیق از مرورگر دارای WebCodecs استفاده کنید."};
  }finally{
    clearTimeout(stopTimer);cancelAnimationFrame(raf);
    opts.signal?.removeEventListener("abort",cancel);document.removeEventListener("visibilitychange",visibility);
    if(recorder){recorder.ondataavailable=null;recorder.onerror=null;recorder.onstop=null;if(recorder.state!=="inactive")recorder.stop();}
    stream.getTracks().forEach(track=>track.stop());
  }
}
