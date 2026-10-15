import { Minus, Plus, SkipBack } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { findChar } from "@/studio/characters";
import { fa } from "@/studio/format";
import { CAMERAS, SFXS } from "@/studio/labels";
import { useStudio } from "@/studio/store";
import type { Shot } from "@/studio/types";

const MIN_DUR = 0.5;
const MAX_DUR = 30;
const ZOOMS = [24, 40, 60, 90, 140, 220];

type Lane = { id: string; label: string; cell: (shot: Shot, hasVoice: boolean) => string | null };

const LANES: Lane[] = [
  { id: "shot", label: "نما", cell: (s) => s.heading },
  { id: "cam", label: "دوربین", cell: (s) => CAMERAS.find((c) => c.id === s.camera)?.label ?? s.camera },
  {
    id: "cast",
    label: "بازیگران",
    cell: (s) => [s.actorA, s.actorB, ...s.extras].map((a) => findChar(a.charId).name).join("، "),
  },
  {
    id: "line",
    label: "دیالوگ",
    cell: (s) => {
      if (s.speaker === "none" || !s.dialogue.trim()) return null;
      const who = s.speaker === "a" ? s.actorA : s.actorB;
      return `${findChar(who.charId).name}: ${s.dialogue}`;
    },
  },
  { id: "voice", label: "صدا", cell: (_s, v) => (v ? "صدای ضبط‌شده" : null) },
  { id: "sfx", label: "افکت", cell: (s) => (s.sfx === "none" ? null : (SFXS.find((x) => x.id === s.sfx)?.label ?? s.sfx)) },
];

function clampDur(v: number) {
  return Math.round(Math.min(MAX_DUR, Math.max(MIN_DUR, v)) * 10) / 10;
}

function clock(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor((t - m * 60) * 10) / 10;
  const sec = s.toLocaleString("fa-IR", { minimumFractionDigits: 1, maximumFractionDigits: 1, minimumIntegerDigits: 2 });
  return `${fa(m)}:${sec}`;
}

/**
 * تایم‌لاین چندلایه: هر نما یک قطعه است و لایه‌ها دوربین، بازیگران، دیالوگ، صدا و افکت آن را نشان می‌دهند.
 * - کلیک روی خط‌کش زمان = رفتن به همان لحظه (صحنه همان فریم را نشان می‌دهد).
 * - کشیدن لبهٔ راست هر نما یا کلیدهای چپ/راست روی آن = تغییر مدت نما.
 * زمان مثل همهٔ نرم‌افزارهای تدوین از چپ به راست جلو می‌رود.
 */
