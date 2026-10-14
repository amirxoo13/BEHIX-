import { createFileRoute } from "@tanstack/react-router";
import { PhaseHead, Shell } from "@/components/shell";
import { PHASES } from "@/studio/flow";
import { fa } from "@/studio/format";
import { CAMERAS, WORLD } from "@/studio/labels";
import { useStudio } from "@/studio/store";
import type { CameraId } from "@/studio/types";

export const Route = createFileRoute("/board")({ component: BoardPage });

const phase = PHASES[3];

function BoardPage() {
  const shots = useStudio((s) => s.shots);
  const selected = useStudio((s) => s.selected);
  const busy = useStudio((s) => s.playing || s.exporting);

  return (
    <Shell>
      <PhaseHead no={phase.no} en={phase.en} title="دکوپاژ" lede={phase.lede} />
      <div className="flex gap-3 overflow-x-auto pb-2">
        {shots.map((shot, i) => {
          const on = i === selected;
          return (
            <article key={shot.id} className={on ? "panel board-card border-cyan" : "panel board-card"}>
              <button type="button" className="w-full text-start" disabled={busy} onClick={() => useStudio.getState().select(i)}>
                <span className="latin text-sm text-cyan">{fa(i + 1)}</span>
                <span className="mt-1 block font-bold">{shot.heading}</span>
                <span className="mt-2 block text-sm leading-6 text-muted">{shot.actionLine}</span>
                {shot.dialogue.trim() && <span className="mt-2 block text-sm leading-6">«{shot.dialogue}»</span>}
                <span className="mt-2 block text-sm text-muted">{WORLD[shot.background].place}</span>
              </button>
              <label className="lbl" htmlFor={`cam-${shot.id}`}>
                اندازهٔ نما
              </label>
              <select
                id={`cam-${shot.id}`}
                className="field"
                value={shot.camera}
                disabled={busy}
                onChange={(e) => {
                  useStudio.getState().select(i);
                  useStudio.getState().patchShot({ camera: e.target.value as CameraId });
                }}
              >
                {CAMERAS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-muted">{CAMERAS.find((c) => c.id === shot.camera)?.note}</p>
              <label className="lbl" htmlFor={`dur-${shot.id}`}>
                زمان: {fa(shot.duration)} ثانیه
              </label>
              <input
                id={`dur-${shot.id}`}
                type="range"
                min={2}
                max={12}
                step={0.5}
                value={shot.duration}
                disabled={busy}
                onChange={(e) => {
                  useStudio.getState().select(i);
                  useStudio.getState().patchShot({ duration: Number(e.target.value) });
                }}
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy || i === 0}
                  onClick={() => useStudio.getState().moveShot(i, -1)}
                >
                  قبل
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busy || i === shots.length - 1}
                  onClick={() => useStudio.getState().moveShot(i, 1)}
                >
                  بعد
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </Shell>
  );
}
