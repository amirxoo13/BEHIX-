import { GESTURE_LABELS, MOVE_LABELS, HOLD_LABELS } from "@/studio/stick/edit-options";
import { PLACES, PLACE_IDS, type PlaceId } from "@/studio/stick/places";
import { useState } from "react";
import { FACES, type Expression } from "@/studio/stick/face";
import { anchors, setEdit, type StoryProject, type StoryEdit } from "@/studio/stick/project";
import { parseStory } from "@/studio/stick/story-parse";
import type { Directed } from "@/studio/stick/story-direct";
const FACE_LABELS: Record<Expression, string> = {
  neutral: "خنثی",
  smile: "لبخند",
  grin: "ذوق",
  laugh: "خنده",
  smirk: "پوزخند",
  angry: "عصبانی",
  furious: "خشمگین",
  pout: "قهر",
  sad: "ناراحت",
  cry: "گریه",
  shocked: "شوکه",
  surprised: "متعجب",
  scared: "ترسیده",
  worried: "نگران",
  content: "آرام",
  kiss: "بوسه",
  sideEye: "چپ‌چپ",
  annoyed: "کلافه",
  embarrassed: "خجالت",
  thinking: "فکر",
  sleepy: "خواب‌آلود",
};
export function TimelineEditor({
  project,
  directed,
  selected,
  onSelect,
  commit,
  unresolved,
}: {
  project: StoryProject;
  directed: Directed;
  selected: string;
  onSelect: (id: string) => void;
  commit: (f: (p: StoryProject) => StoryProject) => void;
  unresolved: StoryEdit[];
}) {
  const [actor, setActor] = useState("");
  const beat = directed.beats.find((b) => b.id === selected) ?? directed.beats[0];
  const scene = beat ? directed.timeline.scenes[beat.scene] : undefined;
  const who = scene?.actors.some((a) => a.cast === actor)
    ? actor
    : (beat?.speaker ?? scene?.actors[0]?.cast ?? "");
  const edit = project.edits.find((e) => !e.unresolved && e.beatId === beat?.id && e.actor === who);
  return (
    <section className="panel grid gap-3" aria-label="ویرایش خط زمان">
      <h2 className="font-bold">ویرایش خط زمان</h2>
      <label>
        بخش داستان
        <select className="field" value={beat?.id ?? ""} onChange={(e) => onSelect(e.target.value)}>
          {directed.beats.map((b, i) => (
            <option key={b.id} value={b.id}>
              {i + 1}. {b.from.toFixed(1)}–{b.to.toFixed(1)} · {b.text.slice(0, 70)}
            </option>
          ))}
        </select>
      </label>
      {beat && (
        <>
          {(
            <label>
              مدت بخش (ثانیه)
              <input
                key={`${beat.id}-${beat.to - beat.from}`}
                className="field"
                type="number"
                min="1"
                max="120"
                step="0.1"
                defaultValue={Number((beat.to - beat.from).toFixed(1))}
                onBlur={(e) => {
                  const duration = Number(e.target.value);
                  if (Number.isFinite(duration) && duration >= 1 && duration <= 120)
                    commit((p) => setEdit(p, beat.id, { duration }));
                }}
              />
            </label>
          )}
          <p className="text-xs text-muted">حرکت کامل می‌شود؛ اگر زمان رفتن از مدت انتخابی بیشتر باشد، بخش طولانی‌تر خواهد شد.</p>
          <label>مکان صحنه
            <select className="field" value={scene?.place ?? "blank"} onChange={e => commit(p => setEdit(p, beat.id, { place: e.target.value as PlaceId }))}>
              {PLACE_IDS.map(id => <option key={id} value={id}>{PLACES[id].label}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={scene?.night ?? false} onChange={e => commit(p => setEdit(p, beat.id, { night: e.target.checked }))} /> شب در این صحنه</label>
          <label>
            شخصیت
            <select className="field" value={who} onChange={(e) => setActor(e.target.value)}>
              {scene?.actors.map((a) => (
                <option key={a.cast} value={a.cast}>
                  {directed.timeline.cast.find((c) => c.id === a.cast)?.name}
                </option>
              ))}
            </select>
          </label>
          {who && beat.kind !== "narration" && (
            <>
              <label>
                جای افقی (۸ تا ۹۲ درصد)
                <input
                  key={`${beat.id}-${who}-${edit?.x}`}
                  className="field"
                  type="number"
                  min="8"
                  max="92"
                  step="1"
                  defaultValue={Math.round(
                    (edit?.x ?? scene?.actors.find((a) => a.cast === who)?.track.keys[0].x ?? 0.5) *
                      100,
                  )}
                  onBlur={(e) => {
                    const x = Number(e.target.value) / 100;
                    if (x >= 0.08 && x <= 0.92)
                      commit((p) => setEdit(p, beat.id, { actor: who, x }));
                  }}
                />
              </label>
              <label>
                حالت چهره
                <select
                  className="field"
                  value={edit?.face ?? ""}
                  onChange={(e) =>
                    commit((p) =>
                      setEdit(p, beat.id, { actor: who, face: e.target.value as Expression }),
                    )
                  }
                >
                  <option value="" disabled>
                    حالت خودکار
                  </option>
                  {Object.keys(FACES).map((face) => (
                    <option key={face} value={face}>
                      {FACE_LABELS[face as Expression]}
                    </option>
                  ))}
                </select>
              </label>
              {<>
                {([
                  ["gesture", "حرکت دست و بدن", GESTURE_LABELS],
                  ["move", "جابجایی شخصیت", MOVE_LABELS],
                  ["hold", "شیء در دست", HOLD_LABELS],
                ] as const).map(([field, label, options]) => <label key={field}>{label}
                  <select className="field" value={edit?.[field] ?? ""} onChange={e => commit(p => setEdit(p, beat.id, { actor: who, [field]: e.target.value }))}>
                    <option value="" disabled>از داستان</option>
                    {Object.entries(options).map(([id, text]) => <option key={id} value={id}>{text}</option>)}
                  </select>
                </label>)}
                <label>وضعیت بدن
                  <select className="field" value={edit?.sit === undefined ? "" : String(edit.sit)} onChange={e => commit(p => setEdit(p, beat.id, { actor: who, sit: e.target.value === "true" }))}>
                    <option value="" disabled>از داستان</option><option value="false">ایستاده</option><option value="true">نشسته (در مکان دارای صندلی)</option>
                  </select>
                </label>
              </>}
              <button className="btn btn-ghost" disabled={!edit} onClick={() => commit(p => ({...p, edits: p.edits.filter(e => e.id !== edit?.id)}))}>بازنشانی بازی این شخصیت</button>
              <p className="text-sm text-muted">
                برای جابه‌جایی در این بخش، شخصیت را روی تصویر بکشید. هر کشیدن یک تغییر قابل
                برگرداندن است.
              </p>
            </>
          )}
        </>
      )}
      {unresolved.map((edit) => (
        <div key={edit.id} className="story-warn">
          <p>ویرایش قبلی به متن تازه وصل نشد: {JSON.parse(edit.anchor.signature)[3]}</p>
          <button
            className="btn btn-ghost"
            disabled={!beat}
            onClick={() =>
              commit((p) => {
                const a = anchors(parseStory(p.text)).find((a) => a.beat.id === beat?.id);
                return a
                  ? {
                      ...p,
                      edits: p.edits.map((e) =>
                        e.id === edit.id
                          ? {
                              ...e,
                              beatId: beat!.id,
                              anchor: a.anchor,
                              unresolved: false,
                              actor: e.actor ? who : undefined,
                            }
                          : e,
                      ),
                    }
                  : p;
              })
            }
          >
            اتصال به بخش انتخاب‌شده
          </button>
          <button
            className="btn btn-ghost"
            onClick={() =>
              commit((p) => ({ ...p, edits: p.edits.filter((e) => e.id !== edit.id) }))
            }
          >
            حذف این ویرایش
          </button>
        </div>
      ))}
    </section>
  );
}
