import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { Bone } from "lucide-react";
import { ExtrasPanel } from "@/components/extras-panel";
import { SceneBar } from "@/components/scene-bar";
import { PhaseHead, Shell } from "@/components/shell";
import { StageCanvas } from "@/components/stage-canvas";
import { Timeline } from "@/components/timeline";
import { PlayButton } from "@/components/transport";
import { findChar } from "@/studio/characters";
import { PHASES } from "@/studio/flow";
import { ACTIONS, CAMERAS, EMOTIONS } from "@/studio/labels";
import { useStudio } from "@/studio/store";
import type { Action, CameraId } from "@/studio/types";

export const Route = createFileRoute("/stage")({ component: StagePage });

const phase = PHASES[4];

function StagePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shots = useStudio((s) => s.shots);
  const selected = useStudio((s) => s.selected);
  const showRig = useStudio((s) => s.showRig);
  const shot = shots[selected] ?? shots[0];
  const busy = useStudio((s) => s.playing || s.exporting);

  return (
    <Shell>
      <PhaseHead no={phase.no} en={phase.en} title="انیمیت" lede={phase.lede} />
      <StageCanvas canvasRef={canvasRef} />
      <div className="mt-3 flex flex-wrap gap-2">
        <PlayButton />
        <button
          type="button"
          className={showRig ? "btn btn-on" : "btn btn-ghost"}
          onClick={() => useStudio.getState().setShowRig(!showRig)}
        >
          <Bone className="size-4" />
          {showRig ? "ریگ روشن" : "نمایش ریگ"}
        </button>
      </div>
      <Timeline />
      <div className="mt-4">
        <SceneBar />
      </div>
      <p className="text-sm leading-6 text-muted">{shot.actionLine}</p>
      {shot.dialogue.trim() && <p className="mt-1 text-sm leading-6">«{shot.dialogue}»</p>}
      <label className="lbl" htmlFor="stage-cam">
        عدسی
      </label>
      <select
        id="stage-cam"
        className="field"
        value={shot.camera}
        disabled={busy}
        onChange={(e) => useStudio.getState().patchShot({ camera: e.target.value as CameraId })}
      >
        {CAMERAS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Perform title="چپ قاب" slot="a" charId={shot.actorA.charId} emotion={shot.actorA.emotion} action={shot.actorA.action} busy={busy} />
        <Perform title="راست قاب" slot="b" charId={shot.actorB.charId} emotion={shot.actorB.emotion} action={shot.actorB.action} busy={busy} />
      </div>
      <ExtrasPanel shot={shot} busy={busy} />
    </Shell>
  );
}

function Perform({
  title,
  slot,
  charId,
  emotion,
  action,
  busy,
}: {
  title: string;
  slot: "a" | "b";
  charId: string;
  emotion: (typeof EMOTIONS)[number]["id"];
  action: Action;
  busy: boolean;
}) {
  return (
    <section className="panel">
      <h2 className="font-bold">
        {title}
        <span className="mr-2 text-sm font-normal text-muted">{findChar(charId).name}</span>
      </h2>
      <p className="lbl">حس چهره</p>
      <div className="grid grid-cols-2 gap-2">
        {EMOTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={busy}
            className={emotion === item.id ? "btn btn-on" : "btn btn-ghost"}
            onClick={() => useStudio.getState().trigger(slot, item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <label className="lbl" htmlFor={`${slot}-action`}>
        حرکت
      </label>
      <select
        id={`${slot}-action`}
        className="field"
        value={action}
        disabled={busy}
        onChange={(e) => useStudio.getState().patchActor(slot, { action: e.target.value as Action })}
      >
        {ACTIONS.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </section>
  );
}
