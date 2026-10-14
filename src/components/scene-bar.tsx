import { fa } from "@/studio/format";
import { useStudio } from "@/studio/store";

export function SceneBar({ onAdd }: { onAdd?: () => void }) {
  const shots = useStudio((s) => s.shots);
  const selected = useStudio((s) => s.selected);
  const busy = useStudio((s) => s.playing || s.exporting);
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
      {shots.map((shot, i) => (
        <button
          key={shot.id}
          type="button"
          disabled={busy}
          className={i === selected ? "btn btn-on shrink-0" : "btn btn-ghost shrink-0"}
          onClick={() => useStudio.getState().select(i)}
        >
          <span className="latin text-cyan">{fa(i + 1)}</span>
          <span className="chip-label">{shot.heading}</span>
        </button>
      ))}
      {onAdd && (
        <button type="button" className="btn btn-ghost shrink-0" disabled={busy} onClick={onAdd}>
          نمای تازه
        </button>
      )}
    </div>
  );
}
