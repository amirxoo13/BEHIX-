import { createFileRoute } from "@tanstack/react-router";
import { BgThumb } from "@/components/bg-thumb";
import { SceneBar } from "@/components/scene-bar";
import { PhaseHead, Shell } from "@/components/shell";
import { PHASES } from "@/studio/flow";
import { fa } from "@/studio/format";
import { PLACE_GROUPS, WORLD } from "@/studio/labels";
import { useStudio } from "@/studio/store";
import type { BgId } from "@/studio/types";

export const Route = createFileRoute("/world")({ component: WorldPage });

const phase = PHASES[2];

function WorldPage() {
  const shots = useStudio((s) => s.shots);
  const selected = useStudio((s) => s.selected);
  const shot = shots[selected] ?? shots[0];
  const busy = useStudio((s) => s.playing || s.exporting);
  const places = Object.keys(WORLD) as BgId[];
  const place = WORLD[shot.background];
  const samePlace = shots.filter((s) => s.background === shot.background).length;

  return (
    <Shell>
      <PhaseHead no={phase.no} en={phase.en} title="فضا و دکور" lede={phase.lede} />
      <SceneBar />
      <p className="mb-3 text-sm text-muted">
        نمای {fa(selected + 1)} — {shot.heading}
      </p>

      <section className="panel mb-6" aria-labelledby="variant-title">
        <h2 id="variant-title" className="font-bold">
          {place.place}: کدام طرح؟
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {place.variants.map((name, v) => (
            <button
              key={name}
              type="button"
              disabled={busy}
              aria-pressed={shot.variant === v}
              className={`rounded-xl border-2 p-1 text-start ${shot.variant === v ? "border-cyan" : "border-transparent"}`}
              onClick={() => useStudio.getState().patchShot({ variant: v })}
            >
              <BgThumb id={shot.background} variant={v} night={shot.night} label={`${place.place} — ${name}`} />
              <span className="mt-1 block text-sm font-bold">
                {fa(v + 1)}. {name}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className={shot.night ? "btn btn-ghost" : "btn btn-on"}
            aria-pressed={!shot.night}
            onClick={() => useStudio.getState().patchShot({ night: false })}
          >
            روز
          </button>
          <button
            type="button"
            disabled={busy}
            className={shot.night ? "btn btn-on" : "btn btn-ghost"}
            aria-pressed={shot.night}
            onClick={() => useStudio.getState().patchShot({ night: true })}
          >
            شب
          </button>
          {samePlace > 1 && (
            <button
              type="button"
              disabled={busy}
              className="btn btn-ghost"
              onClick={() =>
                useStudio.getState().patchPlace(shot.background, { variant: shot.variant, night: shot.night })
              }
            >
              همین طرح برای همهٔ {fa(samePlace)} نمای «{place.place}»
            </button>
          )}
        </div>
      </section>

      {PLACE_GROUPS.map((g) => (
        <section key={g.id} className="mb-5" aria-labelledby={`group-${g.id}`}>
          <h2 id={`group-${g.id}`} className="mb-2 font-bold text-muted">
            {g.label}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {places
              .filter((id) => WORLD[id].group === g.id)
              .map((id) => {
                const used = shots.map((s, i) => (s.background === id ? i + 1 : 0)).filter(Boolean);
                const on = shot.background === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={busy}
                    aria-pressed={on}
                    className={on ? "panel text-start border-cyan" : "panel text-start"}
                    onClick={() => useStudio.getState().patchShot({ background: id, variant: 0 })}
                  >
                    <span className="block font-bold">{WORLD[id].place}</span>
                    <span className="mt-1 block text-sm leading-6 text-muted">{WORLD[id].note}</span>
                    <span className="mt-2 block text-sm text-cyan">
                      {used.length ? `نماهای ${used.map((n) => fa(n)).join("، ")}` : "در این پروژه استفاده نشده"}
                    </span>
                  </button>
                );
              })}
          </div>
        </section>
      ))}
    </Shell>
  );
}
