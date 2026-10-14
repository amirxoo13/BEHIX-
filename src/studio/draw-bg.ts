/**
 * کشیدن پس‌زمینهٔ هر نما: مکان + طرح (variant) + روز/شب.
 * هر مکان سه طرح دارد (labels.ts → WORLD[id].variants). شب: لایهٔ تاریک + روشن شدن چراغ‌ها و پنجره‌ها.
 */
import { applyNight, type Look } from "./bg-kit.ts";
import { bathroom, bedroom, kitchen, living, parking, toilet } from "./bg-home.ts";
import { azadi, bazaar, cabin, coffee, fereshteh, milad, park, saadatabad, street, teahouse, yard } from "./bg-city.ts";
import { WORLD } from "./labels.ts";
import type { BgId } from "./types.ts";

type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number, look: Look) => void;

const PAINTERS: Record<BgId, Painter> = {
  living,
  kitchen,
  bedroom,
  bathroom,
  toilet,
  parking,
  yard,
  car: cabin,
  street,
  park,
  cafe: teahouse,
  coffee,
  bazaar,
  milad,
  azadi,
  saadatabad,
  fereshteh,
};

/** مکان‌هایی که با راه رفتن بازیگر حرکت می‌کنند. */
export const SCROLLING: ReadonlySet<BgId> = new Set<BgId>(["street", "park", "bazaar", "saadatabad", "fereshteh"]);

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  id: BgId,
  w: number,
  h: number,
  scroll: number,
  time: number,
  opts: { variant?: number; night?: boolean } = {},
) {
  const look: Look = {
    variant: opts.variant ?? 0,
    night: opts.night === true,
    time,
    scroll,
    lights: [],
  };
  ctx.save();
  (PAINTERS[id] ?? living)(ctx, w, h, look);
  if (look.night) applyNight(ctx, w, h, look, WORLD[id]?.interior ? 0.42 : 0.3);
  ctx.restore();
}
