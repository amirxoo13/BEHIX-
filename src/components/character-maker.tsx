import { Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { MAX_CUSTOM } from "@/studio/characters";
import { drawActor, preloadHeads } from "@/studio/draw-actor";
import { fa } from "@/studio/format";
import { contentBox, fitSize, hasTransparency, isFlatBorder, removeFlatBackground, sampleSkin, type Pixels, type Pt } from "@/studio/head-image";
import { poseFront } from "@/studio/rig";
import { useStudio } from "@/studio/store";
import type { Build, CharacterDef, Viseme } from "@/studio/types";

const HEAD_MAX = 360;
const STEPS = ["mouth", "l", "r", "done"] as const;
type Step = (typeof STEPS)[number];

const STEP_TEXT: Record<Step, string> = {
  mouth: "۱. روی وسط دهانِ عکس بزنید.",
  l: "۲. روی وسط چشم سمت چپ تصویر بزنید (برای پلک زدن).",
  r: "۳. روی وسط چشم سمت راست تصویر بزنید.",
  done: "جای دهان و چشم‌ها مشخص شد. اگر جابه‌جا بود، «از اول» را بزنید.",
};

const HEIGHTS = [
  { v: 0.85, label: "کوتاه" },
  { v: 1, label: "معمولی" },
  { v: 1.1, label: "بلند" },
];
const BUILDS: { v: Build; label: string }[] = [
  { v: "slim", label: "لاغر" },
  { v: "normal", label: "معمولی" },
  { v: "heavy", label: "درشت" },
];

function newCustomId() {
  return `u-${Math.random().toString(36).slice(2, 10)}`;
}

/** فایل → تصویر کوچک‌شده با پس‌زمینهٔ شفاف و بریده‌شده دور سر. */
type Head = { src: string; aspect: number; pixels: Pixels; hadAlpha: boolean; flat: boolean };

async function prepareHead(file: File, removeBg: boolean): Promise<Head> {
  const bitmap = await createImageBitmap(file);
  const size = fitSize(bitmap.width, bitmap.height, HEAD_MAX * 2);
  const c = document.createElement("canvas");
  c.width = size.w;
  c.height = size.h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("پردازش تصویر در این مرورگر ممکن نیست.");
  ctx.drawImage(bitmap, 0, 0, size.w, size.h);
  bitmap.close();
  let px: Pixels = ctx.getImageData(0, 0, size.w, size.h);
  const hadAlpha = hasTransparency(px);
  // فقط پس‌زمینهٔ تقریباً یک‌رنگ حذف می‌شود؛ پس‌زمینهٔ شلوغ (عکس واقعی) دست نمی‌خورد.
  const flat = isFlatBorder(px);
  if (!hadAlpha && removeBg && flat) px = removeFlatBackground(px);
  const box = contentBox(px) ?? { x: 0, y: 0, w: size.w, h: size.h };
  const out = fitSize(box.w, box.h, HEAD_MAX);
  const crop = document.createElement("canvas");
  crop.width = box.w;
  crop.height = box.h;
  crop.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(px.data), size.w, size.h), -box.x, -box.y);
  const fin = document.createElement("canvas");
  fin.width = out.w;
  fin.height = out.h;
  const fctx = fin.getContext("2d", { willReadFrequently: true })!;
  fctx.drawImage(crop, 0, 0, out.w, out.h);
  const pixels = fctx.getImageData(0, 0, out.w, out.h);
  return { src: fin.toDataURL("image/png"), aspect: out.h / out.w, pixels, hadAlpha, flat };
}

