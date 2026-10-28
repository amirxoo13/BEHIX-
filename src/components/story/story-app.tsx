import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { BookOpen, Captions, Clapperboard, Download, MessageSquare, Pause, PenLine, Play, Plus, Redo2, SkipBack, SkipForward, SlidersHorizontal, Undo2, UserPlus, Users } from "lucide-react";
import { BeatInspector } from "@/components/story/beat-inspector";
import { CastPanel } from "@/components/story/cast-panel";
import { ExportDialog } from "@/components/story/export-dialog";
import { SceneBoard } from "@/components/story/scene-board";
import { TimelineStrip } from "@/components/story/timeline-strip";
import type { useStoryWorkspace } from "@/studio/stick/use-workspace";
import { compileProject, setEdit, type StoryProject } from "@/studio/stick/project";
import { frameFor, FORMATS, type Format } from "@/studio/stick/layout";
import { actorAt } from "@/studio/stick/animate";
import { loadRenderFonts } from "@/studio/stick/fonts";
import { makePaper } from "@/studio/stick/paper";
import { PLACES, PLACE_IDS } from "@/studio/stick/places";
import type { Directed } from "@/studio/stick/story-direct";
import { FRAME, renderStory, cameraAt, sceneAt } from "@/studio/stick/story-render";
import { fa } from "@/studio/format";

type Tab = "script" | "cast" | "scenes" | "guide" | "edit";
type PlayerHandle = { seek: (t: number) => void; toggle: () => void; time: () => number };

const clock = (sec: number) => {
  const s = Math.max(0, sec);
  return `${fa(Math.floor(s / 60))}:${fa(Math.floor(s % 60)).padStart(2, "۰")}`;
};
const typingTarget = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));

/**
 * ویرایشگر «داستان به فیلم»؛ مشترک بین سایت و اپ اندروید.
 * چیدمان استاندارد ویرایشگرهای انیمیشن (Animaker، Plotagon، Animation Desk):
 * نوار بالا (پروژه، برگرداندن، خروجی) · ستون متن/بازیگران/صحنه‌ها · صحنهٔ نمایش با کنترل پخش ·
 * پنل ویرایش بخش · خط زمان کلی در پایین. در موبایل صحنه بالا ثابت است و پنل‌ها با نوار پایین عوض می‌شوند.
 */
