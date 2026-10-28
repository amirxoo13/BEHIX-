import { useEffect, useRef, useState } from "react";
import { compileProject, type StoryProject } from "@/studio/stick/project";
import { exportStoryFilm } from "@/studio/stick/story-export";
import { cuesToSrt } from "@/studio/stick/story-direct";
import { dialogueText } from "@/studio/stick/deliverables";
import { thumbnail } from "@/studio/stick/thumbnail";
import { downloadBlob } from "@/studio/stick/download";
import {
  saveArtifact,
  readArtifact,
  removeArtifact,
  listArtifacts,
} from "@/studio/stick/project-db";
type Item = { id: string; title: string; status: string; files: { id: string; name: string }[] };
export function BatchExport({ projects }: { projects: StoryProject[] }) {
  const [selected, setSelected] = useState<string[]>([]),
    [items, setItems] = useState<Item[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    void listArtifacts()
      .then((files) => {
        if (files.length)
          setItems([
            {
              id: "saved",
              title: "خروجی‌های ذخیره‌شده",
              status: "آماده",
              files: files.map(({ id, name }) => ({ id, name })),
            },
          ]);
      })
      .catch(() => undefined);
    return () => controller.current?.abort();
  }, []);
  const run = async () => {
    const queue = selected
      .map((id) => projects.find((p) => p.id === id))
      .filter((p): p is StoryProject => !!p)
      .map((p) => structuredClone(p));
    const ctrl = new AbortController();
    controller.current = ctrl;
    setBusy(true);
    setError("");
    const jobs = queue.map((p) => ({
      id: crypto.randomUUID(),
      title: p.title,
      status: "در صف",
      files: [] as Item["files"],
    }));
    setItems((old) => [...old, ...jobs]);
    const update = (id: string, patch: Partial<Item>) =>
      setItems((items) => items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    try {
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i],
          job = jobs[i];
        if (ctrl.signal.aborted) {
          update(job.id, { status: "لغو شد" });
          continue;
        }
        try {
          const d = compileProject(p);
          const film = await exportStoryFilm(d.timeline, {
            ...p.settings,
            signal: ctrl.signal,
            onProgress: (n) => update(job.id, { status: `ساخت فیلم: ${Math.round(n * 100)}٪` }),
          });
          const files: Item["files"] = [];
          for (const [suffix, blob] of [
            [film.ext, film.blob],
            [
              "srt",
              new Blob(["\uFEFF", cuesToSrt(d.cues)], {
                type: "application/x-subrip;charset=utf-8",
              }),
            ],
            [
              "txt",
              new Blob(["\uFEFF", dialogueText(d.cues, p.title)], {
                type: "text/plain;charset=utf-8",
              }),
            ],
            ["png", await thumbnail(d, p.settings.format)],
          ] as const) {
            ctrl.signal.throwIfAborted();
            const id = `${job.id}-${suffix}`,
              name = `${p.title}.${suffix}`;
            await saveArtifact({ id, name, blob });
            files.push({ id, name });
            update(job.id, { files: [...files] });
          }
          update(job.id, { status: film.notice ?? "آماده" });
        } catch (err) {
          update(job.id, {
            status: ctrl.signal.aborted
              ? "لغو شد"
              : `خطا: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    } finally {
      setBusy(false);
      controller.current = null;
    }
  };
  return (
    <div className="grid gap-3 mt-3">
      <div className="grid gap-3">
        <p className="text-sm text-muted">
          قسمت‌ها به ترتیب انتخاب ساخته می‌شوند. تنظیمات ذخیره‌شدهٔ هر داستان استفاده می‌شود.
        </p>
        {projects.map((p) => (
          <label key={p.id} className="flex gap-2">
            <input
              type="checkbox"
              disabled={busy}
              checked={selected.includes(p.id)}
              onChange={(e) =>
                setSelected((ids) =>
                  e.target.checked ? [...ids, p.id] : ids.filter((id) => id !== p.id),
                )
              }
            />
            {p.title}
            {selected.includes(p.id) ? ` (${selected.indexOf(p.id) + 1})` : ""}
          </label>
        ))}
        {busy ? (
          <button className="btn btn-danger" onClick={() => controller.current?.abort()}>
            لغو صف
          </button>
        ) : (
          <button
            className="btn btn-primary"
            disabled={!selected.length}
            onClick={() => {
              void run().catch((err) => setError(String(err)));
            }}
          >
            ساخت قسمت‌های انتخاب‌شده
          </button>
        )}
        {items.map((item) => (
          <div key={item.id} className="grid gap-2">
            <b>{item.title}</b>
            <p role="status">{item.status}</p>
            <div className="flex flex-wrap gap-2">
              {item.files.map((file) => (
                <button
                  className="btn btn-ghost"
                  key={file.id}
                  onClick={() => {
                    void readArtifact(file.id)
                      .then((a) => {
                        if (a) downloadBlob(a.blob, a.name);
                        else setError("فایل دیگر در حافظهٔ مرورگر نیست.");
                      })
                      .catch(() => setError("خواندن فایل ممکن نشد."));
                  }}
                >
                  {file.name}
                </button>
              ))}
            </div>
            {!busy && (
              <button
                className="btn btn-ghost"
                onClick={() => {
                  void Promise.all(item.files.map((f) => removeArtifact(f.id)))
                    .then(() => setItems((xs) => xs.filter((x) => x.id !== item.id)))
                    .catch(() => setError("حذف خروجی انجام نشد."));
                }}
              >
                پاک کردن این خروجی‌ها از حافظه
              </button>
            )}
          </div>
        ))}
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  );
}
