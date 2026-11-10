/**
 * Adapter: today's procedural PlaceDef → SetDef, plus a tiny in-memory registry for real sets.
 * Procedural sets put the vector drawing on parallax-1 layers so rendering through drawSet is
 * pixel-identical to the old direct place.back/front calls.
 */
import { DESIGN } from "../stick/layout.ts";
import { PLACES, type PlaceId } from "../stick/places.ts";
// story-render imports draw-set → this module; SEAT_TOP is only read inside functions, so the cycle is safe.
import { SEAT_TOP } from "../stick/story-render.ts";
import { Z, fnv1a, parseSetDef, type Anchor, type SetDef, type SetLayer, type StyleTokens } from "./set-types.ts";

/** Standing adult height at depth 1 in stage px (measured on portrait renders: feet 1344, head top ≈ 528). */
export const REF_HEIGHT_PX = 816;
/** Eye line used for procedural sets (no vanishing geometry yet; matches the extra places' floor grid). */
export const PROCEDURAL_HORIZON_Y = 760;

/** Style tokens of the current stick look; generated art must match these (and the characters). */
export const STICK_STYLE: StyleTokens = {
  id: "behix-stick-v1",
  palette: { key: ["#ffffff", "#dddddd", "#c3c7d3", "#3d4253"], shadow: "#8d92a6", highlight: "#ffffff", ink: "#141414", paper: "#ffffff" },
  light: { dir: [-0.4, -1], temperature: "neutral", contrast: 0.6 },
  timeOfDay: "day",
  line: { weightNear: 4.4, weightFar: 2, color: "#141414" },
  shading: "flat",
  promptFragment: "Clean black ink line art on white crumpled paper, flat greys, no gradients, no text.",
};

const FULL = { x: 0, y: 0, w: DESIGN.w, h: DESIGN.h };
const cache = new Map<PlaceId, SetDef>();

export function proceduralSet(place: PlaceId): SetDef {
  const hit = cache.get(place);
  if (hit) return hit;
  const def = PLACES[place];
  const layers: SetLayer[] = [
    { role: "sky", z: Z.sky, parallax: 1, rect: FULL, procedural: { place, part: "paper" } },
    { role: "mid", z: Z.mid, parallax: 1, rect: FULL, procedural: { place, part: "back" } },
  ];
  if (def.front) layers.push({ role: "near", z: Z.near, parallax: 1, rect: FULL, procedural: { place, part: "front" } });
  const anchors: Anchor[] = [
    ...def.seats.map((x, i) => ({ id: `seat.${i + 1}`, kind: "seat" as const, x: x * DESIGN.w, y: SEAT_TOP, depth: 1, facing: "camera" as const, capacity: 1, layer: "mid" as const })),
    ...def.spots.map((x, i) => ({ id: `mark.${i + 1}`, kind: "mark" as const, x: x * DESIGN.w, y: DESIGN.floor, depth: 1 })),
    { id: "entry.L", kind: "entry", x: 0, y: DESIGN.floor, depth: 1, facing: "right" },
    { id: "exit.R", kind: "exit", x: DESIGN.w, y: DESIGN.floor, depth: 1, facing: "left" },
  ];
  const body = {
    schema: 1 as const,
    id: `${place}.wide.procedural`,
    place,
    angle: "wide" as const,
    label: def.label,
    stage: { w: 1080 as const, h: 1920 as const },
    overscan: { x: 0, y: 0 },
    layers,
    perspective: { groundY: DESIGN.floor, horizonY: PROCEDURAL_HORIZON_Y, vanishX: DESIGN.w / 2, refHeightPx: REF_HEIGHT_PX, scaleAt: "linear" as const },
    walk: { poly: [[40, DESIGN.floor - 60], [DESIGN.w - 40, DESIGN.floor - 60], [DESIGN.w, DESIGN.floor + 40], [0, DESIGN.floor + 40]] as [number, number][], minDepth: 1, maxDepth: 1 },
    anchors,
    seats: [...def.seats],
    style: STICK_STYLE.id,
    fallback: { place },
    version: 1,
  };
  const set = parseSetDef({ ...body, hash: fnv1a(JSON.stringify(body)) });
  cache.set(place, set);
  return set;
}

const registry = new Map<string, SetDef>();
/** Register a validated set (e.g. from a bundled catalog snapshot). Returns the parsed set. */
export function registerSet(raw: unknown): SetDef {
  const set = parseSetDef(raw);
  registry.set(set.id, set);
  return set;
}
export function getSet(id: string): SetDef | undefined {
  return registry.get(id);
}
/** Scene → set: a registered set id wins; otherwise the procedural set of the scene's place. */
export function resolveSet(setId: string | undefined, place: PlaceId): SetDef {
  return (setId && registry.get(setId)) || proceduralSet(place);
}
