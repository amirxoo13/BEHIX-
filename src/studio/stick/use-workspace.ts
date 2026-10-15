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
export function useStoryWorkspace(sample: string) {
  const [stack, setStack] = useState<History<StoryProject> | null>(null);
  const [projects, setProjects] = useState<StoryProject[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const queue = useRef(Promise.resolve());
  const latest = useRef(0);
  const typing = useRef(0);
  useEffect(() => {
    let alive = true;
    void migrateLegacy(sample)
      .then((items) => {
        if (!alive) return;
        setProjects(items);
        setStack(history(items.sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? newProject()));
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
  }, [sample]);
  const project = stack?.present ?? null;
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
    const now = Date.now();
    const coalesce = group && now - typing.current < 700;
    typing.current = group ? now : 0;
    setStack((h) => (h ? remember(h, { ...change(h.present), updatedAt: now }, coalesce) : h));
  }, []);
  const open = useCallback((p: StoryProject) => {
    typing.current = 0;
    setStack(history(structuredClone(p)));
  }, []);
  const remove = async () => {
    if (!project) return;
    await queue.current;
    await deleteProject(project.id);
    const items = await listProjects();
    setProjects(items);
    open(items[0] ?? newProject());
  };
  return {
    project,
    projects,
    message,
    saving,
    commit,
    open,
    remove,
    setText: (text: string) => commit((p) => changeText(p, text), true),
    undo: () => {
      typing.current = 0;
      setStack((h) => (h ? undo(h) : h));
    },
    redo: () => {
      typing.current = 0;
      setStack((h) => (h ? redo(h) : h));
    },
    canUndo: !!stack?.past.length,
    canRedo: !!stack?.future.length,
  };
}
