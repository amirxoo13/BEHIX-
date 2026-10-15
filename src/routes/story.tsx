import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fa } from "@/studio/format";
import { makePaper } from "@/studio/stick/paper";
import { PLACES, PLACE_IDS } from "@/studio/stick/places";
import { cuesToSrt, directStory, type Directed } from "@/studio/stick/story-direct";
import { canExportMp4, exportStoryFilm, type StoryFilm } from "@/studio/stick/story-export";
import { parseStory } from "@/studio/stick/story-parse";
import { FRAME, renderStory } from "@/studio/stick/story-render";

export const Route = createFileRoute("/story")({ component: StoryPage });

const STORE = "behix-story-v1";

const SAMPLE = `صحنه ۱: پذیرایی خانه، شب
علی (مرد، سمت راست، عینکی) و سارا (زن، سمت چپ، روسری) روی مبل نشسته‌اند. سارا چای در دست دارد.
علی با گوشی ور می‌رود و لبخند می‌زند.
سارا (عصبانی): باز هم گوشی؟! از وقتی اومدی خونه سرت توی اون گوشیه.
علی (شوکه): نه عزیزم، داشتم ساعت رو نگاه می‌کردم.
سارا دست به سینه می‌شود و قهر می‌کند.
پسر (بچه) وارد می‌شود و به طرف علی می‌رود.
پسر (با ذوق): بابا، توپم کو؟
علی فکر می‌کند.

صحنه ۲: داخل ماشین، روز
علی پشت فرمان نشسته و سارا کنارش نشسته.
راوی: فردای آن روز...
سارا (نگران): علی، آروم‌تر برو!
علی می‌خندد.`;

const KIND_FA = { man: "مرد", woman: "زن", boy: "پسربچه", girl: "دختربچه", oldMan: "پیرمرد", oldWoman: "پیرزن" } as const;

function loadStory(): string {
  try {
    return localStorage.getItem(STORE) ?? SAMPLE;
  } catch {
    return SAMPLE;
  }
}

function saveStory(text: string) {
  try {
    localStorage.setItem(STORE, text);
  } catch {
    /* حالت خصوصی مرورگر: فقط ذخیره نمی‌شود */
  }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

const clock = (sec: number) => {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  return `${fa(m)}:${fa(Math.floor(s % 60)).padStart(2, "۰")}`;
};

function StoryPage() {
  const [text, setText] = useState(SAMPLE);
  const [ready, setReady] = useState(false);
  const [directed, setDirected] = useState<Directed | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setText(loadStory());
    setReady(true);
  }, []);

  // ساخت دوباره با کمی تأخیر بعد از تایپ
  useEffect(() => {
    if (!ready) return;
    saveStory(text);
    const id = setTimeout(() => {
      try {
        setDirected(directStory(parseStory(text)));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }, 450);
    return () => clearTimeout(id);
  }, [text, ready]);

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="topbar">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src="/brand/app-icon.png" alt="" className="brand-mark" />
          <span className="min-w-0">
            <img src="/brand/wordmark.png" alt="BEHIX" className="brand-word" />
            <span className="mt-1 block truncate text-sm text-muted">داستان به فیلم</span>
          </span>
        </Link>
      </header>
      <main className="story-page">
        <section className="story-editor" aria-labelledby="story-title">
          <h1 id="story-title" className="text-xl font-bold">
            داستان را بنویسید، فیلم ساخته می‌شود
          </h1>
          <p className="mt-2 text-sm leading-7 text-muted">
            هر صحنه با «صحنه: مکان، شب/روز» شروع می‌شود. شخصیت‌ها را بار اول با پرانتز معرفی کنید، دیالوگ را با «اسم (حالت): جمله» بنویسید. فیلم بی‌صداست؛ زیرنویس زمان‌دار
            دیالوگ‌ها برای صداپیشه آماده می‌شود.
          </p>
          <label className="lbl" htmlFor="story">
            سناریو
          </label>
          <textarea
            id="story"
            className="field story-text"
            dir="rtl"
            value={text}
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setText(SAMPLE)}>
              نمونهٔ آماده
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setText("")}>
              پاک کردن
            </button>
          </div>
          {error && (
            <p role="alert" className="story-warn mt-3">
              {error}
            </p>
          )}
          {directed && <Understood directed={directed} />}
          <Guide />
        </section>
        <section className="story-player" aria-label="پیش‌نمایش فیلم">
          {directed ? <Player directed={directed} /> : <div className="story-canvas-box" />}
        </section>
      </main>
    </div>
  );
}

