import { useEffect, useRef } from "react";
import { findChar } from "@/studio/characters";
import { drawActor } from "@/studio/draw-actor";
import { poseFront } from "@/studio/rig";
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

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
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
  }, [charId, emotion, action]);

  return <canvas ref={ref} className="bust" aria-hidden />;
}
