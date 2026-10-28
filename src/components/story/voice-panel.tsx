import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { setEdit, type StoryProject } from "@/studio/stick/project";
import type { Directed } from "@/studio/stick/story-direct";
import { defaultVoices, lineDurationFor, placeVoices, type Voice, type VoiceClip } from "@/studio/stick/voice";
import { lineJobs, loadClips, synthesize, type LineJob } from "@/studio/stick/voice-client";
import { fa } from "@/studio/format";

/** وضعیت صداگذاری پروژه: صدای هر شخصیت، کلیپ‌های موجود و ساخت کلیپ‌های تازه. */
export function useVoices(project: StoryProject | null, directed: Directed | null, commit: (f: (p: StoryProject) => StoryProject, group?: boolean | "silent") => void) {
  const cast = directed?.timeline.cast;
  const voices = useMemo(() => (cast ? defaultVoices(cast, project?.settings.voices) : {}), [cast, project?.settings.voices]);
  const [jobs, setJobs] = useState<LineJob[]>([]);
  const [clips, setClips] = useState<Map<string, VoiceClip>>(new Map());
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!directed || !cast) return;
    let alive = true;
    const looks = Object.fromEntries(cast.map((c) => [c.id, c.look]));
    void lineJobs(directed, voices, looks)
      .then(async (j) => {
        const loaded = await loadClips(j);
        if (!alive) return;
        setJobs(j);
        setClips(loaded);
        // کلیپ از قبل ذخیره‌شده (مثلاً همان جمله در دیالوگ تازه): مدت دیالوگ اندازهٔ صدایش می‌شود،
        // مگر کاربر خودش مدت را انتخاب کرده باشد. مقایسه با ویرایش ذخیره‌شده است (نه طول نهایی بخش) تا حلقه نشود
        // و اصلاح خودکار مرحلهٔ واگرد نمی‌سازد تا واگرد/ازنو را به‌هم نزند.
        const fixes = [...loaded].filter(([id, c]) => {
          const saved = project?.edits.find((e) => !e.unresolved && e.beatId === id && e.actor === undefined);
          return saved?.duration === undefined || (saved.fit === true && Math.abs(saved.duration - fitted(c)) > 0.05);
        });
        if (fixes.length) commit((p) => fitAll(p, fixes), "silent");
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [directed, cast, voices]); // eslint-disable-line react-hooks/exhaustive-deps -- project.edits is read once per compile
  useEffect(() => () => abort.current?.abort(), []);

  const voiced = useMemo(() => (directed ? placeVoices(directed, clips) : null), [directed, clips]);
  const missing = jobs.filter((j) => !clips.has(j.beatId));

  const generate = useCallback(async () => {
    if (busy || !missing.length) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setBusy(true);
    setDone(0);
    setError("");
    try {
      const { made, error: failed } = await synthesize(missing, setDone, ctrl.signal);
      // کلیپ‌های ساخته‌شده حتی اگر یکی خطا داد یا لغو شد نگه داشته می‌شوند؛
      // مدت هر دیالوگ به اندازهٔ صدای واقعی تا لب‌خوانی و زمان‌بندی دقیق شود
      if (made.size) {
        setClips((old) => new Map([...old, ...made]));
        commit((p) => fitAll(p, [...made]), "silent");
      }
      if (failed !== undefined && !(failed instanceof DOMException && failed.name === "AbortError")) setError(failed instanceof Error ? failed.message : String(failed));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }, [busy, missing, commit]);

  const setVoice = (castId: string, voice: Voice) => commit((p) => ({ ...p, settings: { ...p.settings, voices: { ...p.settings.voices, [castId]: voice } } }));
  return { voices, setVoice, jobs, missing: missing.length, voiced, generate, busy, done, error, cancel: () => abort.current?.abort() };
}

export type Voicing = ReturnType<typeof useVoices>;

const fitted = (c: VoiceClip) => lineDurationFor(c.samples.length / c.sampleRate);
const fitAll = (p: StoryProject, clips: [string, VoiceClip][]) => clips.reduce((acc, [beatId, c]) => setEdit(acc, beatId, { duration: fitted(c), fit: true }), p);

/** نوار صداگذاری: تعداد دیالوگ‌های بی‌صدا، ساخت و پیشرفت. */
export function VoicePanel({ v }: { v: Voicing }) {
  if (!v.jobs.length) return <p className="studio-empty">برای صداگذاری، داستان باید دیالوگ داشته باشد.</p>;
  const total = v.jobs.length, ready = total - v.missing;
  return (
    <div className="voice-panel">
      <div className="voice-head">
        <Mic size={18} aria-hidden />
        <span>
          <b>صدای دیالوگ‌ها</b>
          <small>{fa(ready)} از {fa(total)} دیالوگ صدا دارد · Gemini TTS فارسی</small>
        </span>
      </div>
      {v.busy ? (
        <>
          <div className="story-progress" role="progressbar" aria-valuemin={0} aria-valuemax={v.missing} aria-valuenow={v.done}><span style={{ width: `${(v.done / Math.max(1, v.missing)) * 100}%` }} /></div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={v.cancel}>لغو ({fa(v.done)}/{fa(v.missing)})</button>
        </>
      ) : v.missing > 0 ? (
        <button type="button" className="btn btn-primary" onClick={() => void v.generate()}><Mic size={16} aria-hidden /> ساخت صدای {fa(v.missing)} دیالوگ</button>
      ) : (
        <p className="hint">همهٔ دیالوگ‌ها صدا دارند. با تغییر متن، صدا یا حالت، فقط همان دیالوگ دوباره ساخته می‌شود.</p>
      )}
      {v.error && <p role="alert" className="story-warn">{v.error}</p>}
    </div>
  );
}
