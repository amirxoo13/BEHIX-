import { useEffect, useRef, useState } from "react";
import { Music, Play, Square, Trash2 } from "lucide-react";
import type { StoryProject } from "@/studio/stick/project";
import { readArtifact, saveArtifact } from "@/studio/stick/project-db";
import { API_BASE, audioContext } from "@/studio/stick/voice-client";
import { musicPlacement, type MusicPlacement } from "@/studio/v2/mix";
import { fa } from "@/studio/format";

/**
 * موسیقی پس‌زمینه با Lyria (سمت سرور: /api/music). یک توضیح کوتاه صحنه (فارسی هم می‌شود) + طول؛
 * سرور با Gemini و مهارت music.cue پرامپت انگلیسی سازی می‌سازد. قطعه در IndexedDB (`music:<sha>`) و جای آن در
 * project.settings.music (همان MusicPlacement مدل FilmMix) ذخیره می‌شود. اگر Lyria روی سرور خاموش باشد، پنل غیرفعال است.
 */
const MOODS: { id: string; label: string }[] = [
  { id: "", label: "خودکار" }, { id: "calm", label: "آرام" }, { id: "happy", label: "شاد" }, { id: "playful", label: "بازیگوش" },
  { id: "tense", label: "پرتنش" }, { id: "sad", label: "غمگین" }, { id: "mysterious", label: "مرموز" }, { id: "romantic", label: "عاشقانه" },
  { id: "epic", label: "حماسی" }, { id: "funny", label: "خنده‌دار" }, { id: "hopeful", label: "امیدوار" },
];
const MAX = 184;

type Status = { enabled: boolean } | null;

export function MusicPanel({ project, duration, at, commit }: {
  project: StoryProject;
  duration: number;
  /** زمان فعلی پخش‌کننده (ثانیه): قطعهٔ تازه از همین‌جا شروع می‌شود. */
  at: () => number;
  commit: (f: (p: StoryProject) => StoryProject) => void;
}) {
  const [status, setStatus] = useState<Status>(null);
  const [brief, setBrief] = useState("");
  const [mood, setMood] = useState("");
  const [seconds, setSeconds] = useState(() => Math.max(5, Math.min(MAX, Math.round(duration) || 30)));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const cues = project.settings.music ?? [];

  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE}/api/music?status=1`)
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((s: { enabled?: boolean }) => alive && setStatus({ enabled: s.enabled === true }))
      .catch(() => alive && setStatus({ enabled: false }));
    return () => {
      alive = false;
      audio.current?.pause();
    };
  }, []);

  const make = async () => {
    if (busy || brief.trim().length < 2) return;
    setBusy(true);
    setNote("در حال ساخت موسیقی… (ممکن است تا یک دقیقه طول بکشد)");
    try {
      const r = await fetch(`${API_BASE}/api/music`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ brief: brief.trim(), seconds, ...(mood ? { mood } : {}) }) });
      const j = (await r.json().catch(() => null)) as { audioUrl?: string; prompt?: string; message?: string } | null;
      if (!r.ok || !j?.audioUrl) throw new Error(j?.message ?? `خطای سرور موسیقی (${r.status})`);
      const sha = /clip=([0-9a-f]{64})\.mp3/.exec(j.audioUrl)?.[1];
      if (!sha) throw new Error("پاسخ سرور موسیقی ناقص بود.");
      const a = await fetch(/^https?:/.test(j.audioUrl) ? j.audioUrl : `${API_BASE}${j.audioUrl}`);
      if (!a.ok) throw new Error(`دریافت موسیقی انجام نشد (${a.status})`);
      const blob = await a.blob();
      const buf = await audioContext().decodeAudioData(await blob.arrayBuffer());
      const src = `music:${sha}`;
      await saveArtifact({ id: src, name: `${brief.trim().slice(0, 30)}.mp3`, blob });
      const place = musicPlacement(`cue-${Date.now().toString(36)}`, src, buf.duration, at(), duration, j.prompt);
      commit((p) => ({ ...p, settings: { ...p.settings, music: [...(p.settings.music ?? []), place].slice(-8) } }));
      setNote(`موسیقی ${fa(Math.round(buf.duration))} ثانیه‌ای ساخته شد و از ثانیهٔ ${fa(Math.round(place.start))} روی فیلم قرار گرفت. زیر دیالوگ‌ها خودکار آرام می‌شود.`);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "ساخت موسیقی انجام نشد.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (c: MusicPlacement) => {
    audio.current?.pause();
    if (playing === c.id) return setPlaying(null);
    const a = await readArtifact(c.src).catch(() => null);
    if (!a) return setNote("فایل این موسیقی روی این دستگاه نیست.");
    const url = URL.createObjectURL(a.blob);
    const el = new Audio(url);
    el.onended = el.onpause = () => {
      URL.revokeObjectURL(url);
      setPlaying((p) => (p === c.id ? null : p));
    };
    audio.current = el;
    setPlaying(c.id);
    void el.play().catch(() => setPlaying(null));
  };
  const remove = (id: string) => commit((p) => ({ ...p, settings: { ...p.settings, music: (p.settings.music ?? []).filter((c) => c.id !== id) } }));

  const off = status !== null && !status.enabled;
  return (
    <div className="voice-panel music-panel" dir="rtl">
      <div className="voice-head">
        <Music size={18} aria-hidden />
        <span>
          <b>موسیقی پس‌زمینه</b>
          <small>{status === null ? "در حال بررسی سرور…" : off ? "ساخت موسیقی روی این سرور فعال نیست." : `Lyria · فقط سازی · حداکثر ${fa(MAX)} ثانیه`}</small>
        </span>
      </div>
      {off ? (
        <p className="hint">برای فعال شدن، مدیر سرور باید LYRIA_MODEL و فضای ذخیره را تنظیم کند (راهنمای self-host).</p>
      ) : (
        <fieldset className="music-form" disabled={busy || status === null}>
          <label>
            <span>حال‌وهوای صحنه</span>
            <textarea rows={2} maxLength={600} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="مثلاً: تعقیب و گریز شاد در بازار تجریش" />
          </label>
          <div className="music-row">
            <label>
              <span>حس</span>
              <select value={mood} onChange={(e) => setMood(e.target.value)}>{MOODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
            </label>
            <label>
              <span>طول: {fa(seconds)} ثانیه</span>
              <input type="range" min={5} max={MAX} step={1} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} />
            </label>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => void make()} disabled={brief.trim().length < 2}>
            <Music size={16} aria-hidden /> {busy ? "در حال ساخت…" : "ساخت موسیقی"}
          </button>
        </fieldset>
      )}
      {cues.length > 0 && (
        <ul className="music-list">
          {cues.map((c) => (
            <li key={c.id}>
              <button type="button" className="btn btn-ghost btn-sm" aria-label={playing === c.id ? "توقف" : "پخش"} onClick={() => void toggle(c)}>{playing === c.id ? <Square size={16} /> : <Play size={16} />}</button>
              <span>از {fa(Math.round(c.start))} تا {fa(Math.round(c.start + c.duration))} ثانیه</span>
              <button type="button" className="btn btn-ghost btn-sm" aria-label="حذف" onClick={() => remove(c.id)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      {note && <p className="hint" role="status">{note}</p>}
    </div>
  );
}
