import { useEffect, useRef, useState } from "react";
import { Download, FileJson, FileText, Film, Image as ImageIcon, LayoutGrid, Subtitles, X } from "lucide-react";
import { dialogueText } from "@/studio/stick/deliverables";
import { downloadBlob as download } from "@/studio/stick/download";
import { FORMATS, type Format } from "@/studio/stick/layout";
import { projectJson, type StoryProject } from "@/studio/stick/project";
import { cuesToSrt, type Directed } from "@/studio/stick/story-direct";
import { canExportMp4, exportStoryFilm, type StoryFilm } from "@/studio/stick/story-export";
import { renderStoryboard } from "@/studio/stick/storyboard";
import { frameImage, thumbnail } from "@/studio/stick/thumbnail";
import { fa } from "@/studio/format";

const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_").trim() || "behix";

/**
 * پنجرهٔ خروجی (مثل Export در Animaker و Animation Desk): تنظیم قاب و نرمی، ساخت فیلم،
 * و فایل‌های همراه: زیرنویس، متن صداپیشه، استوری‌بورد، تصویر کوچک، فریم فعلی و فایل پروژه.
 */
export function ExportDialog({ open, onClose, directed, project, commit, currentTime }: {
  open: boolean;
  onClose: () => void;
  directed: Directed;
  project: StoryProject;
  commit: (f: (p: StoryProject) => StoryProject) => void;
  currentTime: () => number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { fps, format, captions } = project.settings;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [film, setFilm] = useState<StoryFilm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fast, setFast] = useState<boolean | null>(null);
  const abort = useRef<AbortController | null>(null);
  const title = safe(project.title);
  const empty = directed.timeline.duration <= 0 || directed.beats.length === 0;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    let alive = true;
    void canExportMp4(fps, format).then((ok) => alive && setFast(ok));
    return () => {
      alive = false;
    };
  }, [fps, format]);
  // داستان یا تنظیم عوض شد ← فیلم قبلی دیگر مال این داستان نیست
  useEffect(() => {
    setFilm(null);
    abort.current?.abort();
  }, [directed, captions, fps, format]);
  useEffect(() => () => abort.current?.abort(), []);

  const settings = (patch: Partial<StoryProject["settings"]>) => commit((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
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
  const file = (make: () => Promise<Blob> | Blob, name: string) => {
    setMessage(null);
    void Promise.resolve()
      .then(make)
      .then((blob) => download(blob, name))
      .catch((err) => setMessage(err instanceof Error ? err.message : String(err)));
  };
  const names = Object.fromEntries(directed.timeline.cast.map((c) => [c.id, c.name]));

  return (
    <dialog ref={ref} className="export-dialog" aria-labelledby="export-title" onClose={onClose} onCancel={() => { if (busy) abort.current?.abort(); }}>
      <header className="export-head">
        <h2 id="export-title">خروجی</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="بستن"><X size={18} aria-hidden /></button>
      </header>

      <div className="export-body">
        <section className="export-settings" aria-label="تنظیمات فیلم">
          <div className="field-group">
            <span className="group-label">قاب</span>
            <div className="segmented" role="radiogroup" aria-label="قاب خروجی">
              {(Object.keys(FORMATS) as Format[]).map((id) => (
                <button key={id} type="button" role="radio" aria-checked={format === id} className={format === id ? "is-on" : ""} disabled={busy} onClick={() => settings({ format: id })}>{FORMATS[id].label}</button>
              ))}
            </div>
          </div>
          <div className="field-group">
            <span className="group-label">نرمی حرکت</span>
            <div className="segmented" role="radiogroup" aria-label="نرمی حرکت">
              {([30, 60] as const).map((f) => (
                <button key={f} type="button" role="radio" aria-checked={fps === f} className={fps === f ? "is-on" : ""} disabled={busy} onClick={() => settings({ fps: f })}>{fa(f)} فریم</button>
              ))}
            </div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={captions} disabled={busy} onChange={(e) => settings({ captions: e.target.checked })} />
            زیرنویس روی تصویر فیلم
          </label>
        </section>

        <section className="export-film" aria-label="فیلم">
          {busy ? (
            <>
              <div className="story-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
                <span style={{ width: `${progress * 100}%` }} />
              </div>
              <button type="button" className="btn btn-danger" onClick={() => abort.current?.abort()}>لغو ({fa(Math.round(progress * 100))}٪)</button>
            </>
          ) : film ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => download(film.blob, `${title}.${film.ext}`)}>
              <Download size={18} aria-hidden /> دانلود فیلم ({film.ext.toUpperCase()}، {fa(Number((film.blob.size / 1e6).toFixed(1)))} مگابایت)
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void run()} disabled={empty}>
              <Film size={18} aria-hidden /> ساخت فیلم بی‌صدا ({FORMATS[format].label})
            </button>
          )}
          {fast === false && !busy && <p className="hint">این مرورگر رمزگذار سریع ندارد؛ فیلم هم‌زمان با پخش ضبط می‌شود و به اندازهٔ طول فیلم زمان می‌برد.</p>}
        </section>

        <section aria-label="فایل‌های همراه">
          <h3 className="panel-subtitle">فایل‌های همراه</h3>
          <div className="export-grid">
            <button type="button" className="export-tile" disabled={!directed.cues.length} onClick={() => file(() => new Blob(["﻿", cuesToSrt(directed.cues)], { type: "application/x-subrip;charset=utf-8" }), `${title}.srt`)}>
              <Subtitles size={20} aria-hidden /><b>زیرنویس برای صداپیشه</b><small>SRT با زمان دقیق هر دیالوگ</small>
            </button>
            <button type="button" className="export-tile" disabled={!directed.cues.length} onClick={() => file(() => new Blob(["﻿", dialogueText(directed.cues, project.title)], { type: "text/plain;charset=utf-8" }), `${title}.txt`)}>
              <FileText size={20} aria-hidden /><b>متن کامل صداپیشه</b><small>دیالوگ‌ها با گوینده و زمان</small>
            </button>
            <button type="button" className="export-tile" disabled={empty} onClick={() => file(() => renderStoryboard(directed, format, project.title, names), `${title}-storyboard.png`)}>
              <LayoutGrid size={20} aria-hidden /><b>استوری‌بورد</b><small>یک قاب از هر بخش با متن، PNG</small>
            </button>
            <button type="button" className="export-tile" disabled={empty} onClick={() => file(() => thumbnail(directed, format), `${title}-cover.png`)}>
              <ImageIcon size={20} aria-hidden /><b>تصویر کاور</b><small>قاب اولین دیالوگ، PNG</small>
            </button>
            <button type="button" className="export-tile" disabled={empty} onClick={() => file(() => frameImage(directed, currentTime(), format, captions), `${title}-frame.png`)}>
              <ImageIcon size={20} aria-hidden /><b>همین فریم</b><small>قاب فعلی پیش‌نمایش، PNG</small>
            </button>
            <button type="button" className="export-tile" onClick={() => file(() => new Blob([projectJson(project)], { type: "application/json" }), `${title}.behix.json`)}>
              <FileJson size={20} aria-hidden /><b>فایل پروژه</b><small>JSON برای پشتیبان یا دستگاه دیگر</small>
            </button>
          </div>
        </section>
        {message && <p className="hint" role="status">{message}</p>}
        <p className="hint">فیلم بی‌صداست. فیلم و صدای صداپیشه را در CapCut یا Premiere روی هم بگذارید؛ زمان‌ها با SRT یکی است.</p>
      </div>
    </dialog>
  );
}