export function Timeline() {
  const shots = useStudio((s) => s.shots);
  const selected = useStudio((s) => s.selected);
  const scrub = useStudio((s) => s.scrub);
  const playing = useStudio((s) => s.playing);
  const exporting = useStudio((s) => s.exporting);
  const audioUrls = useStudio((s) => s.audioUrls);
  const [zoom, setZoom] = useState(2);
  const [drag, setDrag] = useState<{ i: number; dur: number } | null>(null);
  const dragStart = useRef<{ x: number; dur: number } | null>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pps = ZOOMS[zoom];

  const durOf = (i: number) => (drag && drag.i === i ? drag.dur : shots[i].duration);
  const starts: number[] = [];
  let total = 0;
  for (let i = 0; i < shots.length; i++) {
    starts.push(total);
    total += durOf(i);
  }
  const width = Math.max(1, total * pps);

  // نشانگر زمان: هنگام پخش هر فریم جابه‌جا می‌شود (بدون رندر دوبارهٔ React).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const s = useStudio.getState();
      const el = headRef.current;
      if (el) {
        let t: number | null = null;
        if (s.playing) t = (performance.now() - s.playT0) / 1000;
        else if (s.scrub !== null) t = s.scrub;
        else {
          let acc = 0;
          for (let i = 0; i < s.selected; i++) acc += s.shots[i]?.duration ?? 0;
          t = acc;
        }
        el.style.transform = `translateX(${Math.max(0, t) * pps}px)`;
        if (s.playing && scrollRef.current) {
          const sc = scrollRef.current;
          const x = t * pps;
          if (x > sc.scrollLeft + sc.clientWidth - 40 || x < sc.scrollLeft) sc.scrollLeft = Math.max(0, x - 40);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [pps]);

  const busy = playing || exporting;

  const seek = (e: PointerEvent<HTMLDivElement>) => {
    if (busy) return;
    const rect = e.currentTarget.getBoundingClientRect();
    useStudio.getState().setScrub((e.clientX - rect.left) / pps);
  };

  const onHandleDown = (i: number, e: PointerEvent<HTMLSpanElement>) => {
    if (busy) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = { x: e.clientX, dur: shots[i].duration };
    setDrag({ i, dur: shots[i].duration });
  };
  const onHandleMove = (i: number, e: PointerEvent<HTMLSpanElement>) => {
    if (!dragStart.current || !drag || drag.i !== i) return;
    setDrag({ i, dur: clampDur(dragStart.current.dur + (e.clientX - dragStart.current.x) / pps) });
  };
  const onHandleUp = (i: number) => {
    if (drag && drag.i === i && drag.dur !== shots[i].duration) {
      useStudio.getState().patchShotAt(i, { duration: drag.dur });
    }
    dragStart.current = null;
    setDrag(null);
  };
  const onHandleKey = (i: number, e: KeyboardEvent<HTMLSpanElement>) => {
    const step = e.shiftKey ? 1 : 0.1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = shots[i].duration + step;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = shots[i].duration - step;
    if (next === null || busy) return;
    e.preventDefault();
    useStudio.getState().patchShotAt(i, { duration: clampDur(next) });
  };

  const ticks: number[] = [];
  const every = pps >= 90 ? 1 : pps >= 40 ? 2 : 5;
  for (let t = 0; t <= total + 0.001; t += every) ticks.push(t);

  return (
    <section className="panel timeline" aria-labelledby="tl-title">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="tl-title" className="font-bold">
          تایم‌لاین
        </h2>
        <span className="latin text-sm text-muted" dir="ltr">
          {scrub !== null ? `${clock(scrub)} / ` : ""}
          {clock(total)}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          className="btn btn-ghost"
          aria-label="رفتن به شروع فیلم"
          disabled={busy}
          onClick={() => useStudio.getState().setScrub(0)}
        >
          <SkipBack className="size-4" />
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          aria-label="کوچک‌نمایی تایم‌لاین"
          disabled={zoom === 0}
          onClick={() => setZoom((z) => Math.max(0, z - 1))}
        >
          <Minus className="size-4" />
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          aria-label="بزرگ‌نمایی تایم‌لاین"
          disabled={zoom === ZOOMS.length - 1}
          onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
        >
          <Plus className="size-4" />
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        روی خط زمان بزنید تا همان لحظه را ببینید. لبهٔ راست هر نما را بکشید تا مدتش عوض شود.
      </p>

      <div className="tl-body">
        <ul className="tl-labels" aria-hidden="true">
          <li className="tl-ruler-label">زمان</li>
          {LANES.map((l) => (
            <li key={l.id}>{l.label}</li>
          ))}
        </ul>
        <div className="tl-scroll" dir="ltr" ref={scrollRef}>
          <div className="tl-track" style={{ width }}>
            <div
              className="tl-ruler"
              role="slider"
              tabIndex={0}
              aria-label="زمان فیلم"
              aria-valuemin={0}
              aria-valuemax={Math.round(total * 10) / 10}
              aria-valuenow={Math.round((scrub ?? starts[selected] ?? 0) * 10) / 10}
              aria-valuetext={clock(scrub ?? starts[selected] ?? 0)}
              onPointerDown={seek}
              onKeyDown={(e) => {
                const cur = scrub ?? starts[selected] ?? 0;
                if (e.key === "ArrowRight") useStudio.getState().setScrub(cur + 0.5);
                else if (e.key === "ArrowLeft") useStudio.getState().setScrub(Math.max(0, cur - 0.5));
                else return;
                e.preventDefault();
              }}
            >
              {ticks.map((t) => (
                <span key={t} className="tl-tick" style={{ left: t * pps }}>
                  {fa(t)}
                </span>
              ))}
            </div>
            {LANES.map((lane) => (
              <div key={lane.id} className="tl-lane">
                {shots.map((shot, i) => {
                  const text = lane.cell(shot, Boolean(audioUrls[shot.id]));
                  const left = starts[i] * pps;
                  const w = durOf(i) * pps;
                  if (lane.id === "shot") {
                    return (
                      <div
                        key={shot.id}
                        className={i === selected ? "tl-clip tl-shot is-on" : "tl-clip tl-shot"}
                        style={{ left, width: w }}
                      >
                        <button
                          type="button"
                          className="tl-clip-btn"
                          dir="rtl"
                          disabled={busy}
                          title={`${fa(i + 1)}. ${shot.heading} — ${fa(durOf(i))} ثانیه`}
                          onClick={() => useStudio.getState().select(i)}
                        >
                          <span className="latin">{fa(i + 1)}</span> {text}
                        </button>
                        <span
                          className="tl-handle"
                          role="slider"
                          tabIndex={busy ? -1 : 0}
                          aria-label={`مدت نمای ${fa(i + 1)}`}
                          aria-valuemin={MIN_DUR}
                          aria-valuemax={MAX_DUR}
                          aria-valuenow={durOf(i)}
                          aria-valuetext={`${fa(durOf(i))} ثانیه`}
                          onPointerDown={(e) => onHandleDown(i, e)}
                          onPointerMove={(e) => onHandleMove(i, e)}
                          onPointerUp={() => onHandleUp(i)}
                          onPointerCancel={() => onHandleUp(i)}
                          onKeyDown={(e) => onHandleKey(i, e)}
                        />
                      </div>
                    );
                  }
                  if (!text) return null;
                  return (
                    <div
                      key={shot.id}
                      className={`tl-clip tl-${lane.id}`}
                      dir="rtl"
                      style={{ left, width: w }}
                      title={text}
                    >
                      {text}
                    </div>
                  );
                })}
              </div>
            ))}
            <div className="tl-head" ref={headRef} aria-hidden="true" />
          </div>
        </div>
      </div>
    </section>
  );
}
