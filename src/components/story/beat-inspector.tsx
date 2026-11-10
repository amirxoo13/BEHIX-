import { useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { GESTURE_LABELS, HOLD_LABELS, MOVE_LABELS } from "@/studio/stick/edit-options";
import { PLACES, PLACE_IDS, type PlaceId } from "@/studio/stick/places";
import { FACES, type Expression } from "@/studio/stick/face";
import { anchors, setEdit, type compileProject, type StoryEdit, type StoryProject } from "@/studio/stick/project";
import { parseStory, type Shot } from "@/studio/stick/story-parse";
import { fa } from "@/studio/format";

const FACE_LABELS: Record<Expression, string> = {
  neutral: "خنثی", smile: "لبخند", grin: "ذوق", laugh: "خنده", smirk: "پوزخند", angry: "عصبانی", furious: "خشمگین",
  pout: "قهر", sad: "ناراحت", cry: "گریه", shocked: "شوکه", surprised: "متعجب", scared: "ترسیده", worried: "نگران",
  content: "آرام", kiss: "بوسه", sideEye: "چپ‌چپ", annoyed: "کلافه", embarrassed: "خجالت", thinking: "فکر", sleepy: "خواب‌آلود",
};
const KIND_LABELS = { line: "دیالوگ", action: "حرکت", narration: "راوی" } as const;
const SHOTS: [Shot | "", string][] = [["", "خودکار"], ["wide", "باز"], ["medium", "متوسط"], ["close", "نزدیک"]];
const sec = (n: number) => fa(Number(n.toFixed(1)));

/**
 * پنل ویرایش بخش انتخاب‌شده (مثل Properties در Animaker و Emote در Plotagon):
 * نمای دوربین، مدت، مکان صحنه و بازی هر شخصیت. هر تغییر یک StoryEdit است و برگشت‌پذیر.
 */
export function BeatInspector({ project, directed, selected, onSelect, commit }: {
  project: StoryProject;
  directed: ReturnType<typeof compileProject>;
  selected: string;
  onSelect: (id: string) => void;
  commit: (f: (p: StoryProject) => StoryProject) => void;
}) {
  const [actor, setActor] = useState("");
  const index = Math.max(0, directed.beats.findIndex((b) => b.id === selected));
  const beat = directed.beats[index];
  const scene = beat ? directed.timeline.scenes[beat.scene] : undefined;
  const who = scene?.actors.some((a) => a.cast === actor) ? actor : (beat?.speaker ?? scene?.actors[0]?.cast ?? "");
  const edit = project.edits.find((e) => !e.unresolved && e.beatId === beat?.id && e.actor === who);
  const beatEdit = project.edits.find((e) => !e.unresolved && e.beatId === beat?.id && e.actor === undefined);
  const nameOf = (id: string) => directed.timeline.cast.find((c) => c.id === id)?.name ?? id;
  const x = edit?.x ?? (scene && beat ? scene.actors.find((a) => a.cast === who)?.track.keys[0]?.x : undefined) ?? 0.5;

  if (!beat) return <p className="studio-empty">هنوز بخشی برای ویرایش نیست. داستان را بنویسید.</p>;
  return (
    <section className="inspector" aria-label="ویرایش بخش">
      <header className="inspector-head">
        <div className="inspector-nav">
          <button type="button" className="icon-btn" disabled={index === 0} onClick={() => onSelect(directed.beats[index - 1].id)} aria-label="بخش قبلی"><ChevronRight size={18} aria-hidden /></button>
          <span className="inspector-no">بخش {fa(index + 1)} از {fa(directed.beats.length)}</span>
          <button type="button" className="icon-btn" disabled={index >= directed.beats.length - 1} onClick={() => onSelect(directed.beats[index + 1].id)} aria-label="بخش بعدی"><ChevronLeft size={18} aria-hidden /></button>
        </div>
        <p className="inspector-text">
          <span className={`kind-badge is-${beat.kind}`}>{KIND_LABELS[beat.kind]}</span>
          {beat.speaker && <b>{nameOf(beat.speaker)}: </b>}
          {beat.text}
        </p>
        <p className="inspector-time" dir="rtl">{sec(beat.from)} تا {sec(beat.to)} ثانیه · صحنهٔ {fa(beat.scene + 1)}</p>
      </header>

      {beat.kind !== "narration" && (
        <div className="field-group">
          <span className="group-label" id="shot-label">نمای دوربین</span>
          <div className="segmented" role="radiogroup" aria-labelledby="shot-label">
            {SHOTS.map(([id, label]) => {
              const on = (beatEdit?.shot ?? "") === id;
              return (
                <button key={id || "auto"} type="button" role="radio" aria-checked={on} className={on ? "is-on" : ""}
                  onClick={() => commit((p) => {
                    if (id) return setEdit(p, beat.id, { shot: id });
                    return { ...p, edits: p.edits.map((e) => (e.id === beatEdit?.id ? { ...e, shot: undefined } : e)) };
                  })}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <label className="field-group">
        <span className="group-label">مدت بخش (ثانیه)</span>
        <input
          key={`${beat.id}-${beat.to - beat.from}`}
          className="field"
          type="number"
          inputMode="decimal"
          min="1"
          max="120"
          step="0.1"
          defaultValue={Number((beat.to - beat.from).toFixed(1))}
          onBlur={(e) => {
            const duration = Number(e.target.value);
            if (Number.isFinite(duration) && duration >= 1 && duration <= 120) commit((p) => setEdit(p, beat.id, { duration }));
          }}
        />
        <small>حرکت کامل می‌شود؛ اگر راه رفتن بیشتر طول بکشد، بخش طولانی‌تر می‌شود.</small>
      </label>

      <fieldset className="field-group">
        <legend className="group-label">صحنه</legend>
        <div className="inspector-row">
          <label className="grow">
            <span className="sr-only">مکان صحنه</span>
            <select className="field" aria-label="مکان صحنه" value={scene?.place ?? "blank"} onChange={(e) => commit((p) => setEdit(p, beat.id, { place: e.target.value as PlaceId }))}>
              {PLACE_IDS.map((id) => <option key={id} value={id}>{PLACES[id].label}</option>)}
            </select>
          </label>
          <div className="segmented" role="radiogroup" aria-label="زمان صحنه">
            {([[false, "روز"], [true, "شب"]] as const).map(([night, label]) => (
              <button key={label} type="button" role="radio" aria-checked={(scene?.night ?? false) === night} className={(scene?.night ?? false) === night ? "is-on" : ""}
                onClick={() => commit((p) => setEdit(p, beat.id, { night }))}>{label}</button>
            ))}
          </div>
        </div>
      </fieldset>

      {beat.kind !== "narration" && scene && scene.actors.length > 0 && (
        <fieldset className="field-group">
          <legend className="group-label">بازی شخصیت</legend>
          <div className="chips" role="radiogroup" aria-label="شخصیت">
            {scene.actors.map((a) => (
              <button key={a.cast} type="button" role="radio" aria-checked={who === a.cast} className={who === a.cast ? "chip is-on" : "chip"} onClick={() => setActor(a.cast)}>
                {nameOf(a.cast)}
              </button>
            ))}
          </div>
          {who && (
            <>
              <label className="field-group">
                <span className="group-label">جای افقی در قاب · {fa(Math.round(x * 100))}٪</span>
                <input
                  key={`${beat.id}-${who}-${edit?.x}`}
                  type="range"
                  min={8}
                  max={92}
                  step={1}
                  defaultValue={Math.round(x * 100)}
                  aria-label="جای افقی"
                  onPointerUp={(e) => commit((p) => setEdit(p, beat.id, { actor: who, x: Number(e.currentTarget.value) / 100 }))}
                  onKeyUp={(e) => commit((p) => setEdit(p, beat.id, { actor: who, x: Number(e.currentTarget.value) / 100 }))}
                />
                <small>یا شخصیت را روی تصویر بکشید.</small>
              </label>
              <div className="field-group">
                <span className="group-label">حالت چهره</span>
                <div className="chips face-chips" role="radiogroup" aria-label="حالت چهره">
                  {(Object.keys(FACES) as Expression[]).map((face) => (
                    <button key={face} type="button" role="radio" aria-checked={edit?.face === face} className={edit?.face === face ? "chip is-on" : "chip"}
                      onClick={() => commit((p) => setEdit(p, beat.id, { actor: who, face }))}>
                      {FACE_LABELS[face]}
                    </button>
                  ))}
                </div>
              </div>
              {([
                ["gesture", "حرکت دست و بدن", GESTURE_LABELS],
                ["move", "جابجایی شخصیت", MOVE_LABELS],
                ["hold", "شیء در دست", HOLD_LABELS],
              ] as const).map(([field, label, options]) => (
                <label key={field} className="field-group">
                  <span className="group-label">{label}</span>
                  <select className="field" aria-label={label} value={edit?.[field] ?? ""} onChange={(e) => commit((p) => setEdit(p, beat.id, { actor: who, [field]: e.target.value }))}>
                    <option value="" disabled>از متن داستان</option>
                    {Object.entries(options).map(([id, text]) => <option key={id} value={id}>{text}</option>)}
                  </select>
                </label>
              ))}
              <div className="field-group">
                <span className="group-label">وضعیت بدن</span>
                <div className="segmented" role="radiogroup" aria-label="وضعیت بدن">
                  {([[false, "ایستاده"], [true, "نشسته"]] as const).map(([sit, label]) => (
                    <button key={label} type="button" role="radio" aria-checked={edit?.sit === sit} className={edit?.sit === sit ? "is-on" : ""}
                      onClick={() => commit((p) => setEdit(p, beat.id, { actor: who, sit }))}>{label}</button>
                  ))}
                </div>
                {PLACES[scene.place].seats.length === 0 && <small>این مکان صندلی ندارد؛ نشستن فقط در مکان‌های دارای صندلی دیده می‌شود.</small>}
              </div>
              <button type="button" className="btn btn-ghost" disabled={!edit} onClick={() => commit((p) => ({ ...p, edits: p.edits.filter((e) => e.id !== edit?.id) }))}>
                <RotateCcw size={16} aria-hidden /> بازنشانی بازی این شخصیت
              </button>
            </>
          )}
        </fieldset>
      )}

      <UnresolvedEdits project={project} unresolved={directed.unresolved} beatId={beat.id} who={who} commit={commit} />
    </section>
  );
}

/** ویرایش‌هایی که بعد از تغییر متن، بخش خودشان را پیدا نکرده‌اند. */
function UnresolvedEdits({ unresolved, beatId, who, commit }: { project: StoryProject; unresolved: StoryEdit[]; beatId: string; who: string; commit: (f: (p: StoryProject) => StoryProject) => void }) {
  if (!unresolved.length) return null;
  return (
    <div className="grid gap-2">
      {unresolved.map((edit) => {
        let text = "";
        try {
          text = String(JSON.parse(edit.anchor.signature)[3] ?? "");
        } catch {
          text = "";
        }
        return (
          <div key={edit.id} className="story-warn">
            <p>ویرایش قبلی به متن تازه وصل نشد{text ? `: ${text}` : "."}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => commit((p) => {
                const a = anchors(parseStory(p.text)).find((x) => x.beat.id === beatId);
                return a ? { ...p, edits: p.edits.map((e) => (e.id === edit.id ? { ...e, beatId, anchor: a.anchor, unresolved: false, actor: e.actor ? who : undefined } : e)) } : p;
              })}>اتصال به همین بخش</button>
              <button type="button" className="btn btn-ghost" onClick={() => commit((p) => ({ ...p, edits: p.edits.filter((e) => e.id !== edit.id) }))}>حذف این ویرایش</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