export function StoryApp({ brand, workspace, projectsLink }: {
  brand: (content: ReactNode) => ReactNode;
  workspace: ReturnType<typeof useStoryWorkspace>;
  projectsLink?: ReactNode;
}) {
  const { project, commit } = workspace;
  const [tab, setTab] = useState<Tab>("script");
  const [selected, setSelected] = useState("");
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [exporting, setExporting] = useState(false);
  const player = useRef<PlayerHandle>(null);
  const script = useRef<HTMLTextAreaElement>(null);
  const text = project?.text ?? "";

  const { directed, error } = useMemo(() => {
    if (!project) return { directed: null, error: null };
    try {
      return { directed: compileProject(project), error: null };
    } catch (err) {
      return { directed: null, error: err instanceof Error ? err.message : String(err) };
    }
  }, [project]);
  const beats = useMemo(() => directed?.beats ?? [], [directed]);
  const selectedId = beats.some((b) => b.id === selected) ? selected : (beats[0]?.id ?? "");

  // اولین قاب (t=0) محو ورود صحنه است و سفید دیده می‌شود؛ پیش‌نمایش از وسط اولین بخش شروع می‌شود
  const firstBeat = beats[0];
  useEffect(() => {
    if (firstBeat && (player.current?.time() ?? 0) === 0) player.current?.seek((firstBeat.from + firstBeat.to) / 2);
  }, [firstBeat?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = useCallback((id: string, at?: number) => {
    setSelected(id);
    const beat = directed?.beats.find((b) => b.id === id);
    if (beat) player.current?.seek(at ?? (beat.from + beat.to) / 2);
  }, [directed]);
  const step = useCallback((dir: 1 | -1) => {
    const i = beats.findIndex((b) => b.id === selectedId);
    const next = beats[Math.max(0, Math.min(beats.length - 1, i + dir))];
    if (next) pick(next.id);
  }, [beats, selectedId, pick]);

  // میان‌برهای صفحه‌کلید (مثل Animaker): فاصله = پخش، چپ/راست = بخش بعد/قبل، Ctrl+Z = برگرداندن
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingTarget(e.target) || e.altKey) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) workspace.redo();
        else workspace.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        workspace.redo();
      } else if (!mod && e.key === " " && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        player.current?.toggle();
      } else if (!mod && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !(e.target instanceof HTMLElement && e.target.closest(".etl-track"))) {
        e.preventDefault();
        step(e.key === "ArrowLeft" ? 1 : -1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [workspace, step]);

  /** درج یک خط تازه بعد از خطی که مکان‌نما در آن است و انتخاب بخش قابل‌تغییرش. */
  const insertLine = (line: string, select?: string) => {
    const el = script.current;
    const at = el ? el.selectionEnd : text.length;
    const end = text.indexOf("\n", at) === -1 ? text.length : text.indexOf("\n", at);
    const before = text.slice(0, end);
    const prefix = before && !before.endsWith("\n") ? "\n" : "";
    const next = `${before}${prefix}${line}${text.slice(end)}`;
    workspace.setText(next);
    setTab("script");
    const start = before.length + prefix.length;
    requestAnimationFrame(() => {
      const box = script.current;
      if (!box) return;
      box.focus();
      const i = select ? line.indexOf(select) : -1;
      if (i >= 0) box.setSelectionRange(start + i, start + i + select!.length);
      else box.setSelectionRange(start + line.length, start + line.length);
    });
  };
  const sceneCount = directed?.timeline.scenes.length ?? 0;
  const strip = directed && beats.length > 0 && (
    <TimelineStrip directed={directed} time={time} selected={selectedId} onSeek={(t, id) => { if (id) setSelected(id); player.current?.seek(t); }} />
  );
  const status = workspace.message || (workspace.saving ? "در حال ذخیره…" : "ذخیره شد");

  return (
    <div className="editor" dir="rtl" data-tab={tab}>
      <header className="editor-bar">
        <div className="editor-bar-start">
          {projectsLink}
          {brand(<img src="/brand/app-icon.png" alt="BEHIX" className="brand-mark" />)}
          <label className="title-field">
            <span className="sr-only">نام پروژه</span>
            <input
              className="title-input"
              aria-label="نام پروژه"
              value={project?.title ?? ""}
              maxLength={120}
              disabled={!project}
              onChange={(e) => commit((p) => ({ ...p, title: e.target.value || "داستان تازه" }), true)}
            />
          </label>
          <span className={workspace.message ? "save-state is-error" : "save-state"} role="status">{status}</span>
        </div>
        <div className="editor-bar-end studio-actions">
          <button type="button" className="icon-btn" disabled={!workspace.canUndo} onClick={workspace.undo} aria-label="برگردان" title="برگرداندن (Ctrl+Z)"><Undo2 size={18} aria-hidden /></button>
          <button type="button" className="icon-btn" disabled={!workspace.canRedo} onClick={workspace.redo} aria-label="از نو" title="از نو (Ctrl+Shift+Z)"><Redo2 size={18} aria-hidden /></button>
          <button type="button" className="btn btn-primary" disabled={!directed} onClick={() => setExporting(true)}><Download size={18} aria-hidden /> <span className="hide-sm">خروجی</span></button>
        </div>
      </header>

      <div className="editor-body">
        <aside className="editor-side" aria-label="متن و کتابخانه‌ها">
          <nav className="side-tabs" role="tablist" aria-label="پنل‌ها">
            {([["script", "متن", PenLine], ["cast", "بازیگران", Users], ["scenes", "صحنه‌ها", Clapperboard], ["guide", "راهنما", BookOpen]] as const).map(([id, label, Icon]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id || (id === "script" && tab === "edit")} className="side-tab" onClick={() => setTab(id)}>
                <Icon size={16} aria-hidden /> {label}
              </button>
            ))}
          </nav>

          <div className="pane pane-script">
            <div className="script-tools" aria-label="درج سریع">
              <InsertScene count={sceneCount} onInsert={(line) => insertLine(line)} />
              <button type="button" className="tool-btn" onClick={() => insertLine("نام (زن، سمت چپ) وارد می‌شود.", "نام")}><UserPlus size={15} aria-hidden /> شخصیت</button>
              <InsertLine cast={directed?.timeline.cast ?? []} onInsert={insertLine} />
              <button type="button" className="tool-btn" onClick={() => insertLine("راوی: ")}><Captions size={15} aria-hidden /> راوی</button>
              <button type="button" className="tool-btn only-mobile" onClick={() => setTab("guide")}><BookOpen size={15} aria-hidden /> راهنما</button>
            </div>
            <label className="sr-only" htmlFor="story">داستان</label>
            <textarea
              id="story"
              ref={script}
              className="script-text"
              dir="rtl"
              value={text}
              maxLength={20000}
              disabled={!project}
              spellCheck={false}
              placeholder={"صحنه ۱: پذیرایی خانه، شب\nمریم (زن، سمت چپ) روی مبل نشسته است.\nمریم (لبخند): سلام!"}
              onChange={(e) => workspace.setText(e.target.value)}
            />
            <p className="script-meta">
              {fa(sceneCount)} صحنه · {fa(directed?.timeline.cast.length ?? 0)} شخصیت · {clock(directed?.timeline.duration ?? 0)} · {fa(text.length)}/{fa(20000)} نویسه
            </p>
            {error && <p role="alert" className="story-warn">{error}</p>}
            {directed && text.trim() && directed.warnings.length > 0 && (
              <ul className="story-warn" aria-label="هشدارها">
                {directed.warnings.map((w, i) => <li key={`${i}-${w}`}>{w}</li>)}
              </ul>
            )}
          </div>
          <div className="pane pane-cast">
            {project && directed && <CastPanel project={project} cast={directed.timeline.cast} commit={commit} />}
          </div>
          <div className="pane pane-scenes">
            {project && directed && <SceneBoard directed={directed} format={project.settings.format} selected={selectedId} onPick={(id) => pick(id)} commit={commit} />}
          </div>
          <div className="pane pane-guide"><Guide /></div>
        </aside>

        <section className="editor-stage" aria-label="پیش‌نمایش فیلم">
          {directed && project ? (
            <Player ref={player} directed={directed} project={project} selected={selectedId} commit={commit} onTime={setTime} onPlaying={setPlaying}
              empty={!text.trim()} onStart={() => insertLine("صحنه ۱: پذیرایی خانه، روز", "پذیرایی خانه")} />
          ) : (
            <div className="ed-stage"><p className="stage-empty-text">{error ? "داستان خوانده نشد." : "در حال آماده‌سازی…"}</p></div>
          )}
          {directed && (
            <div className="transport">
              <button type="button" className="icon-btn" onClick={() => step(-1)} disabled={!beats.length} aria-label="بخش قبلی" title="بخش قبلی (→)"><SkipForward size={18} aria-hidden /></button>
              <button type="button" className="play-btn" onClick={() => player.current?.toggle()} disabled={!beats.length} aria-label={playing ? "توقف" : "پخش"} title="پخش/توقف (فاصله)">
                {playing ? <Pause size={22} aria-hidden /> : <Play size={22} aria-hidden />}
              </button>
              <button type="button" className="icon-btn" onClick={() => step(1)} disabled={!beats.length} aria-label="بخش بعدی" title="بخش بعدی (←)"><SkipBack size={18} aria-hidden /></button>
              <span className="time-readout" dir="ltr">{clock(time)} / {clock(directed.timeline.duration)}</span>
            </div>
          )}
          <div className="stage-tl">{strip}</div>
        </section>

        <aside className="editor-inspector pane pane-edit" aria-label="ویرایش بخش">
          <h2 className="inspector-title"><SlidersHorizontal size={16} aria-hidden /> ویرایش بخش</h2>
          {project && directed && <BeatInspector project={project} directed={directed} selected={selectedId} onSelect={(id) => pick(id)} commit={commit} />}
        </aside>
      </div>

      <footer className="editor-timeline">{strip}</footer>

      <nav className="mobile-nav" aria-label="پنل‌های ویرایش">
        {([["script", "متن", PenLine], ["cast", "بازیگران", Users], ["scenes", "صحنه‌ها", Clapperboard], ["edit", "ویرایش بخش", SlidersHorizontal]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" aria-pressed={tab === id} className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}>
            <Icon size={20} aria-hidden /><span>{label}</span>
          </button>
        ))}
        <button type="button" onClick={() => setExporting(true)} disabled={!directed}><Download size={20} aria-hidden /><span>خروجی</span></button>
      </nav>

      {directed && project && (
        <ExportDialog open={exporting} onClose={() => setExporting(false)} directed={directed} project={project} commit={commit} currentTime={() => player.current?.time() ?? 0} />
      )}
    </div>
  );
}

