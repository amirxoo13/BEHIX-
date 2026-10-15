import { BatchExport } from "@/components/story/batch-export";
import { dialogueText } from "@/studio/stick/deliverables";
import { thumbnail } from "@/studio/stick/thumbnail";
import { ProjectPanel } from "@/components/story/project-panel";
import { TimelineEditor } from "@/components/story/timeline-editor";
import { CharacterLibrary } from "@/components/story/character-library";
import { useStoryWorkspace } from "@/studio/stick/use-workspace";
import { compileProject, setEdit, type StoryProject } from "@/studio/stick/project";
import { frameFor, FORMATS, type Format } from "@/studio/stick/layout";
import { actorAt } from "@/studio/stick/animate";
import { loadRenderFonts } from "@/studio/stick/fonts";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fa } from "@/studio/format";
import { makePaper } from "@/studio/stick/paper";
import { PLACES, PLACE_IDS } from "@/studio/stick/places";
import { cuesToSrt, type Directed } from "@/studio/stick/story-direct";
import { canExportMp4, exportStoryFilm, type StoryFilm } from "@/studio/stick/story-export";
import { FRAME, renderStory, cameraAt, sceneAt } from "@/studio/stick/story-render";

export const Route = createFileRoute("/story")({ component: StoryPage });

const KIND_FA = { baby: "نوزاد", man: "مرد", woman: "زن", boy: "پسربچه", girl: "دختربچه", oldMan: "پیرمرد", oldWoman: "پیرزن" } as const;

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const clock = (sec: number) => {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  return `${fa(m)}:${fa(Math.floor(s % 60)).padStart(2, "۰")}`;
};

