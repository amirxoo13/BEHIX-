import { Plus, X } from "lucide-react";
import { useState } from "react";
import { fa } from "@/studio/format";
import { WORLD } from "@/studio/labels";
import { MAX_PROPS, PROPS, placeProps, propDef, type PropId, type PropPlacement } from "@/studio/props";
import { useStudio } from "@/studio/store";
import type { Shot } from "@/studio/types";

/** اشیاء جدا از پس‌زمینه در نمای انتخاب‌شده. */
export function PropsPanel({ shot, busy }: { shot: Shot; busy: boolean }) {
  const [adding, setAdding] = useState<PropId>("tree");
  const shots = useStudio((s) => s.shots);
  const samePlace = shots.filter((s) => s.background === shot.background).length;

  const set = (props: PropPlacement[]) => useStudio.getState().patchShot({ props });
  const patch = (i: number, partial: Partial<PropPlacement>) =>
    set(shot.props.map((p, j) => (j === i ? { ...p, ...partial } : p)));

  const add = () => {
    if (shot.props.length >= MAX_PROPS) return;
    // جای پیشنهادی همان چیدن خودکار است، بعد کاربر جابه‌جا می‌کند.
    const auto = placeProps([...shot.props.map((p) => p.id), adding]).find((p) => p.id === adding);
    const placed = auto ?? { id: adding, x: 0.5, layer: propDef(adding).layer };
    // میز خودکار فقط وقتی جا هست اضافه می‌شود؛ شیء انتخاب‌شده هیچ‌وقت بریده نمی‌شود.
    const extra =
      auto &&
      !shot.props.some((p) => p.id === "table") &&
      propDef(adding).mount === "table" &&
      shot.props.length + 2 <= MAX_PROPS;
    const table = placeProps(["table"])[0];
    set([...(extra ? [table] : []), ...shot.props, placed]);
  };

  return (
    <section className="panel mt-4" aria-labelledby="props-title">
      <h2 id="props-title" className="font-bold">
        اشیاء صحنه
        <span className="mr-2 text-sm font-normal text-muted">
          {fa(shot.props.length)} از {fa(MAX_PROPS)}
        </span>
      </h2>
      <p className="mt-1 text-sm text-muted">
        ماشین، درخت، سماور و … جدا از پس‌زمینه. اسمشان در توضیح صحنهٔ سناریو بیاید، خودکار گذاشته می‌شوند.
      </p>
      <ul className="mt-2 space-y-3">
        {shot.props.map((p, i) => (
          <li key={`${p.id}-${i}`} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto_auto] sm:items-end">
            <label className="block">
              <span className="lbl">شیء</span>
              <select
                className="field"
                value={p.id}
                disabled={busy}
                onChange={(e) => patch(i, { id: e.target.value as PropId })}
              >
                {PROPS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="lbl">جا در قاب (چپ ← راست)</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(p.x * 100)}
                disabled={busy}
                className="w-full"
                dir="ltr"
                aria-valuetext={`${fa(Math.round(p.x * 100))} درصد از چپ`}
                onChange={(e) => patch(i, { x: Number(e.target.value) / 100 })}
              />
            </label>
            <div className="flex gap-1" role="group" aria-label="لایه">
              <button
                type="button"
                className={p.layer === "back" ? "btn btn-on" : "btn btn-ghost"}
                disabled={busy}
                aria-pressed={p.layer === "back"}
                onClick={() => patch(i, { layer: "back" })}
              >
                پشت
              </button>
              <button
                type="button"
                className={p.layer === "front" ? "btn btn-on" : "btn btn-ghost"}
                disabled={busy}
                aria-pressed={p.layer === "front"}
                onClick={() => patch(i, { layer: "front" })}
              >
                جلو
              </button>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              aria-label={`حذف ${propDef(p.id).label}`}
              onClick={() => set(shot.props.filter((_, j) => j !== i))}
            >
              <X className="size-4" />
              حذف
            </button>
          </li>
        ))}
      </ul>
      {shot.props.length < MAX_PROPS && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block min-w-40 flex-1">
            <span className="lbl">شیء تازه</span>
            <select className="field" value={adding} disabled={busy} onChange={(e) => setAdding(e.target.value as PropId)}>
              {PROPS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={add}>
            <Plus className="size-4" />
            افزودن
          </button>
        </div>
      )}
      {samePlace > 1 && (
        <button
          type="button"
          className="btn btn-ghost mt-3"
          disabled={busy}
          onClick={() => useStudio.getState().patchPlace(shot.background, { props: shot.props })}
        >
          همین اشیاء برای همهٔ {fa(samePlace)} نمای «{WORLD[shot.background].place}»
        </button>
      )}
    </section>
  );
}
