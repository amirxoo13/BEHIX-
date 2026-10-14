import { Plus, X } from "lucide-react";
import { CAST, findChar } from "@/studio/characters";
import { fa } from "@/studio/format";
import { ACTIONS, EMOTIONS } from "@/studio/labels";
import { useStudio } from "@/studio/store";
import { MAX_EXTRAS, type Action, type ActorSlot, type Emotion, type Shot } from "@/studio/types";

/** بقیهٔ حاضرین صحنه (پشت دو بازیگر اصلی). */
export function ExtrasPanel({ shot, busy }: { shot: Shot; busy: boolean }) {
  const taken = (except?: string) =>
    new Set([shot.actorA.charId, shot.actorB.charId, ...shot.extras.map((e) => e.charId)].filter((id) => id !== except));
  const free = CAST.filter((c) => !taken().has(c.id));

  const set = (extras: ActorSlot[]) => useStudio.getState().patchShot({ extras });
  const patch = (i: number, partial: Partial<ActorSlot>) =>
    set(shot.extras.map((e, j) => (j === i ? { ...e, ...partial } : e)));

  return (
    <section className="panel mt-4" aria-labelledby="extras-title">
      <h2 id="extras-title" className="font-bold">
        بقیهٔ حاضرین
        <span className="mr-2 text-sm font-normal text-muted">
          {fa(shot.extras.length)} از {fa(MAX_EXTRAS)} — عقب‌تر از دو بازیگر اصلی
        </span>
      </h2>
      {shot.extras.length === 0 && <p className="mt-1 text-sm text-muted">کسی جز دو بازیگر اصلی در قاب نیست.</p>}
      <ul className="mt-2 space-y-3">
        {shot.extras.map((e, i) => (
          <li key={`${e.charId}-${i}`} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="lbl">شخصیت</span>
              <select
                className="field"
                value={e.charId}
                disabled={busy}
                onChange={(ev) => patch(i, { charId: ev.target.value })}
              >
                {CAST.filter((c) => !taken(e.charId).has(c.id)).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="lbl">حس چهره</span>
              <select
                className="field"
                value={e.emotion}
                disabled={busy}
                onChange={(ev) => patch(i, { emotion: ev.target.value as Emotion })}
              >
                {EMOTIONS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="lbl">حرکت</span>
              <select
                className="field"
                value={e.action}
                disabled={busy}
                onChange={(ev) => patch(i, { action: ev.target.value as Action })}
              >
                {ACTIONS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              aria-label={`حذف ${findChar(e.charId).name} از قاب`}
              onClick={() => set(shot.extras.filter((_, j) => j !== i))}
            >
              <X className="size-4" />
              حذف
            </button>
          </li>
        ))}
      </ul>
      {shot.extras.length < MAX_EXTRAS && free.length > 0 && (
        <button
          type="button"
          className="btn btn-ghost mt-3"
          disabled={busy}
          onClick={() => set([...shot.extras, { charId: free[0].id, emotion: "neutral", action: "idle" }])}
        >
          <Plus className="size-4" />
          افزودن نفر به قاب
        </button>
      )}
    </section>
  );
}
