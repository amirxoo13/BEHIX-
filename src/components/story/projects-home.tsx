import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Copy, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { BatchExport } from "@/components/story/batch-export";
import { FrameThumb } from "@/components/story/frame-thumb";
import { compileProject, importProject, newProject, type StoryProject } from "@/studio/stick/project";
import { deleteProject, listProjects, saveProject } from "@/studio/stick/project-db";
import { thumbnailTime } from "@/studio/stick/deliverables";
import { FORMATS } from "@/studio/stick/layout";
import { fa } from "@/studio/format";

const ago = (at: number) => {
  if (!at) return "زمان ثبت نشده";
  const min = Math.round((Date.now() - at) / 60000);
  if (min < 1) return "همین حالا";
  if (min < 60) return `${fa(min)} دقیقه پیش`;
  const h = Math.round(min / 60);
  if (h < 24) return `${fa(h)} ساعت پیش`;
  const d = Math.round(h / 24);
  if (d < 30) return `${fa(d)} روز پیش`;
  return new Date(at).toLocaleDateString("fa-IR");
};
const length = (sec: number) => `${fa(Math.floor(sec / 60))}:${fa(Math.round(sec % 60)).padStart(2, "۰")}`;

/**
 * صفحهٔ خانه و گالری پروژه‌ها (مثل «My Plots» در Plotagon و گالری Animation Desk):
 * ساخت داستان تازه، ورود فایل، جست‌وجو، مرتب‌سازی و کارت هر پروژه با تصویر واقعی از فیلم.
 * در سایت و اپ اندروید مشترک است؛ مسیریابی را صفحهٔ میزبان با `onOpen` انجام می‌دهد.
 */
