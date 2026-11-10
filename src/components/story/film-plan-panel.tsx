import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { planFilmFromStory } from "@/lib/film-plan-ai";
import { setPlan, type StoryProject } from "@/studio/stick/project";
import { fa } from "@/studio/format";

/**
 * «برنامهٔ فیلم با Gemini»: فقط با زدن دکمه (هیچ تماس خودکاری نیست). نتیجه در پروژه ذخیره می‌شود و
 * موتور قطعی آن را اجرا می‌کند؛ «حذف برنامه» دوباره داستان را با فهم دیکشنری می‌سازد.
 */
export function FilmPlanPanel({ project, commit }: { project: StoryProject; commit: (f: (p: StoryProject) => StoryProject) => void }) {
  const [busy, setBusy] = useState(false);
  const [high, setHigh] = useState(false);
  const [target, setTarget] = useState(240);
  const [notes, setNotes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const run = async () => {
    setBusy(true);
    setError("");
    setNotes([]);
    try {
      const res = await planFilmFromStory({ data: { story: project.text, targetDurationSec: target, format: project.settings.format, quality: high ? "high" : "standard" } });
      setNotes(res.warnings);
      if (res.ok) commit((p) => setPlan(p, res.plan));
      else setError(res.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="script-tools" aria-label="برنامهٔ فیلم">
      <button type="button" className="tool-btn" disabled={busy || !project.text.trim()} onClick={run}>
        <Sparkles size={15} aria-hidden /> {busy ? "در حال برنامه‌ریزی…" : project.plan ? "برنامهٔ تازه با Gemini" : "برنامهٔ فیلم با Gemini"}
      </button>
      <label className="tool-btn">
        <select value={target} disabled={busy} onChange={(e) => setTarget(Number(e.target.value))} aria-label="مدت فیلم">
          {[180, 240, 300].map((s) => <option key={s} value={s}>{fa(s / 60)} دقیقه</option>)}
        </select>
      </label>
      <label className="tool-btn" title="کندتر؛ اگر دیر کند خودکار به حالت معمولی برمی‌گردد">
        <input type="checkbox" checked={high} disabled={busy} onChange={(e) => setHigh(e.target.checked)} /> کیفیت بالا (کند)
      </label>
      {project.plan && (
        <button type="button" className="tool-btn" disabled={busy} onClick={() => commit((p) => setPlan(p, undefined))}>
          <X size={15} aria-hidden /> حذف برنامه
        </button>
      )}
      {project.plan && <span className="script-meta">حالت: برنامهٔ فیلم «{project.plan.meta.title}»</span>}
      {error && <p role="alert" className="story-warn">{error}</p>}
      {notes.length > 0 && (
        <ul className="story-warn" aria-label="هشدارهای برنامهٔ فیلم">
          {notes.map((w, i) => <li key={`${i}-${w}`}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}
