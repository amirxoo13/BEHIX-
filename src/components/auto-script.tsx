import { useEffect, useState } from "react";
import { getScriptAiStatus, understandScript, type ScriptAiStatus } from "@/lib/script-ai";
import { autoLayout, type AutoMethod, type AutoResult } from "@/studio/auto-layout";
import {
  ACTION_ENTRIES,
  BACKGROUNDS,
  CHARACTERS,
  EMOTION_ENTRIES,
  SFX_ENTRIES,
  type Entry,
} from "@/studio/catalog";
import { findChar } from "@/studio/characters";
import { fa } from "@/studio/format";
import { EMOTIONS, WORLD } from "@/studio/labels";
import { MAX_SCRIPT_CHARS } from "@/studio/script-plan";
import { useStudio } from "@/studio/store";

const DRAFT_KEY = "behix-auto-script-draft";

const SAMPLE = `قهوه‌خانه، شب
پرویز وارد می‌شود، استکان در دست. پهلوان اژدر با تعجب نگاهش می‌کند.
پرویز: سلام پهلوان! (خندان، اشاره)
پهلوان: دیر کردی. (اخم، دست به کمر)

آشپزخانه ۲، صبح
سارا: کجا می‌روی؟ (گریه)
کیان: من هم میام!`;

function readDraft(): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeDraft(text: string) {
  try {
    sessionStorage.setItem(DRAFT_KEY, text);
  } catch {
    // ذخیرهٔ پیش‌نویس فقط یک راحتی است؛ نبودنش کار را خراب نمی‌کند.
  }
}

function names<T extends string>(entries: Entry<T>[]) {
  return entries
    .filter((e) => e.aliases.length > 0)
    .map((e) => e.aliases.map((a) => a.replace(/\*$/, "…")).join("، "))
    .join(" / ");
}

