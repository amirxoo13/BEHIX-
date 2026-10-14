import { createFileRoute } from "@tanstack/react-router";
import { SceneBar } from "@/components/scene-bar";
import { PhaseHead, Shell } from "@/components/shell";
import { PHASES } from "@/studio/flow";
import { fa } from "@/studio/format";
import { WORLD } from "@/studio/labels";
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

  return (
    <Shell>
      <PhaseHead no={phase.no} en={phase.en} title="فضا و دکور" lede={phase.lede} />
      <SceneBar />
      <p className="mb-3 text-sm text-muted">
        نمای {fa(selected + 1)} — {shot.heading}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {places.map((id) => {
          const used = shots.map((s, i) => (s.background === id ? i + 1 : 0)).filter(Boolean);
          const on = shot.background === id;
          return (
            <button
              key={id}
              type="button"
              disabled={busy}
              className={on ? "panel text-start border-cyan" : "panel text-start"}
              onClick={() => useStudio.getState().patchShot({ background: id })}
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
    </Shell>
  );
}
