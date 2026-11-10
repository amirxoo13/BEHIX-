import { createFileRoute } from "@tanstack/react-router";
import { PhaseHead, Shell } from "@/components/shell";
import { AutoScript } from "@/components/auto-script";
import { SceneBar } from "@/components/scene-bar";
import { findChar } from "@/studio/characters";
import { PHASES } from "@/studio/flow";
import { useStudio } from "@/studio/store";
import type { Speaker } from "@/studio/types";

export const Route = createFileRoute("/scenario")({ component: ScenarioPage });

const phase = PHASES[0];

function ScenarioPage() {
  const shots = useStudio((s) => s.shots);
  const selected = useStudio((s) => s.selected);
  const shot = shots[selected] ?? shots[0];
  const busy = useStudio((s) => s.playing || s.exporting);
  const cue =
    shot.speaker === "a"
      ? findChar(shot.actorA.charId).name
      : shot.speaker === "b"
        ? findChar(shot.actorB.charId).name
        : "بدون دیالوگ";

  return (
    <Shell>
      <PhaseHead no={phase.no} en={phase.en} title={phase.label} lede={phase.lede} />
      <AutoScript />
      <SceneBar onAdd={() => useStudio.getState().addShot()} />
      <article className="script mx-auto max-w-2xl">
        <label className="lbl" htmlFor="heading">
          سرصحنه
        </label>
        <input
          id="heading"
          className="field slug"
          value={shot.heading}
          disabled={busy}
          autoComplete="off"
          onChange={(e) => useStudio.getState().patchShot({ heading: e.target.value })}
        />
        <label className="lbl" htmlFor="action">
          شرح تصویر
        </label>
        <textarea
          id="action"
          className="field tall"
          value={shot.actionLine}
          disabled={busy}
          onChange={(e) => useStudio.getState().patchShot({ actionLine: e.target.value })}
        />
        <p className="cue">{cue}</p>
        <label className="lbl" htmlFor="dialogue">
          دیالوگ
        </label>
        <textarea
          id="dialogue"
          className="field tall"
          value={shot.dialogue}
          disabled={busy}
          onChange={(e) => useStudio.getState().patchShot({ dialogue: e.target.value })}
        />
        <label className="lbl" htmlFor="speaker">
          گوینده
        </label>
        <select
          id="speaker"
          className="field"
          value={shot.speaker}
          disabled={busy}
          onChange={(e) => useStudio.getState().patchShot({ speaker: e.target.value as Speaker })}
        >
          <option value="a">{findChar(shot.actorA.charId).name} — چپ قاب</option>
          <option value="b">{findChar(shot.actorB.charId).name} — راست قاب</option>
          <option value="none">بدون گفتار</option>
        </select>
        {shots.length > 1 && (
          <button
            type="button"
            className="btn btn-ghost mt-4"
            disabled={busy}
            onClick={() => {
              if (window.confirm("این نما از سناریو حذف شود؟")) useStudio.getState().removeShot(selected);
            }}
          >
            حذف این نما
          </button>
        )}
      </article>
    </Shell>
  );
}