export function AutoScript() {
  const busy = useStudio((s) => s.playing || s.exporting || s.booting);
  const locked = useStudio((s) => s.storageLocked);
  const [script, setScript] = useState("");
  const [method, setMethod] = useState<AutoMethod>("smart");
  const [ai, setAi] = useState<ScriptAiStatus | null>(null);
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<AutoResult | null>(null);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState("");

  useEffect(() => {
    setScript(readDraft());
    getScriptAiStatus()
      .then(setAi)
      .catch(() => setAi({ configured: false, model: null }));
  }, []);

  const run = async () => {
    setWorking(true);
    setError("");
    setApplied("");
    setResult(null);
    try {
      const callModel = ai?.configured ? (text: string) => understandScript({ data: { script: text } }) : null;
      const r = await autoLayout(script, method, callModel);
      if (r.shots.length === 0) setError("در این متن هیچ دیالوگ یا توضیح صحنه‌ای پیدا نشد.");
      else setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "چیدن خودکار انجام نشد.");
    } finally {
      setWorking(false);
    }
  };

  const apply = () => {
    if (!result) return;
    if (!window.confirm(`همهٔ نماهای فعلی با ${fa(result.shots.length)} نمای تازه جایگزین شوند؟ صداهای ضبط‌شده هم پاک می‌شوند.`)) {
      return;
    }
    if (useStudio.getState().replaceShots(result.shots)) {
      setApplied(`${fa(result.shots.length)} نما جایگزین شد. هر نما را می‌توانید پایین‌تر ویرایش کنید.`);
      setResult(null);
    } else {
      setError("پروژه هنوز در حال بارگذاری است؛ چند لحظه بعد دوباره امتحان کنید.");
    }
  };

  const emotionLabel = (id: string) => EMOTIONS.find((e) => e.id === id)?.label ?? id;

  return (
    <section className="panel mx-auto mb-6 max-w-2xl" aria-labelledby="auto-title">
      <p className="kicker latin">AUTO LAYOUT</p>
      <h2 id="auto-title" className="mt-1 text-lg font-bold">
        چیدن خودکار از روی سناریو
      </h2>
      <p className="mt-1 text-sm text-muted">
        کل سناریو را بنویسید. هر صحنه با اسم مکان و زمان شروع شود (مثلاً «آشپزخانه، شب»)؛ شمارهٔ بعد از اسم مکان،
        طرح آن را انتخاب می‌کند («آشپزخانه ۲»). هر دیالوگ به شکل «اسم: جمله» و حالت یا حرکت داخل پرانتز.
        خط‌های دیگر توضیح صحنه‌اند.
      </p>

      <label className="lbl" htmlFor="auto-script">
        متن سناریو
      </label>
      <textarea
        id="auto-script"
        className="field"
        rows={10}
        dir="rtl"
        value={script}
        maxLength={MAX_SCRIPT_CHARS}
        placeholder={SAMPLE}
        disabled={working}
        onChange={(e) => {
          setScript(e.target.value);
          writeDraft(e.target.value);
        }}
      />
      <div className="mt-1 flex justify-between text-xs text-muted">
        <button
          type="button"
          className="underline"
          disabled={working}
          onClick={() => {
            setScript(SAMPLE);
            writeDraft(SAMPLE);
          }}
        >
          گذاشتن نمونه
        </button>
        <span>
          {fa(script.length)} / {fa(MAX_SCRIPT_CHARS)}
        </span>
      </div>

      <fieldset className="mt-3">
        <legend className="lbl">روش فهم متن</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name="auto-method" checked={method === "smart"} onChange={() => setMethod("smart")} />
          هوشمند: اول دیکشنری، مدل فقط اگر لازم شد (کم‌مصرف)
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="auto-method"
            checked={method === "dictionary"}
            onChange={() => setMethod("dictionary")}
          />
          فقط دیکشنری (بدون هوش مصنوعی، رایگان)
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input type="radio" name="auto-method" checked={method === "model"} onChange={() => setMethod("model")} />
          همیشه مدل زبانی
        </label>
        <p className="text-xs text-muted">
          {ai === null
            ? "در حال بررسی مدل زبانی…"
            : ai.configured
              ? `مدل فعال: ${ai.model}`
              : "مدل زبانی هنوز تنظیم نشده؛ فعلاً فقط دیکشنری کار می‌کند."}
        </p>
      </fieldset>

      <button
        type="button"
        className="btn btn-primary mt-3 w-full"
        disabled={working || busy || !script.trim()}
        onClick={() => void run()}
      >
        {working ? "در حال فهمیدن سناریو…" : "فهمیدن و چیدن"}
      </button>

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      {applied && (
        <p role="status" className="mt-3 text-sm text-cyan">
          {applied}
        </p>
      )}

      {result && (
        <div className="mt-4" aria-live="polite">
          <p className="font-bold">
            {fa(result.shots.length)} نما آماده شد — روش:{" "}
            {result.used === "model" ? `مدل زبانی (${result.model})` : "دیکشنری"}
          </p>
          <p className="text-sm text-muted">
            مصرف توکن این بار: {fa(result.usage.input + result.usage.output)}
            {result.usage.input + result.usage.output > 0 &&
              ` (ورودی ${fa(result.usage.input)}، خروجی ${fa(result.usage.output)})`}
          </p>
          {result.warnings.length > 0 && (
            <ul className="mt-2 list-disc ps-5 text-sm text-muted">
              {result.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <ol className="sheet mt-3">
            {result.shots.map((s, i) => {
              const who = s.speaker === "a" ? s.actorA : s.speaker === "b" ? s.actorB : null;
              return (
                <li key={s.id} className="sheet-row">
                  <span className="latin text-cyan">{fa(i + 1)}</span>
                  <span>
                    <span className="block text-sm text-muted">
                      {WORLD[s.background].place} ({WORLD[s.background].variants[s.variant]}، {s.night ? "شب" : "روز"}) · {[s.actorA, s.actorB, ...s.extras].map((x) => findChar(x.charId).name).join("، ")}
                    </span>
                    <span className="block">
                      {who ? `${findChar(who.charId).name} (${emotionLabel(who.emotion)}): ${s.dialogue}` : s.actionLine}
                    </span>
                  </span>
                  <span className="latin text-xs text-muted">{fa(s.duration)}s</span>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={apply}>
              جایگزینی نماهای فعلی
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setResult(null)}>
              لغو
            </button>
          </div>
          {locked && (
            <p className="mt-2 text-sm text-danger">ذخیره‌سازی قفل است؛ نماهای تازه بعد از بستن صفحه نمی‌مانند.</p>
          )}
        </div>
      )}

      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-muted">کلمه‌هایی که دیکشنری می‌شناسد</summary>
        <dl className="mt-2 space-y-2">
          <dt className="font-bold">شخصیت‌ها</dt>
          <dd className="text-muted">{names(CHARACTERS)}</dd>
          <dt className="font-bold">مکان‌ها</dt>
          <dd className="text-muted">{names(BACKGROUNDS)}</dd>
          <dt className="font-bold">حالت چهره</dt>
          <dd className="text-muted">{names(EMOTION_ENTRIES)}</dd>
          <dt className="font-bold">حرکت</dt>
          <dd className="text-muted">{names(ACTION_ENTRIES)}</dd>
          <dt className="font-bold">صدا</dt>
          <dd className="text-muted">{names(SFX_ENTRIES)}</dd>
        </dl>
      </details>
    </section>
  );
}
