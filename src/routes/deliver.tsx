import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { Download } from "lucide-react";
import { PhaseHead, Shell } from "@/components/shell";
import { StageCanvas } from "@/components/stage-canvas";
import { PlayButton } from "@/components/transport";
import { exportFilm } from "@/studio/export-film";
import { PHASES } from "@/studio/flow";
import { clock, fa } from "@/studio/format";
import { totalDuration } from "@/studio/frame";
import { useStudio } from "@/studio/store";
import type { Aspect } from "@/studio/types";

export const Route = createFileRoute("/deliver")({ component: DeliverPage });

const phase = PHASES[6];

const FORMATS: { id: Aspect; label: string; note: string }[] = [
  { id: "wide", label: "۱۶:۹", note: "سینمایی" },
  { id: "square", label: "۱:۱", note: "مربع" },
  { id: "story", label: "۹:۱۶", note: "عمودی" },
];

function DeliverPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shots = useStudio((s) => s.shots);
  const aspect = useStudio((s) => s.aspect);
  const exporting = useStudio((s) => s.exporting);
  const playing = useStudio((s) => s.playing);
  const status = useStudio((s) => s.status);
  const title = useStudio((s) => s.title);
  const busy = playing || exporting;
  let cursor = 0;

  async function onExport() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setStatus = useStudio.getState().setStatus;
    setStatus("در حال ساخت فایل…");
    try {
      const ext = await exportFilm(canvas);
      setStatus(ext === "mp4" ? "فایل MP4 دانلود شد." : "فایل WebM دانلود شد. این مرورگر MP4 نداد.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "ساخت ویدیو انجام نشد.");
      useStudio.getState().setExporting(false);
    }
  }

  return (
    <Shell>
      <PhaseHead no={phase.no} en={phase.en} title="خروجی" lede={phase.lede} />
      <StageCanvas canvasRef={canvasRef} />
      <div className="mt-3 flex flex-wrap gap-2">
        <PlayButton />
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void onExport()}>
          <Download className="size-4" />
          {exporting ? "در حال ساخت…" : "دانلود ویدیو"}
        </button>
      </div>
      <p className="mt-3 text-sm text-muted">
        {title} — {fa(shots.length)} نما — {clock(totalDuration(shots))}
      </p>
      {status && <p className="mt-1 text-sm text-cyan">{status}</p>}
      <p className="lbl">قطع تصویر</p>
      <div className="flex flex-wrap gap-2">
        {FORMATS.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={busy}
            className={aspect === item.id ? "btn btn-on" : "btn btn-ghost"}
            onClick={() => useStudio.getState().setAspect(item.id)}
          >
            <span className="latin">{item.label}</span>
            {item.note}
          </button>
        ))}
      </div>
      <div className="sheet mt-5">
        {shots.map((shot, i) => {
          const start = cursor;
          cursor += shot.duration;
          return (
            <button
              key={shot.id}
              type="button"
              className="sheet-row"
              onClick={() => useStudio.getState().select(i)}
            >
              <span className="step-no">{fa(i + 1)}</span>
              <span className="min-w-0">
                <span className="block font-bold">{shot.heading}</span>
                <span className="block truncate text-sm text-muted">{shot.dialogue.trim() || shot.actionLine}</span>
              </span>
              <span className="latin text-sm text-cyan">{clock(start)}</span>
            </button>
          );
        })}
      </div>
    </Shell>
  );
}
