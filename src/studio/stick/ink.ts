import { getStroke } from "perfect-freehand";
import { INK, type Ctx } from "./figure-base.ts";

export type Point = { x: number; y: number };
/** Pressure is a function of path position, never pointer velocity or frame history. */
export function inkOutline(points: Point[], width: number): number[][] {
  return getStroke(
    points.map((p, i) => [
      p.x,
      p.y,
      0.55 + 0.12 * Math.sin((i / Math.max(1, points.length - 1)) * Math.PI * 2),
    ]),
    {
      size: width,
      thinning: 0.28,
      smoothing: 0.6,
      streamline: 0,
      simulatePressure: false,
      last: true,
    },
  );
}
export function drawInk(ctx: Ctx, points: Point[], width: number) {
  const outline = inkOutline(points, width);
  if (!outline.length) return;
  ctx.beginPath();
  ctx.moveTo(outline[0][0], outline[0][1]);
  for (const [x, y] of outline.slice(1)) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.fillStyle = INK;
  ctx.fill();
}
/** Interpolating both halves passes through the elbow instead of cutting across it. */
export function limbPoints(a: Point, m: Point, b: Point): Point[] {
  const points: Point[] = [];
  for (const [start, end, bend] of [
    [a, m, 0.65],
    [m, b, -0.45],
  ] as const) {
    const dx = end.x - start.x,
      dy = end.y - start.y;
    const length = Math.hypot(dx, dy) || 1;
    for (let i = 0; i <= 8; i++) {
      const u = i / 8,
        bow = Math.sin(u * Math.PI) * bend;
      points.push({
        x: start.x + dx * u - (dy / length) * bow,
        y: start.y + dy * u + (dx / length) * bow,
      });
    }
  }
  return points;
}
