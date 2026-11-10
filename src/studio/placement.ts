import type { ActorSlot } from "./types.ts";
const clamp = (value: unknown, low: number, high: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback;
/** Normalized screen coordinates; legacy documents keep their original composition. */
export function actorPlacement(actor: Pick<ActorSlot, "x" | "scale">, fallbackX: number) {
  return { x: clamp(actor.x, 0.12, 0.88, fallbackX), scale: clamp(actor.scale, 0.7, 1.2, 1) };
}
export function validPlacement(actor: ActorSlot): ActorSlot {
  return {
    ...actor,
    ...(actor.x !== undefined ? { x: actorPlacement(actor, 0.5).x } : {}),
    ...(actor.scale !== undefined ? { scale: actorPlacement(actor, 0.5).scale } : {}),
  };
}