/** ساخت شخصیت از عکس سر (مثلاً کارتونی‌شده در Canva). */
export function CharacterMaker() {
  const characters = useStudio((s) => s.characters);
  const busy = useStudio((s) => s.playing || s.exporting || s.booting);
  const [file, setFile] = useState<File | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [head, setHead] = useState<Head | null>(null);
  const [step, setStep] = useState<Step>("mouth");
  const [mouth, setMouth] = useState<Pt | null>(null);
  const [eyeL, setEyeL] = useState<Pt | null>(null);
  const [eyeR, setEyeR] = useState<Pt | null>(null);
  const [name, setName] = useState("");
  const [scale, setScale] = useState(1);
  const [build, setBuild] = useState<Build>("normal");
  const [size, setSize] = useState(110);
  const [shirt, setShirt] = useState("#3d6fb8");
  const [pants, setPants] = useState("#2c241c");
  const [shoe, setShoe] = useState("#3b2418");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [auto, setAuto] = useState("");
  const pickRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!file) return;
    let alive = true;
    setError("");
    prepareHead(file, removeBg)
      .then(async (h) => {
        if (!alive) return;
        setHead(h);
        setStep("mouth");
        setMouth(null);
        setEyeL(null);
        setEyeR(null);
        // تشخیص خودکار؛ اگر صورتی پیدا نشد کاربر با کلیک مشخص می‌کند.
        setAuto("در حال پیدا کردن خودکار دهان و چشم‌ها…");
        try {
          const { detectFace } = await import("@/studio/face-detect");
          const f = await detectFace(h.src);
          if (!alive) return;
          if (f) {
            setMouth(f.mouth);
            setEyeL(f.eyes.l);
            setEyeR(f.eyes.r);
            setStep("done");
            setAuto("دهان و چشم‌ها خودکار پیدا شد (دایره‌های رنگی). اگر درست نیست، «از اول» را بزنید و دستی کلیک کنید.");
          } else {
            setAuto("صورت خودکار پیدا نشد (در چهره‌های خیلی کارتونی پیش می‌آید)؛ لطفاً با کلیک مشخص کنید.");
          }
        } catch {
          if (alive) setAuto("تشخیص خودکار در این مرورگر کار نکرد؛ لطفاً با کلیک مشخص کنید.");
        }
      })
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : "این فایل خوانده نشد."));
    return () => {
      alive = false;
    };
  }, [file, removeBg]);

  const skin = head && mouth ? sampleSkin(head.pixels, mouth) : "#e0b07a";

  const draft: CharacterDef | null =
    head && mouth
      ? {
          id: "u-preview",
          name: name || "شخصیت تازه",
          skin,
          hair: "#1a1a1a",
          hairStyle: "bald",
          brow: "thick",
          facial: "none",
          shirt,
          pants,
          shoe,
          glasses: false,
          eyeBags: false,
          scale,
          build,
          head: {
            src: head.src,
            aspect: head.aspect,
            mouth,
            size,
            patch: skin,
            ...(eyeL && eyeR ? { eyes: { l: eyeL, r: eyeR } } : {}),
          },
        }
      : null;

  // تصویر انتخاب نقطه‌ها
  useEffect(() => {
    const c = pickRef.current;
    if (!c || !head) return;
    const img = new Image();
    img.onload = () => {
      const ctx = c.getContext("2d");
      if (!ctx) return;
      c.width = img.width;
      c.height = img.height;
      const cell = 12;
      for (let y = 0; y < c.height; y += cell) {
        for (let x = 0; x < c.width; x += cell) {
          ctx.fillStyle = (x / cell + y / cell) % 2 ? "#2a3350" : "#1d243a";
          ctx.fillRect(x, y, cell, cell);
        }
      }
      ctx.drawImage(img, 0, 0);
      const mark = (p: Pt | null, color: string) => {
        if (!p) return;
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x * c.width, p.y * c.height, 9, 0, Math.PI * 2);
        ctx.stroke();
      };
      mark(mouth, "#ff5c7a");
      mark(eyeL, "#3ec6ff");
      mark(eyeR, "#3ec6ff");
    };
    img.src = head.src;
  }, [head, mouth, eyeL, eyeR]);

  // پیش‌نمایش زنده: بدن کامل با دهان متحرک و پلک
  useEffect(() => {
    const c = previewRef.current;
    if (!c || !draft) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let alive = true;
    const visemes: Viseme[] = ["ah", "ee", "rest", "oo", "ah", "fv", "rest", "rest"];
    void preloadHeads([draft]).then(() => {
      const loop = (now: number) => {
        if (!alive) return;
        const t = now / 1000;
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.fillStyle = "#101628";
        ctx.fillRect(0, 0, c.width, c.height);
        const v = visemes[Math.floor(t * 5) % visemes.length];
        const blink = t % 3 < 0.15 ? 1 : 0;
        drawActor(
          ctx,
          draft,
          poseFront("idle", "neutral", 0, t, 1),
          { blink, viseme: v, open: v === "rest" ? 0 : 0.6, emotion: "neutral", env: 0 },
          c.width / 2,
          c.height - 16,
          1.15,
          1,
          false,
          "maker",
          1 / 60,
          "none",
          1,
        );
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => { if (alive) setError("تصویر شخصیت خوانده نشد؛ تصویر دیگری انتخاب کنید."); });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
    // draft در هر رندر ساخته می‌شود؛ وابستگی‌ها همان ورودی‌های آن است.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [head, mouth, eyeL, eyeR, scale, build, size, shirt, pants, shoe, skin]);

  const pick = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!head) return;
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    if (step === "mouth") {
      setMouth(p);
      setStep("l");
    } else if (step === "l") {
      setEyeL(p);
      setStep("r");
    } else if (step === "r") {
      // چشم «l» همیشه چشم سمت چپ تصویر است، به هر ترتیبی که کلیک شده باشد.
      if (eyeL && p.x < eyeL.x) {
        setEyeR(eyeL);
        setEyeL(p);
      } else setEyeR(p);
      setStep("done");
    }
  };

  const save = () => {
    if (!draft) return;
    const n = name.trim();
    if (!n) {
      setError("یک اسم برای شخصیت بنویسید (در سناریو با همین اسم صدا زده می‌شود).");
      return;
    }
    const def = { ...draft, id: newCustomId(), name: n };
    if (useStudio.getState().addCharacter(def)) {
      setSaved(`«${n}» ساخته شد و در کتابخانهٔ شخصیت هست. در سناریو بنویسید «${n}: …».`);
      setFile(null);
      setHead(null);
      setName("");
      setError("");
    } else {
      setError(`حداکثر ${fa(MAX_CUSTOM)} شخصیت سفارشی می‌شود ساخت.`);
    }
  };

  return (
    <section className="panel mt-6" aria-labelledby="maker-title">
      <p className="kicker latin">CUSTOM CHARACTER</p>
      <h2 id="maker-title" className="mt-1 text-lg font-bold">
        شخصیت تازه از عکس سر (مثلاً کارتونی Canva)
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        عکس سر را آپلود کنید (بهتر است PNG بدون پس‌زمینه باشد؛ اگر پس‌زمینهٔ یک‌رنگ دارد، خودکار حذف می‌شود).
        بعد جای دهان و دو چشم را با کلیک مشخص کنید تا موقع حرف زدن لب‌ها تکان بخورند و پلک بزند.
      </p>

      {characters.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {characters.map((c) => (
            <li key={c.id} className="btn btn-ghost">
              {c.head && <img src={c.head.src} alt="" className="size-7 object-contain" />}
              {c.name}
              <button
                type="button"
                className="text-danger"
                disabled={busy}
                aria-label={`حذف ${c.name}`}
                onClick={() => {
                  if (window.confirm(`«${c.name}» حذف شود؟ در نماهایش شخصیت پیش‌فرض جایش می‌آید.`)) {
                    useStudio.getState().removeCharacter(c.id);
                  }
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {characters.length < MAX_CUSTOM && (
        <label className="btn btn-primary mt-3 inline-flex cursor-pointer">
          <Upload className="size-4" />
          انتخاب عکس سر
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              setSaved("");
              setFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {saved && (
        <p role="status" className="mt-2 text-sm text-cyan">
          {saved}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      {head && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            {auto && (
              <p className="mb-1 text-sm text-cyan" aria-live="polite">
                {auto}
              </p>
            )}
            <p className="text-sm font-bold" aria-live="polite">
              {STEP_TEXT[step]}
            </p>
            <canvas
              ref={pickRef}
              className="mt-2 w-full max-w-xs cursor-crosshair rounded-lg border border-line"
              style={{ touchAction: "none" }}
              onPointerDown={pick}
              aria-label="عکس سر؛ برای مشخص کردن دهان و چشم‌ها کلیک کنید"
              role="img"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setMouth(null);
                  setEyeL(null);
                  setEyeR(null);
                  setAuto("");
                  setStep("mouth");
                }}
              >
                از اول
              </button>
              {(step === "l" || step === "r") && (
                <button type="button" className="btn btn-ghost" onClick={() => setStep("done")}>
                  بدون پلک زدن
                </button>
              )}
            </div>
            {!head.hadAlpha && head.flat && (
              <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={removeBg} onChange={(e) => setRemoveBg(e.target.checked)} />
                حذف خودکار پس‌زمینهٔ یک‌رنگ
              </label>
            )}
            {!head.hadAlpha && !head.flat && (
              <p className="mt-2 text-sm text-muted">
                پس‌زمینهٔ این عکس یک‌رنگ نیست و خودکار حذف نمی‌شود. برای نتیجهٔ تمیز، اول در Canva با «حذف پس‌زمینه»
                (Background Remover) آن را PNG شفاف کنید و دوباره آپلود کنید.
              </p>
            )}
          </div>

          <div>
            {draft ? (
              <canvas ref={previewRef} width={260} height={330} className="mx-auto block rounded-lg" aria-label="پیش‌نمایش شخصیت در حال حرف زدن" role="img" />
            ) : (
              <p className="text-sm text-muted">بعد از مشخص کردن دهان، پیش‌نمایش در حال حرف زدن اینجا می‌آید.</p>
            )}
            <label className="lbl" htmlFor="maker-name">
              اسم شخصیت
            </label>
            <input
              id="maker-name"
              className="field"
              value={name}
              maxLength={30}
              placeholder="مثلاً عمو جواد"
              onChange={(e) => setName(e.target.value)}
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="lbl">قد</span>
                <select className="field" value={scale} onChange={(e) => setScale(Number(e.target.value))}>
                  {HEIGHTS.map((h) => (
                    <option key={h.v} value={h.v}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="lbl">هیکل</span>
                <select className="field" value={build} onChange={(e) => setBuild(e.target.value as Build)}>
                  {BUILDS.map((b) => (
                    <option key={b.v} value={b.v}>
                      {b.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="lbl" htmlFor="maker-size">
              اندازهٔ سر
            </label>
            <input
              id="maker-size"
              type="range"
              min={70}
              max={170}
              step={2}
              value={size}
              className="w-full"
              dir="ltr"
              onChange={(e) => setSize(Number(e.target.value))}
            />
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <label className="block">
                <span className="lbl">پیراهن</span>
                <input type="color" className="h-11 w-full" value={shirt} onChange={(e) => setShirt(e.target.value)} />
              </label>
              <label className="block">
                <span className="lbl">شلوار</span>
                <input type="color" className="h-11 w-full" value={pants} onChange={(e) => setPants(e.target.value)} />
              </label>
              <label className="block">
                <span className="lbl">کفش</span>
                <input type="color" className="h-11 w-full" value={shoe} onChange={(e) => setShoe(e.target.value)} />
              </label>
            </div>
            <button type="button" className="btn btn-primary mt-3 w-full" disabled={!draft || busy} onClick={save}>
              ساختن شخصیت
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
