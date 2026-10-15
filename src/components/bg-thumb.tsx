import { useEffect, useRef } from "react";
import { drawBackground } from "@/studio/draw-bg";
import type { BgId } from "@/studio/types";

/** پیش‌نمایش کوچک یک طرح پس‌زمینه (همان نقاشی صحنه، در اندازهٔ کوچک). */
export function BgThumb({ id, variant, night, label }: { id: BgId; variant: number; night: boolean; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawBackground(ctx, id, c.width, c.height, 0, 1.3, { variant, night });
  }, [id, variant, night]);
  return (
    <canvas
      ref={ref}
      width={480}
      height={270}
      role="img"
      aria-label={label}
      className="block h-auto w-full rounded-lg border border-line"
    />
  );
}