/** درج سرصحنه با انتخاب مکان از فهرست (کتابخانهٔ صحنه‌ها). */
function InsertScene({ count, onInsert }: { count: number; onInsert: (line: string) => void }) {
  const [open, setOpen] = useState(false);
  const [night, setNight] = useState(false);
  return (
    <div className="tool-menu">
      <button type="button" className="tool-btn" aria-expanded={open} onClick={() => setOpen(!open)}><Plus size={15} aria-hidden /> صحنه</button>
      {open && (
        <div className="tool-pop" role="menu" aria-label="مکان صحنهٔ تازه">
          <div className="segmented" role="radiogroup" aria-label="زمان">
            {([[false, "روز"], [true, "شب"]] as const).map(([v, label]) => (
              <button key={label} type="button" role="radio" aria-checked={night === v} className={night === v ? "is-on" : ""} onClick={() => setNight(v)}>{label}</button>
            ))}
          </div>
          <div className="chips">
            {PLACE_IDS.filter((id) => id !== "blank").map((id) => (
              <button key={id} type="button" role="menuitem" className="chip" onClick={() => { onInsert(`صحنه ${fa(count + 1)}: ${PLACES[id].label}، ${night ? "شب" : "روز"}`); setOpen(false); }}>
                {PLACES[id].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** درج دیالوگ برای یکی از شخصیت‌های موجود. */
function InsertLine({ cast, onInsert }: { cast: { id: string; name: string }[]; onInsert: (line: string, select?: string) => void }) {
  const [open, setOpen] = useState(false);
  if (cast.length === 0)
    return <button type="button" className="tool-btn" onClick={() => onInsert("نام: جمله", "جمله")}><MessageSquare size={15} aria-hidden /> دیالوگ</button>;
  return (
    <div className="tool-menu">
      <button type="button" className="tool-btn" aria-expanded={open} onClick={() => setOpen(!open)}><MessageSquare size={15} aria-hidden /> دیالوگ</button>
      {open && (
        <div className="tool-pop" role="menu" aria-label="گوینده">
          <div className="chips">
            {cast.map((c) => (
              <button key={c.id} type="button" role="menuitem" className="chip" onClick={() => { onInsert(`${c.name}: جمله`, "جمله"); setOpen(false); }}>{c.name}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** راهنمای نوشتن: همان قواعدی که خوانندهٔ داستان می‌فهمد. */
function Guide() {
  const rows: [string, string][] = [
    ["صحنه", `«صحنه ۱: مکان، شب/روز». مکان‌ها: ${PLACE_IDS.filter((p) => p !== "blank").map((p) => PLACES[p].label).join("، ")}`],
    ["زمان", "شب، روز، صبح، عصر، غروب"],
    ["معرفی شخصیت", "بار اول با پرانتز: «مریم (زن، سمت چپ، عینکی)»، «پدربزرگ (سمت راست)»، «پسر (بچه)». چپ و راست از دید بیننده است."],
    ["ظاهر", "عینکی، سبیل، ریش، کلاه، روسری، موی بلند، دم‌اسبی، فرفری، کچل"],
    ["دیالوگ", "«اسم (حالت): جمله» مثل «سارا (عصبانی): کجا بودی؟»"],
    ["کارها", "می‌نشیند، بلند می‌شود، وارد می‌شود، بیرون می‌رود، به طرف ... می‌رود، دست به سینه، دست به کمر، دست تکان می‌دهد، اشاره می‌کند، فکر می‌کند، با تلفن صحبت می‌کند، شانه بالا می‌اندازد، هورا، می‌پرد، شوت می‌زند، رانندگی، می‌خورد، می‌نویسد"],
    ["در دست", "گوشی، چای/قهوه، کتاب، کیف، توپ، دسته گل، شیرینی، کنترل، بشقاب، کیسهٔ خرید، چتر، لپ‌تاپ"],
    ["حالت چهره", "لبخند، می‌خندد، ذوق، پوزخند، عصبانی، فریاد، قهر، ناراحت، گریه، تعجب، شوکه، نگران، می‌ترسد، آرام، چپ‌چپ، کلافه، خجالت، خواب‌آلود"],
    ["راوی", "«راوی: ...» فقط زیرنویس می‌شود و دهان کسی تکان نمی‌خورد."],
    ["میان‌برها", "فاصله: پخش/توقف · ← و →: بخش بعد/قبل · Ctrl+Z: برگرداندن · Ctrl+Shift+Z: از نو"],
  ];
  return (
    <dl className="guide">
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}

/** پیش‌نمایش فیلم با پخش، جابه‌جایی زمان و کشیدن شخصیت‌ها روی صحنه. */
function Player({ ref, directed, project, selected, commit, onTime, onPlaying, empty, onStart }: {
  ref: Ref<PlayerHandle>;
  directed: Directed;
  project: StoryProject;
  selected: string;
  commit: (f: (p: StoryProject) => StoryProject) => void;
  onTime: (t: number) => void;
  onPlaying: (on: boolean) => void;
  empty: boolean;
  onStart: () => void;
}) {
  const { timeline } = directed;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const format: Format = project.settings.format;
  const frame = useMemo(() => frameFor(format), [format]);
  const paper = useMemo(() => (typeof document === "undefined" ? null : makePaper(frame.w, frame.h, 7)), [frame]);
  const scaleRef = useRef(0.65);
  const costs = useRef<number[]>([]);
  const drag = useRef<{ actor: string; start: number; moved: boolean; x: number } | null>(null);
  const dragged = useRef(false);
  const [playing, setPlaying] = useState(false);
  const captions = project.settings.captions;
  const [fontReady, setFontReady] = useState(false);
  const tRef = useRef(0);
  const duration = timeline.duration;

  useEffect(() => {
    let alive = true;
    loadRenderFonts().catch(() => undefined).then(() => alive && setFontReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const draw = useCallback((time: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !paper) return;
    const scale = scaleRef.current;
    if (canvas.width !== Math.round(frame.w * scale) || canvas.height !== Math.round(frame.h * scale)) {
      canvas.width = Math.round(frame.w * scale);
      canvas.height = Math.round(frame.h * scale);
    }
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const start = performance.now();
    renderStory(ctx, timeline, Math.min(time, Math.max(0, duration - 0.001)), paper, { captions, format, positions: drag.current ? { [drag.current.actor]: drag.current.x } : undefined });
    costs.current.push(performance.now() - start);
    if (costs.current.length === 120) {
      const p95 = [...costs.current].sort((a, b) => a - b)[113];
      if (p95 > 16.7) scaleRef.current = Math.max(0.3, scaleRef.current - 0.1);
      canvas.dataset.renderP95 = p95.toFixed(2);
      costs.current = [];
    }
  }, [timeline, paper, captions, duration, format, frame]);

  const seek = useCallback((v: number) => {
    setPlaying(false);
    tRef.current = Math.max(0, Math.min(duration, v));
    onTime(tRef.current);
    draw(tRef.current);
  }, [duration, draw, onTime]);
  const toggle = useCallback(() => {
    if (!playing && tRef.current >= duration - 0.05) tRef.current = 0;
    setPlaying((p) => !p);
  }, [playing, duration]);
  useImperativeHandle(ref, () => ({ seek, toggle, time: () => tRef.current }), [seek, toggle]);
  useEffect(() => onPlaying(playing), [playing, onPlaying]);

  // داستان عوض شد: اگر زمان فعلی از فیلم بیرون است برگرد اول
  useEffect(() => {
    if (tRef.current > duration) tRef.current = 0;
    onTime(tRef.current);
    draw(tRef.current);
  }, [draw, duration, fontReady, onTime]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const start = performance.now() - tRef.current * 1000;
    let lastUi = 0;
    const tick = (now: number) => {
      const time = (now - start) / 1000;
      if (time >= duration) {
        tRef.current = duration;
        onTime(duration);
        draw(duration);
        setPlaying(false);
        return;
      }
      tRef.current = time;
      draw(time);
      if (now - lastUi >= 80) {
        onTime(time);
        lastUi = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, draw, duration, onTime]);

  const pointerX = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const screen = ((event.clientX - rect.left) / rect.width) * frame.w;
    const scene = sceneAt(timeline, tRef.current), cam = cameraAt(scene.cameras, tRef.current - scene.start);
    const cx = (cam.cx * frame.w) / FRAME.w;
    return Math.max(0.08, Math.min(0.92, ((screen - cx) / cam.zoom + cx) / frame.w));
  };

  return (
    <div className="ed-stage">
      <div className={`stage-toolbar`}>
        <div className="segmented is-compact" role="radiogroup" aria-label="قاب خروجی">
          {(Object.keys(FORMATS) as Format[]).map((id) => (
            <button key={id} type="button" role="radio" aria-checked={format === id} className={format === id ? "is-on" : ""} onClick={() => commit((p) => ({ ...p, settings: { ...p.settings, format: id } }))}>
              {FORMATS[id].label}
            </button>
          ))}
        </div>
        <label className="toggle is-compact">
          <input type="checkbox" checked={captions} onChange={(e) => commit((p) => ({ ...p, settings: { ...p.settings, captions: e.target.checked } }))} />
          زیرنویس
        </label>
      </div>
      <div className={`stage-canvas is-${format}`}>
        <canvas
          ref={canvasRef}
          width={Math.round(frame.w * 0.65)}
          height={Math.round(frame.h * 0.65)}
          data-render-ready={fontReady}
          className="story-canvas"
          style={{ aspectRatio: `${frame.w} / ${frame.h}` }}
          aria-label="فیلم؛ برای پخش یا توقف کلیک کنید، شخصیت را برای جابه‌جایی بکشید"
          onClick={() => {
            if (dragged.current) {
              dragged.current = false;
              return;
            }
            toggle();
          }}
          onPointerDown={(e) => {
            if (!selected) return;
            const scene = sceneAt(timeline, tRef.current), x = pointerX(e);
            const nearest = scene.actors.map((a) => ({ a, x: actorAt(a.track, tRef.current - scene.start, null).x })).sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x))[0];
            if (!nearest || Math.abs(nearest.x - x) > 0.15) return;
            setPlaying(false);
            drag.current = { actor: nearest.a.cast, start: e.clientX, moved: false, x: nearest.x };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (drag.current) {
              drag.current.x = pointerX(e);
              drag.current.moved ||= Math.abs(e.clientX - drag.current.start) > 4;
              draw(tRef.current);
            }
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            if (d?.moved) {
              dragged.current = true;
              commit((p) => setEdit(p, selected, { actor: d.actor, x: d.x }));
            }
            if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
            draw(tRef.current);
          }}
        />
        {empty && (
          <div className="stage-empty">
            <p className="stage-empty-title">صحنه خالی است</p>
            <p>داستان را در ستون «متن» بنویسید؛ هر خط فوراً اینجا اجرا می‌شود.</p>
            <button type="button" className="btn btn-primary" onClick={onStart}><Plus size={16} aria-hidden /> شروع با اولین صحنه</button>
          </div>
        )}
      </div>
    </div>
  );
}
