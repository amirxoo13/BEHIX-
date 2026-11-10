import { useEffect, useRef } from "react";
import { findChar } from "@/studio/characters";
import { drawActor, preloadHeads } from "@/studio/draw-actor";
import { poseFront } from "@/studio/rig";
import { useStudio } from "@/studio/store";
import type { Action, Emotion } from "@/studio/types";

export function Bust({
  charId,
  emotion = "neutral",
  action = "idle",
}: {
  charId: string;
  emotion?: Emotion;
  action?: Action;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  const custom = useStudio((s) => s.characters);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let alive = true;
    // سر عکسی: اول بارگذاری، بعد نقاشی (وگرنه یک لحظه سر پیش‌فرض دیده می‌شود).
    // تصویر خراب: سر نقاشی‌شده کشیده می‌شود (headImage در این حالت null است).
    void preloadHeads([findChar(charId)])
      .catch(() => undefined)
      .then(() => alive && paint(ctx, canvas));
    return () => {
      alive = false;
    };
  }, [charId, emotion, action, custom]);

  function paint(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = 280;
    const h = 360;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--color-bg").trim() || "#070b16";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    const char = findChar(charId);
    const pose = poseFront(action, emotion, 0.2, 1.2, 1);
    const gesture = action === "tea" || action === "point" ? action : "none";
    drawActor(
      ctx,
      char,
      pose,
      { blink: 0, viseme: "rest", open: 0, emotion, env: 0.25 },
      w / 2,
      318,
      1.02,
      1,
      false,
      charId,
      0,
      gesture,
      1,
    );
  }

  return <canvas ref={ref} className="bust" aria-hidden />;
}
