import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { downloadFile, exportMessage, filmFile, SHARE_MESSAGES, shareOrDownload } from "@/components/film-share";
import { PhaseHead, Shell } from "@/components/shell";
import { StageCanvas } from "@/components/stage-canvas";
import { PlayButton } from "@/components/transport";
import { renderFilm } from "@/studio/export-film";
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
  const [film, setFilm] = useState<File | null>(null);
  const [sharing, setSharing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  // با هر تغییر پروژه (نماها، قطع تصویر، عنوان، صداها) ویدیوی ساخته‌شدهٔ قبلی کهنه است و پاک می‌شود.
  useEffect(
    () =>
      useStudio.subscribe((s, prev) => {
        if (
          s.shots !== prev.shots ||
          s.aspect !== prev.aspect ||
          s.title !== prev.title ||
          s.logline !== prev.logline ||
          s.genre !== prev.genre ||
          s.showRig !== prev.showRig ||
          s.audioUrls !== prev.audioUrls
        ) {
          setFilm(null);
        }
      }),
    [],
  );
  let cursor = 0;

  async function onExport() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const setStatus = useStudio.getState().setStatus;
    setStatus("در حال ساخت فایل…");
    setFilm(null);
    setProgress(0);
    try {
      const out = await renderFilm(canvas, { onProgress: (p) => setProgress(p) });
      const file = filmFile(out.blob, out.mime);
      downloadFile(file);
      setFilm(file);
      setStatus(exportMessage(out.ext, out.notice));
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "ساخت ویدیو انجام نشد.");
    } finally {
      setProgress(null);
    }
  }

  async function onShare() {
    if (!film) return;
    setSharing(true);
    try {
      const res = await shareOrDownload(film);
      useStudio.getState().setStatus(SHARE_MESSAGES[res]);
    } finally {
      setSharing(false);
    }
  }

  const pct = progress === null ? null : Math.round(progress * 100);

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
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || sharing || !film}
          aria-describedby="share-note"
          onClick={() => void onShare()}
        >
          <Share2 className="size-4" />
          اشتراک‌گذاری
        </button>
      </div>
      {exporting && pct !== null && (
        <div className="mt-3" data-testid="export-progress">
          <progress className="w-full" max={100} value={pct} aria-label="پیشرفت ساخت ویدیو" />
          <p className="text-xs text-muted" aria-live="polite">
            {pct > 0 ? `در حال ساخت ویدیو: ${fa(pct)}٪` : "در حال آماده‌سازی… (در ضبط زنده، به اندازهٔ طول فیلم طول می‌کشد)"}
          </p>
        </div>
      )}
      <p id="share-note" className="mt-1 text-xs text-muted">
        {film ? `آماده: ${film.name}` : "اول «دانلود ویدیو» را بزنید تا فایل ساخته شود، بعد اشتراک‌گذاری فعال می‌شود."}
      </p>
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
