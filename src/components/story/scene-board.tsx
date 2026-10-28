import { useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { FrameThumb } from "@/components/story/frame-thumb";
import { setEdit, type StoryProject } from "@/studio/stick/project";
import { PLACES, PLACE_IDS, type PlaceId } from "@/studio/stick/places";
import { placeTimeline, sceneCoverTime } from "@/studio/stick/previews";
import type { Directed } from "@/studio/stick/story-direct";
import type { Format } from "@/studio/stick/layout";
import { fa } from "@/studio/format";

const KIND = { line: "دیالوگ", action: "حرکت", narration: "راوی" } as const;

/**
 * نمای صحنه‌به‌صحنه (مثل Plot در Plotagon و پنل Scenes در Animaker):
 * کارت هر صحنه با تصویر واقعی، روز/شب، مدت و فهرست بخش‌ها؛ تعویض مکان از گالری مکان‌ها.
 */
export function SceneBoard({ directed, format, selected, onPick, commit }: {
  directed: Directed;
  format: Format;
  selected: string;
  onPick: (beatId: string) => void;
  commit: (f: (p: StoryProject) => StoryProject) => void;
}) {
  const [gallery, setGallery] = useState<number | null>(null);
  const names = useMemo(() => Object.fromEntries(directed.timeline.cast.map((c) => [c.id, c.name])), [directed.timeline.cast]);
  const scenes = directed.timeline.scenes;
  if (!directed.beats.length) return <p className="studio-empty">صحنه‌ها بعد از نوشتن اولین خط داستان اینجا دیده می‌شوند.</p>;
  return (
    <ol className="scene-board">
      {scenes.map((scene, i) => {
        const beats = directed.beats.filter((b) => b.scene === i);
        const first = beats[0];
        return (
          <li key={`${i}-${scene.start}`} className="scene-card">
            <div className="scene-card-head">
              <button type="button" className="scene-cover" onClick={() => first && onPick(first.id)} aria-label={`رفتن به صحنهٔ ${fa(i + 1)}`}>
                <FrameThumb timeline={directed.timeline} t={sceneCoverTime(scene)} format={format} width={96} />
              </button>
              <div className="scene-info">
                <h3>صحنهٔ {fa(i + 1)}</h3>
                <p>{PLACES[scene.place].label} · {fa(Number((scene.end - scene.start).toFixed(1)))} ثانیه</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!first} aria-expanded={gallery === i} onClick={() => setGallery(gallery === i ? null : i)}>تغییر مکان</button>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!first} onClick={() => first && commit((p) => setEdit(p, first.id, { night: !scene.night }))} aria-label={scene.night ? "روز کردن صحنه" : "شب کردن صحنه"}>
                    {scene.night ? <Sun size={15} aria-hidden /> : <Moon size={15} aria-hidden />} {scene.night ? "روز شود" : "شب شود"}
                  </button>
                </div>
              </div>
            </div>
            {gallery === i && first && (
              <div className="place-gallery" role="radiogroup" aria-label="مکان صحنه">
                {PLACE_IDS.map((id) => (
                  <PlaceOption key={id} id={id} night={scene.night} on={scene.place === id} onPick={() => {
                    commit((p) => setEdit(p, first.id, { place: id }));
                    setGallery(null);
                  }} />
                ))}
              </div>
            )}
            <ol className="beat-list">
              {beats.map((b) => (
                <li key={b.id}>
                  <button type="button" className={b.id === selected ? "is-on" : ""} aria-current={b.id === selected ? "true" : undefined} onClick={() => onPick(b.id)}>
                    <span className={`kind-dot is-${b.kind}`} aria-label={KIND[b.kind]} />
                    <span className="beat-text">{b.speaker && <b>{names[b.speaker] ?? b.speaker}: </b>}{b.text}</span>
                    <small dir="ltr">{fa(Number(b.from.toFixed(1)))}</small>
                  </button>
                </li>
              ))}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}

function PlaceOption({ id, night, on, onPick }: { id: PlaceId; night: boolean; on: boolean; onPick: () => void }) {
  const timeline = useMemo(() => placeTimeline(id, night), [id, night]);
  return (
    <button type="button" role="radio" aria-checked={on} className={on ? "place-option is-on" : "place-option"} onClick={onPick}>
      <FrameThumb timeline={timeline} t={1} format="square" width={88} />
      <span>{PLACES[id].label}</span>
    </button>
  );
}
