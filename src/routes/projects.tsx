import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listProjects, saveProject, deleteProject } from "@/studio/stick/project-db";
import { newProject, type StoryProject } from "@/studio/stick/project";
import { idbKV, IDB_KEY, parseProject } from "@/studio/persist";

export const Route = createFileRoute("/projects")({ component: ProjectsPage });
function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<StoryProject[]>([]);
  const [photo, setPhoto] = useState<{ title: string; at: number } | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rename, setRename] = useState<StoryProject | null>(null);
  const [remove, setRemove] = useState<StoryProject | null>(null);
  useEffect(() => {
    let alive = true;
    void Promise.allSettled([
      listProjects().then(p => { if (alive) setProjects(p); }),
      (async () => {
        const raw = await idbKV(indexedDB)?.get(IDB_KEY);
        if (raw == null) return;
        const parsed = parseProject(raw);
        if (!parsed.ok) throw new Error("پروژهٔ عکس‌سر نیاز به بازیابی دارد؛ آن را از مسیر عکس‌سر باز کنید.");
        const at = (raw as { savedAt?: number }).savedAt;
        if (alive) setPhoto({ title: parsed.data.title, at: typeof at === "number" && Number.isFinite(at) ? at : 0 });
      })(),
    ]).then(results => {
      if (!alive) return;
      setError(results.filter(r => r.status === "rejected").map(r => String((r as PromiseRejectedResult).reason)).join(" · "));
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);
  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError("");
    try { await action(); setProjects(await listProjects()); }
    catch { setError("عملیات ذخیره‌سازی انجام نشد؛ دوباره تلاش کنید. پروژهٔ فعلی حذف یا جایگزین نشده است مگر حذف را تأیید کرده باشید."); }
    finally { setBusy(false); }
  };
  const visible = projects.filter(p => p.title.includes(query)).sort((a,b) => sort === "name" ? a.title.localeCompare(b.title, "fa") : b.updatedAt - a.updatedAt);
  const date = (at: number) => at ? new Date(at).toLocaleString("fa-IR") : "زمان ثبت نشده";
  return <main dir="rtl" className="mx-auto grid max-w-5xl gap-5 p-4 min-w-0">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><Link to="/">BEHIX</Link><h1 className="text-2xl font-bold mt-2">پروژه‌ها</h1></div><Link to="/story" className="btn btn-ghost">ادامهٔ داستان</Link></header>
    <p className="text-sm text-muted">پروژه‌ها در همین مرورگر ذخیره می‌شوند. برای نگهداری نسخهٔ مستقل از ویرایشگر JSON بگیرید.</p>
    <section className="grid gap-3 sm:grid-cols-2" aria-label="ساخت پروژه">
      <button disabled={busy || loading} className="panel text-start" onClick={() => void run(async () => { const p = newProject(); await saveProject(p); await navigate({ to: "/story", search: { project: p.id } }); })}><b>داستان تازه</b><span className="block text-sm mt-2">متن فارسی، فیلم آدمکی بی‌صدا و زیرنویس</span></button>
      <Link className="panel no-underline" to="/scenario"><b>{photo ? "ادامهٔ پروژهٔ عکس‌سر" : "شروع مسیر عکس‌سر"}</b><span className="block text-sm mt-2">سناریو، شخصیت، صحنه و صدای ضبط‌شده</span></Link>
    </section>
    {error && <p className="story-warn" role="alert">{error}</p>}
    {loading && <p role="status">در حال خواندن پروژه‌های دستگاه…</p>}
    {photo && <section className="panel"><span className="text-xs text-muted">پروژهٔ جاری عکس‌سر</span><h2 className="font-bold">{photo.title}</h2><p className="text-sm">{date(photo.at)}</p><p className="text-sm text-muted my-2">این مسیر فعلاً یک پروژهٔ جاری دارد. صداهای ضبط‌شده فقط تا بستن صفحه می‌مانند.</p><Link to="/" className="btn btn-ghost">مدیریت و ادامه</Link></section>}
    <h2 className="font-bold">داستان‌های ذخیره‌شده</h2>
    <div className="grid gap-3 sm:grid-cols-2"><label>جست‌وجوی پروژه<input className="field" value={query} onChange={e => setQuery(e.target.value)} /></label><label>مرتب‌سازی<select className="field" value={sort} onChange={e => setSort(e.target.value)}><option value="recent">آخرین تغییر</option><option value="name">نام</option></select></label></div>
    {!loading && visible.length === 0 && <p className="panel">{query ? "پروژه‌ای با این نام پیدا نشد." : "هنوز داستان ذخیره‌شده‌ای ندارید."}</p>}
    <div className="grid gap-3 sm:grid-cols-2">{visible.map(p => <article key={p.id} className="panel min-w-0 grid gap-2"><span className="text-xs text-muted">داستان آدمکی</span><h3 className="font-bold break-words">{p.title}</h3><time className="text-xs text-muted" dateTime={new Date(p.updatedAt).toISOString()}>{date(p.updatedAt)}</time><p className="text-sm truncate">{p.text.slice(0, 100) || "متن خالی"}</p><div className="flex flex-wrap gap-2">
      <Link to="/story" search={{ project: p.id }} className="btn btn-primary">باز کردن</Link>
      <button className="btn btn-ghost" disabled={busy} onClick={() => setRename(p)}>تغییر نام</button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => void run(async () => { await saveProject({...structuredClone(p), id: crypto.randomUUID(), title: `${p.title.slice(0, 110)} — کپی`, updatedAt: Date.now()}); })}>کپی</button>
      <button className="btn btn-ghost" disabled={busy} onClick={() => setRemove(p)}>حذف</button>
    </div></article>)}</div>
    {rename && <form className="panel grid gap-3" onSubmit={e => { e.preventDefault(); void run(async () => { await saveProject({...rename, title: rename.title.trim() || "داستان", updatedAt: Date.now()}); setRename(null); }); }}><label>نام تازه<input autoFocus className="field" maxLength={120} value={rename.title} onChange={e => setRename({...rename, title:e.target.value})} /></label><button disabled={busy} className="btn btn-primary">ذخیرهٔ نام</button><button type="button" className="btn btn-ghost" onClick={() => setRename(null)}>انصراف</button></form>}
    {remove && <section className="panel" role="alert"><p>پروژهٔ «{remove.title}» حذف شود؟ این عمل برگشت‌پذیر نیست.</p><div className="flex gap-2 mt-3"><button className="btn btn-danger" disabled={busy} onClick={() => void run(async () => { await deleteProject(remove.id); setRemove(null); })}>تأیید حذف</button><button className="btn btn-ghost" onClick={() => setRemove(null)}>انصراف</button></div></section>}
  </main>;
}
