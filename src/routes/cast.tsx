import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bust } from "@/components/bust";
import { SceneBar } from "@/components/scene-bar";
import { PhaseHead, Shell } from "@/components/shell";
import { CAST, findChar } from "@/studio/characters";
import { PHASES } from "@/studio/flow";
import { fa } from "@/studio/format";
import { ROLES } from "@/studio/labels";
import { useStudio } from "@/studio/store";

export const Route = createFileRoute("/cast")({ component: CastPage });

const phase = PHASES[1];

function CastPage() {
  const shots = useStudio((s) => s.shots);
  const selected = useStudio((s) => s.selected);
  const shot = shots[selected] ?? shots[0];
  const busy = useStudio((s) => s.playing || s.exporting);
  const [slot, setSlot] = useState<"a" | "b">("a");
  const actor = slot === "a" ? shot.actorA : shot.actorB;

  return (
    <Shell>
      <PhaseHead no={phase.no} en={phase.en} title="شخصیت‌سازی" lede={phase.lede} />
      <SceneBar />
      <div className="mb-3 flex gap-2">
        <button type="button" className={slot === "a" ? "btn btn-on" : "btn btn-ghost"} onClick={() => setSlot("a")}>
          قاب چپ
        </button>
        <button type="button" className={slot === "b" ? "btn btn-on" : "btn btn-ghost"} onClick={() => setSlot("b")}>
          قاب راست
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <SlotCard title="چپ قاب" active={slot === "a"} charId={shot.actorA.charId} onPick={() => setSlot("a")} />
        <SlotCard title="راست قاب" active={slot === "b"} charId={shot.actorB.charId} onPick={() => setSlot("b")} />
      </div>
      <h2 className="mb-2 mt-6 font-bold">کتابخانهٔ شخصیت</h2>
      <p className="mb-3 text-sm text-muted">
        انتخاب، روی {slot === "a" ? "قاب چپ" : "قاب راست"} نمای {fa(selected + 1)} می‌نشیند. بازی چهره در انیمیت است.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CAST.map((c) => {
          const on = actor.charId === c.id;
          const uses = shots.filter((s) => [s.actorA, s.actorB, ...s.extras].some((x) => x.charId === c.id)).length;
          return (
            <button
              key={c.id}
              type="button"
              disabled={busy}
              className={on ? "panel text-start border-cyan" : "panel text-start"}
              onClick={() => useStudio.getState().patchActor(slot, { charId: c.id })}
            >
              <Bust charId={c.id} />
              <span className="mt-2 block font-bold">{c.name}</span>
              <span className="mt-1 block text-sm leading-6 text-muted">{ROLES[c.id]}</span>
              <span className="mt-2 block text-sm text-cyan">{uses ? `در ${fa(uses)} نما` : "خارج از این پروژه"}</span>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}

function SlotCard({
  title,
  charId,
  active,
  onPick,
}: {
  title: string;
  charId: string;
  active: boolean;
  onPick: () => void;
}) {
  const c = findChar(charId);
  return (
    <button type="button" className={active ? "panel text-start border-cyan" : "panel text-start"} onClick={onPick}>
      <Bust charId={charId} />
      <span className="mt-2 block text-sm text-muted">{title}</span>
      <span className="mt-1 block text-lg font-bold">{c.name}</span>
      <span className="mt-1 block text-sm leading-6 text-muted">{ROLES[c.id]}</span>
    </button>
  );
}
