import { useMemo } from "react";
import { PLACES } from "@/studio/stick/places";
import type { Directed } from "@/studio/stick/story-direct";
import { fa } from "@/studio/format";

/**
 * خط زمان کلی فیلم (مثل Overall Timeline در Animaker): صحنه‌ها به اندازهٔ طولشان،
 * بخش‌های هر صحنه با رنگ نوعشان، و نشانگر زمان. راست‌به‌چپ، هم‌جهت با نوار پخش.
 * کلیک یا کشیدن، زمان را جابه‌جا و همان بخش را انتخاب می‌کند.
 */
export function TimelineStrip({ directed, time, selected, onSeek }: {
  directed: Directed;
  time: number;
  selected: string;
  onSeek: (t: number, beatId?: string) => void;
}) {
  const { timeline, beats } = directed;
  const duration = Math.max(0.001, timeline.duration);
  const ticks = useMemo(() => {
    const step = duration > 120 ? 30 : duration > 40 ? 10 : 5;
    return Array.from({ length: Math.floor(duration / step) + 1 }, (_, i) => i * step);
  }, [duration]);
  const pick = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const t = Math.max(0, Math.min(duration, ((r.right - clientX) / r.width) * duration));
    const beat = beats.find((b) => t >= b.from && t < b.to) ?? [...beats].reverse().find((b) => b.from <= t);
    onSeek(t, beat?.id);
  };
  const pct = (t: number) => `${(t / duration) * 100}%`;
  return (
    <div className="etl" aria-label="خط زمان فیلم">
      <div className="etl-ruler" aria-hidden>
        {ticks.map((s) => (
          <span key={s} style={{ right: pct(s) }}>{fa(Math.floor(s / 60))}:{fa(s % 60).padStart(2, "۰")}</span>
        ))}
      </div>
      <div
        className="etl-track"
        role="slider"
        tabIndex={0}
        aria-label="زمان فیلم"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        aria-valuetext={`${fa(Math.floor(time))} ثانیه`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pick(e.clientX, e.currentTarget);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e.clientX, e.currentTarget);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            e.stopPropagation();
            onSeek(Math.max(0, Math.min(duration, time + (e.key === "ArrowLeft" ? 1 : -1))));
          }
        }}
      >
        {timeline.scenes.map((scene, i) => (
          <div key={`${i}-${scene.start}`} className="etl-scene" style={{ right: pct(scene.start), width: pct(scene.end - scene.start) }}>
            <span className="etl-scene-label">{fa(i + 1)} · {PLACES[scene.place].label}{scene.night ? " · شب" : ""}</span>
          </div>
        ))}
        {beats.map((b) => (
          <div
            key={b.id}
            className={`etl-beat is-${b.kind}${b.id === selected ? " is-on" : ""}`}
            style={{ right: pct(b.from), width: `max(3px, calc(${pct(b.to - b.from)} - 2px))` }}
            title={b.text}
          />
        ))}
        <div className="etl-head" style={{ right: pct(time) }} aria-hidden />
      </div>
    </div>
  );
}