export function ProjectsHome({ brand, onOpen, extra }: { brand: (content: ReactNode) => ReactNode; onOpen: (id: string) => void | Promise<void>; extra?: ReactNode }) {
  const [projects, setProjects] = useState<StoryProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const [rename, setRename] = useState<StoryProject | null>(null);
  const [remove, setRemove] = useState<StoryProject | null>(null);

  useEffect(() => {
    let alive = true;
    listProjects()
      .then((items) => alive && setProjects(items))
      .catch(() => alive && setError("پروژه‌های این دستگاه خوانده نشد. دسترسی ذخیره‌سازی مرورگر را بررسی کنید."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      setProjects(await listProjects());
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "عملیات انجام نشد؛ دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  };

  const create = () => run(async () => {
    const p = newProject();
    await saveProject(p);
    await onOpen(p.id);
  });

  const visible = useMemo(
    () => projects
      .filter((p) => p.title.includes(query.trim()) || p.text.includes(query.trim()))
      .sort((a, b) => (sort === "name" ? a.title.localeCompare(b.title, "fa") : b.updatedAt - a.updatedAt)),
    [projects, query, sort],
  );

  return (
    <div className="home" dir="rtl">
      <header className="home-bar">
        {brand(
          <>
            <img src="/brand/app-icon.png" alt="" className="brand-mark" />
            <img src="/brand/wordmark.png" alt="BEHIX" className="brand-word" />
          </>,
        )}
        <button type="button" className="btn btn-primary" disabled={busy || loading} onClick={() => void create()}>
          <Plus size={18} aria-hidden /> داستان تازه
        </button>
      </header>

      <main className="home-main">
        <section className="home-hero" aria-labelledby="home-title">
          <div>
            <p className="kicker">STORY → FILM</p>
            <h1 id="home-title">داستان را فارسی بنویسید، فیلم آدمکی تحویل بگیرید</h1>
            <p className="home-lede">بدون هوش مصنوعی و بدون اینترنت: نوشتن، کارگردانی خودکار، ویرایش هر بخش و خروجی فیلم، زیرنویس و استوری‌بورد؛ همه روی همین دستگاه.</p>
          </div>
          <ol className="home-steps" aria-label="مراحل کار">
            <li><b>۱</b><span>بنویسید</span><small>صحنه، شخصیت، دیالوگ</small></li>
            <li><b>۲</b><span>تنظیم کنید</span><small>نما، چهره، حرکت، مکان</small></li>
            <li><b>۳</b><span>خروجی بگیرید</span><small>MP4، SRT، استوری‌بورد</small></li>
          </ol>
        </section>

        {error && <p className="story-warn" role="alert">{error}</p>}

        <section className="home-section" aria-labelledby="mine">
          <div className="home-section-head">
            <h2 id="mine">پروژه‌های من {projects.length > 0 && <small>{fa(projects.length)}</small>}</h2>
            <div className="home-tools">
              <label className="home-search">
                <Search size={16} aria-hidden />
                <span className="sr-only">جست‌وجوی پروژه</span>
                <input className="field" type="search" placeholder="جست‌وجو" aria-label="جست‌وجوی پروژه" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <label>
                <span className="sr-only">مرتب‌سازی</span>
                <select className="field" aria-label="مرتب‌سازی" value={sort} onChange={(e) => setSort(e.target.value as "recent" | "name")}>
                  <option value="recent">آخرین تغییر</option>
                  <option value="name">نام</option>
                </select>
              </label>
              <label className="btn btn-ghost">
                <Upload size={16} aria-hidden /> ورود فایل
                <input
                  className="sr-only"
                  type="file"
                  accept=".json,application/json"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    void run(async () => {
                      if (file.size > 2_000_000) throw new Error("فایل بزرگ‌تر از حد مجاز است.");
                      const imported = importProject(await file.text());
                      await saveProject({ ...imported, id: crypto.randomUUID(), updatedAt: Date.now() });
                    });
                  }}
                />
              </label>
            </div>
          </div>

          {loading && <p role="status" className="text-muted">در حال خواندن پروژه‌های دستگاه…</p>}

          <div className="home-grid">
            <button type="button" className="home-new" disabled={busy || loading} onClick={() => void create()}>
              <span className="home-new-icon"><Plus size={28} aria-hidden /></span>
              <b>داستان تازه</b>
              <small>صفحهٔ خالی؛ با راهنمای نوشتن</small>
            </button>
            {visible.map((p) => (
              <ProjectCard key={p.id} project={p} busy={busy} onOpen={() => void onOpen(p.id)} onRename={() => setRename(p)} onRemove={() => setRemove(p)}
                onCopy={() => void run(async () => { await saveProject({ ...structuredClone(p), id: crypto.randomUUID(), title: `${p.title.slice(0, 110)} — کپی`, updatedAt: Date.now() }); })} />
            ))}
          </div>
          {!loading && query && visible.length === 0 && <p className="text-muted">پروژه‌ای با این نام پیدا نشد.</p>}
        </section>

        {rename && (
          <form className="panel home-dialog" onSubmit={(e) => { e.preventDefault(); void run(async () => { await saveProject({ ...rename, title: rename.title.trim() || "داستان", updatedAt: Date.now() }); setRename(null); }); }}>
            <label>نام تازه<input autoFocus className="field" maxLength={120} value={rename.title} onChange={(e) => setRename({ ...rename, title: e.target.value })} /></label>
            <div className="flex gap-2">
              <button disabled={busy} className="btn btn-primary">ذخیرهٔ نام</button>
              <button type="button" className="btn btn-ghost" onClick={() => setRename(null)}>انصراف</button>
            </div>
          </form>
        )}
        {remove && (
          <section className="panel home-dialog" role="alert">
            <p>پروژهٔ «{remove.title}» حذف شود؟ این کار برگشت‌پذیر نیست.</p>
            <div className="flex gap-2 mt-3">
              <button className="btn btn-danger" disabled={busy} onClick={() => void run(async () => { await deleteProject(remove.id); setRemove(null); })}>تأیید حذف</button>
              <button className="btn btn-ghost" onClick={() => setRemove(null)}>انصراف</button>
            </div>
          </section>
        )}

        {projects.length > 1 && (
          <details className="panel home-batch">
            <summary className="cursor-pointer font-bold">خروجی دسته‌ای چند قسمت</summary>
            <BatchExport projects={projects} />
          </details>
        )}
        {extra}
      </main>
    </div>
  );
}

/** کارت یک پروژه با تصویر واقعی از فیلم. */
function ProjectCard({ project: p, busy, onOpen, onRename, onRemove, onCopy }: { project: StoryProject; busy: boolean; onOpen: () => void; onRename: () => void; onRemove: () => void; onCopy: () => void }) {
  const compiled = useMemo(() => {
    try {
      return compileProject(p);
    } catch {
      return null;
    }
  }, [p]);
  const scenes = compiled?.timeline.scenes.length ?? 0;
  const empty = !p.text.trim();
  return (
    <article className="project-card">
      <button type="button" className="project-open" onClick={onOpen} aria-label={`باز کردن ${p.title}`}>
        <span className={`project-cover is-${p.settings.format}`}>
          {compiled && !empty ? (
            <FrameThumb timeline={compiled.timeline} t={thumbnailTime(compiled.cues, compiled.timeline.scenes)} format={p.settings.format} width={220} />
          ) : (
            <span className="project-empty">هنوز نوشته نشده</span>
          )}
        </span>
      </button>
      <div className="project-meta">
        <h3>{p.title}</h3>
        <p>
          {empty ? "متن خالی" : `${fa(scenes)} صحنه · ${length(compiled?.timeline.duration ?? 0)}`} · {FORMATS[p.settings.format].label}
        </p>
        <time dateTime={new Date(p.updatedAt).toISOString()}>{ago(p.updatedAt)}</time>
      </div>
      <div className="project-actions">
        <button type="button" className="btn btn-primary" onClick={onOpen}>باز کردن</button>
        <button type="button" className="icon-btn" disabled={busy} onClick={onRename} aria-label="تغییر نام" title="تغییر نام"><Pencil size={16} aria-hidden /></button>
        <button type="button" className="icon-btn" disabled={busy} onClick={onCopy} aria-label="کپی" title="کپی"><Copy size={16} aria-hidden /></button>
        <button type="button" className="icon-btn" disabled={busy} onClick={onRemove} aria-label="حذف" title="حذف"><Trash2 size={16} aria-hidden /></button>
      </div>
    </article>
  );
}

