import { Play, Square } from "lucide-react";
import { resumeAudio } from "@/studio/audio";
import { finishPlayback, resetArmed, useStudio } from "@/studio/store";

export async function togglePlay() {
  if (useStudio.getState().playing) {
    finishPlayback();
    return;
  }
  await resumeAudio();
  resetArmed();
  // اگر روی تایم‌لاین لحظه‌ای انتخاب شده، پخش از شروع همان نما شروع می‌شود (صدای ضبط‌شده از اول نما است).
  const s = useStudio.getState();
  let from = 0;
  if (s.scrub !== null) {
    for (let i = 0; i < s.selected; i++) from += s.shots[i].duration;
  }
  s.setScrub(null);
  s.setPlaying(true, performance.now() - from * 1000);
}

export function PlayButton({ label = "پخش کل فیلم" }: { label?: string }) {
  const playing = useStudio((s) => s.playing);
  const exporting = useStudio((s) => s.exporting);
  return (
    <button
      type="button"
      className={playing ? "btn btn-danger" : "btn btn-primary"}
      disabled={exporting}
      onClick={() => void togglePlay()}
    >
      {playing ? <Square className="size-4" /> : <Play className="size-4" />}
      {playing ? "توقف" : label}
    </button>
  );
}
