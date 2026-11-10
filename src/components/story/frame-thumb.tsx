import { useEffect, useRef } from "react";
import { frameFor, type Format } from "@/studio/stick/layout";
import { makePaper } from "@/studio/stick/paper";
import { renderStory, type Timeline } from "@/studio/stick/story-render";
import type { RenderCanvas } from "@/studio/stick/figure-base";

/** کاغذ زمینه برای هر قاب فقط یک بار ساخته می‌شود (ساختنش گران است). */
const papers = new Map<Format, RenderCanvas>();
const paperFor = (format: Format) => {
  let paper = papers.get(format);
  if (!paper) {
    const f = frameFor(format);
    paper = makePaper(f.w, f.h, 7);
    papers.set(format, paper);
  }
  return paper;
};

/**
 * تصویر کوچک یک لحظه از فیلم با همان موتور رندر؛ فقط وقتی در صفحه دیده شود کشیده می‌شود.
 * برای کارت پروژه، کارت صحنه، گالری مکان‌ها و پیش‌نمایش شخصیت.
 */
export function FrameThumb({ timeline, t, format = "portrait", width = 160, className, label }: {
  timeline: Timeline;
  t: number;
  format?: Format;
  width?: number;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const frame = frameFor(format);
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const scale = (width * ratio) / frame.w;
      canvas.width = Math.round(frame.w * scale);
      canvas.height = Math.round(frame.h * scale);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      try {
        renderStory(ctx, timeline, Math.max(0, Math.min(t, timeline.duration - 0.001)), paperFor(format), { captions: false, format });
      } catch {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    if (typeof IntersectionObserver === "undefined") {
      draw();
      return;
    }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        draw();
      }
    }, { rootMargin: "200px" });
    io.observe(canvas);
    return () => io.disconnect();
  }, [timeline, t, format, width]);
  const frame = frameFor(format);
  return (
    <canvas
      ref={ref}
      className={className ?? "frame-thumb"}
      style={{ aspectRatio: `${frame.w} / ${frame.h}` }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
