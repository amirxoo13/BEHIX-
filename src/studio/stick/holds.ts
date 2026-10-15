import type { Ctx, Hold, Limb } from "./figure.ts";
import type { Point } from "./ink.ts";
export const HOLD_IDS: Hold[] = [
  "none",
  "phone",
  "cup",
  "cookie",
  "book",
  "bag",
  "ball",
  "flowers",
  "remote",
  "plate",
  "shopping",
  "umbrella",
  "laptop",
];
/** Bounds relative to the grip origin; used by the same renderer and clearance solver. */
export const HOLD_BOUNDS: Record<
  Hold,
  { left: number; top: number; right: number; bottom: number }
> = {
  none: { left: 0, top: 0, right: 0, bottom: 0 },
  phone: { left: -18, top: -37, right: 18, bottom: 17 },
  cup: { left: -25, top: -24, right: 25, bottom: 8 },
  cookie: { left: -14, top: -22, right: 14, bottom: 6 },
  book: { left: -32, top: -36, right: 32, bottom: 12 },
  bag: { left: -24, top: 0, right: 24, bottom: 46 },
  ball: { left: -22, top: -30, right: 22, bottom: 6 },
  flowers: { left: -19, top: -39, right: 19, bottom: 6 },
  remote: { left: -10, top: -36, right: 10, bottom: 10 },
  plate: { left: -35, top: -10, right: 35, bottom: 4 },
  shopping: { left: -26, top: 0, right: 26, bottom: 56 },
  umbrella: { left: -70, top: -120, right: 70, bottom: 8 },
  laptop: { left: -44, top: -48, right: 44, bottom: 8 },
};
/** Two-bone IK, clamped to reachable distance. Keeps both bone lengths exact. */
export function reachArm(shoulder: Point, target: Point, side: number): Limb {
  const dx = (target.x - shoulder.x) * side,
    dy = target.y - shoulder.y;
  const a = 46,
    b = 44,
    d = Math.max(2.01, Math.min(a + b - 0.01, Math.hypot(dx, dy)));
  const bend = -Math.acos(Math.max(-1, Math.min(1, (d * d - a * a - b * b) / (2 * a * b))));
  const upper = Math.atan2(dx, dy) - Math.atan2(b * Math.sin(bend), a + b * Math.cos(bend));
  return { a: (upper * 180) / Math.PI, b: (bend * 180) / Math.PI };
}
export function clearGrip(
  hold: Hold,
  end: Point,
  head: Point,
  shoulder: Point,
  side: number,
): Limb | null {
  if (hold === "none") return null;
  const b = HOLD_BOUNDS[hold];
  const touchingFace = hold === "phone" || hold === "cookie";
  let x = end.x;
  let y = end.y;
  // Bulky objects stay on their own side of the torso; food/phone may touch the face.
  const clearance = hold === "umbrella" ? 65 : Math.max(18, Math.min(42, b.right + 7));
  if (!touchingFace && side * (x - shoulder.x) < clearance) x = shoulder.x + side * clearance;
  if (!touchingFace && y + b.top < head.y + 46 && Math.abs(x - head.x) < b.right + 43) {
    y = Math.max(y, head.y + 48 - b.top);
  }
  if (hold === "umbrella") {
    x = shoulder.x + side * 60;
    y = shoulder.y - 42;
  }
  return x === end.x && y === end.y ? null : reachArm(shoulder, { x, y }, side);
}
export function drawExtraHold(ctx: Ctx, hold: Hold) {
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = "#141414";
  ctx.fillStyle = "white";
  const box = (x: number, y: number, w: number, h: number, r = 3) => {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
  };
  if (hold === "remote") {
    box(-9, -35, 18, 44);
    for (let y = -26; y < 0; y += 8) {
      ctx.beginPath();
      ctx.arc(0, y, 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (hold === "plate") {
    ctx.beginPath();
    ctx.ellipse(0, -3, 34, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -4, 24, 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (hold === "shopping") {
    ctx.beginPath();
    ctx.moveTo(-8, 13);
    ctx.quadraticCurveTo(-12, -11, 0, 0);
    ctx.quadraticCurveTo(12, -11, 8, 13);
    ctx.stroke();
    box(-24, 12, 48, 42);
    ctx.beginPath();
    ctx.moveTo(-16, 22);
    ctx.lineTo(-16, 45);
    ctx.stroke();
  } else if (hold === "laptop") {
    box(-40, -46, 80, 43);
    ctx.fillStyle = "#ededed";
    box(-34, -40, 68, 30, 1);
    ctx.fillStyle = "white";
    box(-43, -3, 86, 9, 2);
  } else if (hold === "umbrella") {
    ctx.beginPath();
    ctx.moveTo(0, -115);
    ctx.lineTo(0, 1);
    ctx.quadraticCurveTo(0, 12, -9, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-68, -82);
    ctx.quadraticCurveTo(0, -155, 68, -82);
    ctx.quadraticCurveTo(34, -96, 0, -82);
    ctx.quadraticCurveTo(-34, -96, -68, -82);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -119);
    ctx.quadraticCurveTo(-22, -110, -28, -88);
    ctx.moveTo(0, -119);
    ctx.quadraticCurveTo(22, -110, 28, -88);
    ctx.stroke();
  }
}
