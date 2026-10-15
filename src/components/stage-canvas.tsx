import { useEffect, type RefObject } from "react";
import { canvasSize, locate, renderFrame } from "@/studio/frame";
import { consumeShotAudio, finishPlayback, useStudio } from "@/studio/store";

export function StageCanvas({ canvasRef }: { canvasRef: RefObject<HTMLCanvasElement | null> }) {
  const aspect = useStudio((s) => s.aspect);
  const ratio = aspect === "story" ? 9 / 16 : aspect === "square" ? 1 : 16 / 9;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const s = useStudio.getState();
      const size = canvasSize(s.aspect);
      if (canvas.width !== size.w || canvas.height !== size.h) {
        canvas.width = size.w;
        canvas.height = size.h;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let current = s.shots[s.selected] ?? s.shots[0];
      let local = (now / 1000) % Math.max(0.4, current.duration);
      let clock = now;
      let speakingLive = false;
      if (!s.playing && s.scrub !== null) {
        // فریم ثابتِ لحظهٔ انتخاب‌شده روی تایم‌لاین (مثل خروجی فیلم، قطعی).
        const loc = locate(s.shots, s.scrub);
        if (loc) {
          current = s.shots[loc.index] ?? current;
          local = loc.local;
          clock = s.scrub * 1000;
        }
      }
      if (s.playing) {
        const loc = locate(s.shots, (now - s.playT0) / 1000);
        if (!loc) finishPlayback();
        else {
          consumeShotAudio(loc.index);
          current = s.shots[loc.index] ?? current;
          local = loc.local;
          speakingLive = Boolean(s.audioUrls[current.id]) && current.speaker !== "none";
        }
      }
      renderFrame(ctx, current, {
        now: clock,
        local,
        dt,
        aspect: s.aspect,
        showRig: s.showRig,
        pulses: s.pulses,
        speakingLive,
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef]);

  return (
    <div className="stage-frame" style={{ ["--stage-ratio" as string]: String(ratio) }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
