import { useState } from "react";
import { importProject, newProject, projectJson, type StoryProject } from "@/studio/stick/project";
import { downloadBlob } from "@/studio/stick/download";
import type { useStoryWorkspace } from "@/studio/stick/use-workspace";
export function ProjectPanel({
  workspace: w,
}: {
  workspace: ReturnType<typeof useStoryWorkspace>;
}) {
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const p = w.project;
  if (!p) return null;
  const open = (project: StoryProject) => {
    setError("");
    setDeleting(false);
    w.open(project);
  };
  return (
    <details className="panel" aria-label="پروژه‌ها">
      <summary className="cursor-pointer font-bold">
        پروژه: {p.title} · {w.message ? "ذخیره نشد" : w.saving ? "ذخیره…" : "مدیریت داستان‌ها"}
      </summary>
      <div className="grid gap-3 mt-3">
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => open(newProject())}>
            داستان تازه
          </button>
          <button className="btn btn-ghost" disabled={!w.canUndo} onClick={w.undo}>
            برگردان
          </button>
          <button className="btn btn-ghost" disabled={!w.canRedo} onClick={w.redo}>
            تکرار
          </button>
        </div>
        <label>
          نام پروژه
          <input
            className="field"
            value={p.title}
            maxLength={120}
            onChange={(e) =>
              w.commit((p) => ({ ...p, title: e.target.value || "داستان تازه" }), true)
            }
          />
        </label>
        <label>
          داستان‌های ذخیره‌شده
          <select
            className="field"
            value={p.id}
            onChange={(e) => {
              const found = w.projects.find((p) => p.id === e.target.value);
              if (found) open(found);
            }}
          >
            {!w.projects.some((x) => x.id === p.id) && <option value={p.id}>{p.title}</option>}
            {w.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-ghost"
            onClick={() =>
              downloadBlob(
                new Blob([projectJson(p)], { type: "application/json" }),
                `${p.title}.behix.json`,
              )
            }
          >
            دریافت JSON
          </button>
          <label className="btn btn-ghost">
            بارگذاری JSON
            <input
              className="sr-only"
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  if (file.size > 2_000_000) throw new Error("فایل بزرگ‌تر از حد مجاز است.");
                  const imported = importProject(await file.text());
                  open({ ...imported, id: crypto.randomUUID(), updatedAt: Date.now() });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "خواندن فایل ممکن نشد.");
                }
              }}
            />
          </label>
          <button className="btn btn-ghost" onClick={() => setDeleting(!deleting)}>
            حذف پروژه
          </button>
        </div>
        {deleting && (
          <div role="alert" className="story-warn">
            پروژهٔ «{p.title}» حذف شود؟{" "}
            <button
              className="btn btn-danger"
              onClick={() => {
                void w
                  .remove()
                  .then(() => setDeleting(false))
                  .catch(() => setError("حذف انجام نشد."));
              }}
            >
              حذف همین پروژه
            </button>
            <button className="btn btn-ghost" onClick={() => setDeleting(false)}>
              انصراف
            </button>
          </div>
        )}
        <p role="status" className="text-sm text-muted">
          {w.message || (w.saving ? "در حال ذخیره…" : "ذخیره شد؛ روی همین مرورگر")}
        </p>
        {error && (
          <p role="alert" className="story-warn">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