function StoryPage() {
  const workspace = useStoryWorkspace("");
  const { project, commit } = workspace;
  const [selected, setSelected] = useState("");
  const text = project?.text ?? "";
  const setText = workspace.setText;
  const result=useMemo(()=>{
    if(!project)return {directed:null,error:null};
    try{return {directed:compileProject(project),error:null};}
    catch(error){return {directed:null,error:error instanceof Error?error.message:String(error)};}
  },[project]);
  const {directed,error}=result;
  const selectedId=directed?.beats.some(b=>b.id===selected)?selected:directed?.beats[0]?.id??"";

  return (
    <div className="studio" dir="rtl">
      <header className="studio-bar">
        <Link to="/" className="studio-brand" aria-label="خانه">
          <img src="/brand/app-icon.png" alt="" className="brand-mark" />
          <img src="/brand/wordmark.png" alt="BEHIX" className="brand-word" />
        </Link>
        <p className="studio-hint">صحنه، آدمک، دیالوگ. بوم وسط است؛ متن کنار آن؛ زمان پایین.</p>
        <div className="studio-actions">
          <button type="button" className="btn btn-ghost" disabled={!workspace.canUndo} onClick={workspace.undo}>برگردان</button>
          <button type="button" className="btn btn-ghost" disabled={!workspace.canRedo} onClick={workspace.redo}>از نو</button>
        </div>
      </header>
      <div className="studio-body">
        <aside className="studio-scenes" aria-label="صحنه‌ها">
          <p className="studio-kicker">صحنه‌ها</p>
          {directed ? (
            <ol>
              {directed.timeline.scenes.map((scene, index) => {
                const beat = directed.beats.find((item) => item.scene === index);
                const on = beat ? selectedId === beat.id || directed.beats.some((item) => item.id === selectedId && item.scene === index) : false;
                return (
                  <li key={`${index}-${scene.start}`}>
                    <button type="button" className={on ? "is-on" : ""} disabled={!beat} onClick={() => beat && setSelected(beat.id)}>
                      <b>{fa(index + 1)}</b>
                      <span>{PLACES[scene.place].label}</span>
                      <small>{scene.night ? "شب" : "روز"}</small>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="studio-empty">هنوز صحنه‌ای نیست.</p>
          )}
          {directed && directed.timeline.cast.length > 0 && (
            <ul className="studio-cast" aria-label="شخصیت‌ها">
              {directed.timeline.cast.map((c) => (
                <li key={c.id}>{c.name}<small>{KIND_FA[c.look.kind]}</small></li>
              ))}
            </ul>
          )}
        </aside>
        <section className="studio-screen" aria-label="پیش‌نمایش فیلم">
          {directed && project ? (
            <Player directed={directed} project={project} selected={selectedId} commit={commit} />
          ) : (
            <div className="story-canvas-box studio-blank">
              <p>بوم خالی است. در ستون متن، صحنه را بنویسید.</p>
            </div>
          )}
        </section>
        <aside className="studio-script" aria-labelledby="story-title">
          <h1 id="story-title">متن</h1>
          <ProjectPanel workspace={workspace} />
          <label className="lbl" htmlFor="story">داستان</label>
          <textarea
            id="story"
            className="field story-text"
            dir="rtl"
            value={text}
            maxLength={20000}
            disabled={!project}
            spellCheck={false}
            placeholder={"صحنه: پذیرایی خانه، شب\nسارا (زن): سلام."}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2">
            <button type="button" className="btn btn-ghost" onClick={() => setText("")}>پاک کردن متن</button>
          </div>
          {error && <p role="alert" className="story-warn mt-3">{error}</p>}
          {directed && directed.warnings.length > 0 && (
            <ul className="story-warn mt-3" aria-label="هشدارها">
              {directed.warnings.map((w, i) => <li key={`${i}-${w}`}>{w}</li>)}
            </ul>
          )}
          {project && directed && <CharacterLibrary project={project} cast={directed.timeline.cast} commit={commit} />}
          <Guide />
        </aside>
      </div>
      <footer className="studio-time">
        {project && directed && (
          <TimelineEditor project={project} directed={directed} selected={selectedId} onSelect={setSelected} commit={commit} unresolved={directed.unresolved} />
        )}
        {directed && <BatchExport projects={workspace.projects} />}
      </footer>
    </div>
  );
}

function Guide() {
  return (
    <details className="panel mt-3 text-sm leading-7">
      <summary className="cursor-pointer font-bold">راهنمای نوشتن</summary>
      <ul className="mt-2 grid gap-1 text-muted">
        <li>
          <b className="text-fg">مکان‌ها:</b> {PLACE_IDS.filter((p) => p !== "blank").map((p) => PLACES[p].label).join("، ")}
        </li>
        <li>
          <b className="text-fg">زمان:</b> شب، روز، صبح، عصر، غروب
        </li>
        <li>
          <b className="text-fg">معرفی:</b> «مریم (زن، سمت چپ، عینکی)»، «پدربزرگ (سمت راست)»، «پسر (بچه)»؛ سمت چپ و راست از دید بیننده است.
        </li>
        <li>
          <b className="text-fg">ظاهر:</b> عینکی، سبیل، ریش، کلاه، روسری، موی بلند، دم‌اسبی، فرفری، کچل
        </li>
        <li>
          <b className="text-fg">کارها:</b> می‌نشیند، بلند می‌شود، وارد می‌شود، بیرون می‌رود، به طرف ... می‌رود، دست به سینه، دست به کمر، دست تکان می‌دهد، اشاره می‌کند، فکر
          می‌کند، با تلفن صحبت می‌کند، شانه بالا می‌اندازد، هورا، می‌پرد، شوت می‌زند، رانندگی، می‌خورد، می‌نویسد
        </li>
        <li>
          <b className="text-fg">در دست:</b> گوشی، چای/قهوه، کتاب، کیف، توپ، دسته گل، شیرینی، کنترل، بشقاب، کیسهٔ خرید، چتر، لپ‌تاپ
        </li>
        <li>
          <b className="text-fg">حالت چهره:</b> لبخند، می‌خندد، ذوق، پوزخند، عصبانی، فریاد، قهر، ناراحت، گریه، تعجب، شوکه، نگران، می‌ترسد، آرام، چپ‌چپ، کلافه، خجالت،
          خواب‌آلود
        </li>
        <li>
          <b className="text-fg">راوی:</b> «راوی: ...» فقط زیرنویس می‌شود و کسی دهانش تکان نمی‌خورد.
        </li>
      </ul>
    </details>
  );
}

function Player({ directed,project,selected,commit }: { directed: Directed;project:StoryProject;selected:string;commit:(f:(p:StoryProject)=>StoryProject)=>void }) {
  const { timeline } = directed;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const format=project.settings.format;
  const frame=useMemo(()=>frameFor(format),[format]);
  const paper=useMemo(()=>typeof document==="undefined"?null:makePaper(frame.w,frame.h,7),[frame]);
  const scaleRef=useRef(0.65);
  const costs=useRef<number[]>([]);
  const drag=useRef<{actor:string;start:number;moved:boolean;x:number}|null>(null);
  const dragged=useRef(false);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const captions=project.settings.captions;
  const setCaptions=(value:boolean)=>commit(p=>({...p,settings:{...p.settings,captions:value}}));
  const [fontReady, setFontReady] = useState(false);
  const tRef = useRef(0);
  const duration = timeline.duration;

  useEffect(() => {
    let alive = true;
    loadRenderFonts()
      .catch(() => undefined)
      .then(() => alive && setFontReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const draw = useCallback(
    (time: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !paper) return;
      const canvas=canvasRef.current!;
      const scale=scaleRef.current;
      if(canvas.width!==Math.round(frame.w*scale)||canvas.height!==Math.round(frame.h*scale)){canvas.width=Math.round(frame.w*scale);canvas.height=Math.round(frame.h*scale);}
      ctx.setTransform(scale,0,0,scale,0,0);
      const start=performance.now();
      renderStory(ctx, timeline, Math.min(time, Math.max(0, duration - 0.001)), paper, { captions,format,positions:drag.current?{[drag.current.actor]:drag.current.x}:undefined });
      costs.current.push(performance.now()-start);
      if(costs.current.length===120){
        const p95=[...costs.current].sort((a,b)=>a-b)[113];
        if(p95>16.7)scaleRef.current=Math.max(0.3,scaleRef.current-0.1);
        canvas.dataset.renderP95=p95.toFixed(2);costs.current=[];
      }
    },
    [timeline, paper, captions, duration,format,frame],
  );

  // داستان عوض شد: اگر زمان فعلی از فیلم بیرون است برگرد اول
  useEffect(() => {
    if (tRef.current > duration) {
      tRef.current = 0;
      setT(0);
    }
    draw(tRef.current);
  }, [draw, duration, fontReady]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const start = performance.now() - tRef.current * 1000;
    let lastUi=0;
    const tick = (now: number) => {
      const time = (now - start) / 1000;
      if (time >= duration) {
        tRef.current = duration;
        setT(duration);
        draw(duration);
        setPlaying(false);
        return;
      }
      tRef.current = time;
      draw(time);
      if(now-lastUi>=100){setT(time);lastUi=now;}
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, draw, duration]);

  useEffect(()=>{
    const beat=directed.beats.find(b=>b.id===selected);
    if(beat){setPlaying(false);tRef.current=(beat.from+beat.to)/2;setT(tRef.current);draw(tRef.current);}
  },[selected,directed.beats,draw]);
  const pointerX=(event:React.PointerEvent<HTMLCanvasElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    const screen=(event.clientX-rect.left)/rect.width*frame.w;
    const scene=sceneAt(timeline,tRef.current),cam=cameraAt(scene.cameras,tRef.current-scene.start);
    const cx=cam.cx*frame.w/FRAME.w;
    return Math.max(0.08,Math.min(0.92,((screen-cx)/cam.zoom+cx)/frame.w));
  };
  const toggle = () => {
    if(dragged.current){dragged.current=false;return;}
    if (!playing && tRef.current >= duration - 0.05) {
      tRef.current = 0;
      setT(0);
    }
    setPlaying((p) => !p);
  };

  return (
    <div className="grid gap-3">
      <div className="story-canvas-box">
        <canvas ref={canvasRef} width={Math.round(frame.w*0.65)} height={Math.round(frame.h*0.65)} data-render-ready={fontReady} className="story-canvas" style={{aspectRatio:`${frame.w} / ${frame.h}`,objectFit:"contain"}} aria-label="فیلم" onClick={toggle}
          onPointerDown={e=>{
            if(!selected)return;
            const scene=sceneAt(timeline,tRef.current),x=pointerX(e);
            const nearest=scene.actors.map(a=>({a,x:actorAt(a.track,tRef.current-scene.start,null).x})).sort((a,b)=>Math.abs(a.x-x)-Math.abs(b.x-x))[0];
            if(!nearest||Math.abs(nearest.x-x)>0.15)return;
            setPlaying(false);drag.current={actor:nearest.a.cast,start:e.clientX,moved:false,x:nearest.x};e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={e=>{if(drag.current){drag.current.x=pointerX(e);drag.current.moved ||= Math.abs(e.clientX-drag.current.start)>4;draw(tRef.current);}}}
          onPointerUp={e=>{const d=drag.current;drag.current=null;if(d?.moved){dragged.current=true;commit(p=>setEdit(p,selected,{actor:d.actor,x:d.x}));}if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}
          onPointerCancel={()=>{drag.current=null;draw(tRef.current);}}
        />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary min-w-24" onClick={toggle}>
          {playing ? "توقف" : "پخش"}
        </button>
        <input
          type="range"
          className="story-range"
          min={0}
          max={duration}
          step={0.01}
          value={t}
          aria-label="زمان فیلم"
          onChange={(e) => {
            const v = Number(e.target.value);
            setPlaying(false);
            tRef.current = v;
            setT(v);
            draw(v);
          }}
        />
        <span className="latin text-sm tabular-nums text-muted" dir="ltr">
          {clock(t)} / {clock(duration)}
        </span>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} />
        نمایش زیرنویس روی تصویر
      </label>
      <label>قاب خروجی<select className="field" value={format} onChange={e=>commit(p=>({...p,settings:{...p.settings,format:e.target.value as Format}}))}>{Object.entries(FORMATS).map(([id,f])=><option key={id} value={id}>{f.label}</option>)}</select></label>
      <Exporter directed={directed} captions={captions} project={project} commit={commit} />
    </div>
  );
}

function Exporter({ directed, captions,project,commit }: { directed: Directed; captions: boolean;project:StoryProject;commit:(f:(p:StoryProject)=>StoryProject)=>void }) {
  const {fps,format}=project.settings;
  const setFps=(fps:30|60)=>commit(p=>({...p,settings:{...p.settings,fps}}));
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [film, setFilm] = useState<StoryFilm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fast, setFast] = useState<boolean | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    void canExportMp4(fps,format).then((ok) => alive && setFast(ok));
    return () => {
      alive = false;
    };
  }, [fps,format]);

  // داستان یا تنظیم عوض شد ← فیلم قبلی دیگر مال این داستان نیست
  useEffect(() => {
    setFilm(null);
    abort.current?.abort();
  }, [directed, captions, fps,format]);
  useEffect(()=>()=>abort.current?.abort(),[]);

  const run = async () => {
    setBusy(true);
    setMessage(null);
    setFilm(null);
    setProgress(0);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const result = await exportStoryFilm(directed.timeline, { fps, captions, format, onProgress: setProgress, signal: ctrl.signal });
      setFilm(result);
      setMessage(result.notice);
    } catch (err) {
      setMessage(err instanceof DOMException && err.name === "AbortError" ? "ساخت فیلم لغو شد." : err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  const srt = () => download(new Blob(["\uFEFF", cuesToSrt(directed.cues)], { type: "application/x-subrip;charset=utf-8" }), "behix-dialogue.srt");

  return (
    <div className="panel grid gap-3">
      <p className="font-bold">خروجی</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">نرمی حرکت:</span>
        {([30, 60] as const).map((f) => (
          <button key={f} type="button" className={`btn ${fps === f ? "btn-on" : "btn-ghost"}`} aria-pressed={fps === f} disabled={busy} onClick={() => setFps(f)}>
            {fa(f)} فریم
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {busy ? (
          <button type="button" className="btn btn-danger" onClick={() => abort.current?.abort()}>
            لغو ({fa(Math.round(progress * 100))}٪)
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={run} disabled={directed.timeline.duration <= 0}>
            ساخت فیلم بی‌صدا ({FORMATS[format].label})
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={srt} disabled={directed.cues.length === 0}>
          زیرنویس برای صداپیشه (SRT)
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-ghost" disabled={!directed.cues.length} onClick={()=>download(new Blob(["\uFEFF",dialogueText(directed.cues,project.title)],{type:"text/plain;charset=utf-8"}),`${project.title}.txt`)}>متن کامل صداپیشه</button>
        <button className="btn btn-ghost" onClick={()=>{void thumbnail(directed,format).then(blob=>download(blob,`${project.title}.png`)).catch(err=>setMessage(String(err)));}}>تصویر کوچک</button>
      </div>
      {busy && (
        <div className="story-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      {fast === false && !busy && <p className="text-sm text-muted">این مرورگر رمزگذار سریع ندارد؛ فیلم زنده و به اندازهٔ طولش ضبط می‌شود.</p>}
      {film && (
        <button type="button" className="btn btn-on" onClick={() => download(film.blob, `behix-story.${film.ext}`)}>
          دانلود فیلم ({film.ext.toUpperCase()}، {fa(Number((film.blob.size / 1e6).toFixed(1)))} مگابایت)
        </button>
      )}
      {message && <p className="text-sm text-muted">{message}</p>}
      <p className="text-sm leading-6 text-muted">
        زیرنویس SRT زمان دقیق هر دیالوگ، اسم گوینده و حالتش را دارد تا صداپیشه روی همان زمان‌ها صدا بگذارد. در CapCut یا Premiere فیلم و صدا را روی هم بگذارید.
      </p>
    </div>
  );
}
