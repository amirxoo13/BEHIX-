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
  useStudio.getState().setPlaying(true, performance.now());
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