/** آنچه سیستم از داستان فهمید: شخصیت‌ها، صحنه‌ها و هشدارها. */
function Understood({ directed }: { directed: Directed }) {
  const { timeline, warnings } = directed;
  return (
    <div className="mt-4 grid gap-3">
      {warnings.length > 0 && (
        <ul className="story-warn" aria-label="هشدارها">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
      <div className="panel">
        <p className="lbl !mt-0">شخصیت‌ها</p>
        <ul className="flex flex-wrap gap-2">
          {timeline.cast.length === 0 && <li className="text-sm text-muted">هنوز کسی نیست.</li>}
          {timeline.cast.map((c) => (
            <li key={c.id} className="story-chip">
              <b>{c.name}</b> · {KIND_FA[c.look.kind]}
              {c.look.glasses ? " · عینکی" : ""}
            </li>
          ))}
        </ul>
        <p className="lbl">صحنه‌ها</p>
        <ol className="grid gap-1 text-sm">
          {timeline.scenes.map((s, i) => (
            <li key={`${i}-${s.start}`}>
              {fa(i + 1)}. {PLACES[s.place].label} · {s.night ? "شب" : "روز"} · {fa(Number((s.end - s.start).toFixed(1)))} ثانیه
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Guide() {
  return (
    <details className="panel mt-3 text-sm leading-7">
      <summary className="cursor-pointer font-bold">راهنمای نوشتن</summary>
      <ul className="mt-2 grid gap-1 text-muted">
        <li>
          <b className="text-fg">مکان‌ها:</b> {PLACE_IDS.filter((p) => p !== "blank").map((p) => PLACES[p].label).join("، ")}
        </li>
        <li>
          <b className="text-fg">زمان:</b> شب، روز، صبح، عصر، غروب
        </li>
        <li>
          <b className="text-fg">معرفی:</b> «مریم (زن، سمت چپ، عینکی)»، «پدربزرگ (سمت راست)»، «پسر (بچه)»؛ سمت چپ و راست از دید بیننده است.
        </li>
        <li>
          <b className="text-fg">ظاهر:</b> عینکی، سبیل، ریش، کلاه، روسری، موی بلند، دم‌اسبی، فرفری، کچل
        </li>
        <li>
          <b className="text-fg">کارها:</b> می‌نشیند، بلند می‌شود، وارد می‌شود، بیرون می‌رود، به طرف ... می‌رود، دست به سینه، دست به کمر، دست تکان می‌دهد، اشاره می‌کند، فکر
          می‌کند، با تلفن صحبت می‌کند، شانه بالا می‌اندازد، هورا، می‌پرد، شوت می‌زند، رانندگی، می‌خورد، می‌نویسد
        </li>
        <li>
          <b className="text-fg">در دست:</b> گوشی، چای/قهوه، کتاب، کیف، توپ، دسته گل، شیرینی
        </li>
        <li>
          <b className="text-fg">حالت چهره:</b> لبخند، می‌خندد، ذوق، پوزخند، عصبانی، فریاد، قهر، ناراحت، گریه، تعجب، شوکه، نگران، می‌ترسد، آرام، چپ‌چپ، کلافه، خجالت،
          خواب‌آلود
        </li>
        <li>
          <b className="text-fg">راوی:</b> «راوی: ...» فقط زیرنویس می‌شود و کسی دهانش تکان نمی‌خورد.
        </li>
      </ul>
    </details>
  );
}

function Player({ directed }: { directed: Directed }) {
  const { timeline } = directed;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paper = useMemo(() => (typeof document === "undefined" ? null : makePaper(FRAME.w, FRAME.h, 7)), []);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [fontReady, setFontReady] = useState(false);
  const tRef = useRef(0);
  const duration = timeline.duration;

  useEffect(() => {
    let alive = true;
    (document.fonts?.load("800 60px Vazirmatn") ?? Promise.resolve())
      .catch(() => undefined)
      .then(() => alive && setFontReady(true));
    return () => {
      alive = false;
    };
  }, []);

  const draw = useCallback(
    (time: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !paper) return;
      renderStory(ctx, timeline, Math.min(time, Math.max(0, duration - 0.001)), paper, { captions });
    },
    [timeline, paper, captions, duration],
  );

  // داستان عوض شد: اگر زمان فعلی از فیلم بیرون است برگرد اول
  useEffect(() => {
    if (tRef.current > duration) {
      tRef.current = 0;
      setT(0);
    }
    draw(tRef.current);
  }, [draw, duration, fontReady]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const start = performance.now() - tRef.current * 1000;
    const tick = (now: number) => {
      const time = (now - start) / 1000;
      if (time >= duration) {
        tRef.current = duration;
        setT(duration);
        draw(duration);
        setPlaying(false);
        return;
      }
      tRef.current = time;
      draw(time);
      setT(time);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, draw, duration]);

  const toggle = () => {
    if (!playing && tRef.current >= duration - 0.05) {
      tRef.current = 0;
      setT(0);
    }
    setPlaying((p) => !p);
  };

  return (
    <div className="grid gap-3">
      <div className="story-canvas-box">
        <canvas ref={canvasRef} width={FRAME.w} height={FRAME.h} className="story-canvas" aria-label="فیلم" onClick={toggle} />
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className="btn btn-primary min-w-24" onClick={toggle}>
          {playing ? "توقف" : "پخش"}
        </button>
        <input
          type="range"
          className="story-range"
          min={0}
          max={duration}
          step={0.01}
          value={t}
          aria-label="زمان فیلم"
          onChange={(e) => {
            const v = Number(e.target.value);
            setPlaying(false);
            tRef.current = v;
            setT(v);
            draw(v);
          }}
        />
        <span className="latin text-sm tabular-nums text-muted" dir="ltr">
          {clock(t)} / {clock(duration)}
        </span>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={captions} onChange={(e) => setCaptions(e.target.checked)} />
        نمایش زیرنویس روی تصویر
      </label>
      <Exporter directed={directed} captions={captions} />
    </div>
  );
}

function Exporter({ directed, captions }: { directed: Directed; captions: boolean }) {
  const [fps, setFps] = useState<30 | 60>(30);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [film, setFilm] = useState<StoryFilm | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [fast, setFast] = useState<boolean | null>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    void canExportMp4(fps).then((ok) => alive && setFast(ok));
    return () => {
      alive = false;
    };
  }, [fps]);

  // داستان یا تنظیم عوض شد ← فیلم قبلی دیگر مال این داستان نیست
  useEffect(() => {
    setFilm(null);
  }, [directed, captions, fps]);

  const run = async () => {
    setBusy(true);
    setMessage(null);
    setFilm(null);
    setProgress(0);
    const ctrl = new AbortController();
    abort.current = ctrl;
    try {
      const result = await exportStoryFilm(directed.timeline, { fps, captions, onProgress: setProgress, signal: ctrl.signal });
      setFilm(result);
      setMessage(result.notice);
    } catch (err) {
      setMessage(err instanceof DOMException && err.name === "AbortError" ? "ساخت فیلم لغو شد." : err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  const srt = () => download(new Blob(["\uFEFF", cuesToSrt(directed.cues)], { type: "application/x-subrip;charset=utf-8" }), "behix-dialogue.srt");

  return (
    <div className="panel grid gap-3">
      <p className="font-bold">خروجی</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">نرمی حرکت:</span>
        {([30, 60] as const).map((f) => (
          <button key={f} type="button" className={`btn ${fps === f ? "btn-on" : "btn-ghost"}`} aria-pressed={fps === f} disabled={busy} onClick={() => setFps(f)}>
            {fa(f)} فریم
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {busy ? (
          <button type="button" className="btn btn-danger" onClick={() => abort.current?.abort()}>
            لغو ({fa(Math.round(progress * 100))}٪)
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={run} disabled={directed.timeline.duration <= 0}>
            ساخت فیلم بی‌صدا (۱۰۸۰×۱۹۲۰)
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={srt} disabled={directed.cues.length === 0}>
          زیرنویس برای صداپیشه (SRT)
        </button>
      </div>
      {busy && (
        <div className="story-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      {fast === false && !busy && <p className="text-sm text-muted">این مرورگر رمزگذار سریع ندارد؛ فیلم زنده و به اندازهٔ طولش ضبط می‌شود.</p>}
      {film && (
        <button type="button" className="btn btn-on" onClick={() => download(film.blob, `behix-story.${film.ext}`)}>
          دانلود فیلم ({film.ext.toUpperCase()}، {fa(Number((film.blob.size / 1e6).toFixed(1)))} مگابایت)
        </button>
      )}
      {message && <p className="text-sm text-muted">{message}</p>}
      <p className="text-sm leading-6 text-muted">
        زیرنویس SRT زمان دقیق هر دیالوگ، اسم گوینده و حالتش را دارد تا صداپیشه روی همان زمان‌ها صدا بگذارد. در CapCut یا Premiere فیلم و صدا را روی هم بگذارید.
      </p>
    </div>
  );
}
