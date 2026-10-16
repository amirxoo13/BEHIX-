import { useCallback, useEffect, useRef, useState } from "react";
import {
  changeText,
  history,
  newProject,
  remember,
  undo,
  redo,
  type History,
  type StoryProject,
} from "./project.ts";
import { listProjects, migrateLegacy, saveProject, deleteProject } from "./project-db.ts";
export function useStoryWorkspace(sample: string, requestedId?: string) {
  const [stack, setStack] = useState<History<StoryProject> | null>(null);
  const [projects, setProjects] = useState<StoryProject[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const queue = useRef(Promise.resolve());
  const latest = useRef(0);
  const typing = useRef(0);
  const revision = useRef(0);
  const current = useRef<StoryProject | null>(null);
  const switching = useRef(false);
  useEffect(() => {
    let alive = true;
    void migrateLegacy(sample)
      .then((items) => {
        if (!alive) return;
        setProjects(items);
        setStack(history(items.find(p => p.id === requestedId) ?? items.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? newProject()));
      })
      .catch(() => {
        if (alive) {
          setStack(history(newProject(sample)));
          setMessage("ذخیره‌سازی مرورگر در دسترس نیست؛ فایل JSON را دریافت کنید.");
        }
      });
    return () => {
      alive = false;
    };
  }, [sample, requestedId]);
  const project = stack?.present ?? null;
  current.current = project;
  useEffect(() => {
    if (!project) return;
    const sequence = ++latest.current;
    setSaving(true);
    queue.current = queue.current
      .catch(() => undefined)
      .then(async () => {
        try {
          await saveProject(project);
          const items = await listProjects();
          if (sequence === latest.current) {
            setProjects(items);
            setMessage("");
          }
        } catch {
          if (sequence === latest.current)
            setMessage(
              "ذخیره نشد؛ فضای مرورگر یا دسترسی به ذخیره‌سازی را بررسی کنید و JSON بگیرید.",
            );
        } finally {
          if (sequence === latest.current) setSaving(false);
        }
      });
  }, [project]);
  const commit = useCallback((change: (p: StoryProject) => StoryProject, group = false) => {
    revision.current++;
    const now = Date.now();
    const coalesce = group && now - typing.current < 700;
    typing.current = group ? now : 0;
    setStack((h) => (h ? remember(h, { ...change(h.present), updatedAt: now }, coalesce) : h));
  }, []);
  const flush = useCallback(async () => {
    const snapshot = current.current;
    const version = revision.current;
    if (!snapshot) return true;
    const pending = queue.current.then(async () => {
      if (revision.current !== version) return false;
      await saveProject(snapshot);
      return revision.current === version;
    });
    // Serialize the explicit flush with autosaves; a newer edit must never be overwritten.
    queue.current = pending.then(() => undefined, () => undefined);
    try {
      if (!(await pending)) return false;
      if (revision.current !== version) return false;
      setMessage("");
      return true;
    } catch {
      setMessage("ذخیره نشد؛ پروژه باز می‌ماند. دوباره تلاش کنید یا JSON بگیرید.");
      return false;
    }
  }, []);
  const open = useCallback(async (p: StoryProject) => {
    if (switching.current) return false;
    switching.current = true;
    try {
      if (!(await flush())) return false;
      typing.current = 0;
      revision.current++;
      setStack(history(structuredClone(p)));
      return true;
    } finally { switching.current = false; }
  }, [flush]);
  const remove = async () => {
    if (!project) return;
    if (!(await flush())) throw new Error("ذخیره نشد؛ حذف متوقف شد.");
    await deleteProject(project.id);
    const items = await listProjects();
    setProjects(items);
    revision.current++;
    setStack(history(items[0] ?? newProject()));
  };
  return {
    project,
    projects,
    message,
    saving,
    commit,
    open,
    remove,
    flush,
    setText: (text: string) => commit((p) => changeText(p, text), true),
    undo: () => {
      revision.current++;
      typing.current = 0;
      setStack((h) => (h ? undo(h) : h));
    },
    redo: () => {
      revision.current++;
      typing.current = 0;
      setStack((h) => (h ? redo(h) : h));
    },
    canUndo: !!stack?.past.length,
    canRedo: !!stack?.future.length,
  };
}
