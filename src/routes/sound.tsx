import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Mic } from "lucide-react";
import { SceneBar } from "@/components/scene-bar";
import { PhaseHead, Shell } from "@/components/shell";
import { playSfx, resumeAudio, startMic, stopMic } from "@/studio/audio";
import { PHASES } from "@/studio/flow";
import { fa } from "@/studio/format";
import { SFXS } from "@/studio/labels";
import { useStudio } from "@/studio/store";
import type { SfxId } from "@/studio/types";

export const Route = createFileRoute("/sound")({ component: SoundPage });

const phase = PHASES[5];

function SoundPage() {
  const shots = useStudio((s) => s.shots);
  const selected = useStudio((s) => s.selected);
  const audioUrls = useStudio((s) => s.audioUrls);
  const recording = useStudio((s) => s.recording);
  const status = useStudio((s) => s.status);
  const shot = shots[selected] ?? shots[0];
  const busy = useStudio((s) => s.playing || s.exporting);
  const hasAudio = Boolean(audioUrls[shot.id]);

  useEffect(() => {
    return () => {
      if (!useStudio.getState().recording) return;
      void stopMic().then((blob) => {
        const s = useStudio.getState();
        const id = s.shots[s.selected]?.id;
        if (id) s.setAudio(id, URL.createObjectURL(blob));
        s.setRecording(false);
      });
    };
  }, []);

  async function onMic() {
    const s = useStudio.getState();
    if (s.recording) {
      const blob = await stopMic();
      const id = s.shots[s.selected]?.id;
      if (id) s.setAudio(id, URL.createObjectURL(blob));
      s.setRecording(false);
      s.setStatus("گفتار این نما ماند و داخل خروجی ویدیو می‌رود. با بستن صفحه پاک می‌شود.");
      return;
    }
    try {
      await resumeAudio();
      await startMic();
      s.setRecording(true);
      s.setStatus("در حال ضبط. برای پایان، همان دکمه را بزنید.");
    } catch {
      s.setStatus("اجازهٔ میکروفون داده نشد. دهان از روی متن حرکت می‌کند، ولی صدای آدم ضبط نمی‌شود.");
    }
  }

  return (
    <Shell>
      <PhaseHead no={phase.no} en={phase.en} title="صداگذاری" lede={phase.lede} />
      <SceneBar />
      <section className="panel max-w-2xl">
        <p className="text-sm text-muted">
          نمای {fa(selected + 1)} — {shot.heading}
        </p>
        <p className="mt-2 leading-6">{shot.dialogue.trim() ? `«${shot.dialogue}»` : "این نما دیالوگ ندارد."}</p>
        <button
          type="button"
          className={recording ? "btn btn-danger mt-4 w-full" : "btn btn-primary mt-4 w-full"}
          disabled={busy || shot.speaker === "none"}
          onClick={() => void onMic()}
        >
          <Mic className="size-4" />
          {recording ? "پایان ضبط" : hasAudio ? "ضبط دوباره" : "ضبط گفتار این نما"}
        </button>
        <p className="mt-2 text-sm text-muted">{hasAudio ? "برای این نما صدا هست." : "هنوز گفتاری روی این نما نیست."}</p>
        {hasAudio && (
          <button
            type="button"
            className="btn btn-ghost mt-2"
            disabled={busy}
            onClick={() => {
              const prev = useStudio.getState().audioUrls[shot.id];
              if (prev) URL.revokeObjectURL(prev);
              useStudio.getState().setAudio(shot.id, null);
            }}
          >
            حذف گفتار
          </button>
        )}
        <label className="lbl" htmlFor="pitch">
          زیروبم پخش: {fa(shot.pitch)}
        </label>
        <input
          id="pitch"
          type="range"
          min={0.8}
          max={1.35}
          step={0.05}
          value={shot.pitch}
          disabled={busy}
          onChange={(e) => useStudio.getState().patchShot({ pitch: Number(e.target.value) })}
        />
        <label className="lbl" htmlFor="sfx">
          افکت
        </label>
        <div className="flex gap-2">
          <select
            id="sfx"
            className="field"
            value={shot.sfx}
            disabled={busy}
            onChange={(e) => useStudio.getState().patchShot({ sfx: e.target.value as SfxId })}
          >
            {SFXS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-ghost shrink-0"
            onClick={() => void resumeAudio().then(() => playSfx(shot.sfx))}
          >
            شنیدن
          </button>
        </div>
        {status && <p className="mt-3 text-sm leading-6 text-cyan">{status}</p>}
      </section>
    </Shell>
  );
}
