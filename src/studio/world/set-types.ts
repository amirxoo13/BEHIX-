/**
 * "Set" v1: a layered parallax background for the story engine (design: /workspace/behix-world/design.md §3).
 * Stage space = the portrait design space (1080×1920, floor 1340); other formats map it with stageFor().
 * Pure data + zod validation; no rendering, no network.
 */
import { z } from "zod";
import { PLACE_IDS, type PlaceId } from "../stick/places.ts";
import { IMAGE_MODELS, TEXT_MODEL, allowedModel } from "./ai-tasks.ts";

const finite = z.number().finite();
const place = z.enum(PLACE_IDS as [PlaceId, ...PlaceId[]]);
const color = z.string().regex(/^#[0-9a-fA-F]{3,8}$/);
const rect = z.object({ x: finite, y: finite, w: finite.positive(), h: finite.positive() }).strict();

export const LAYER_ROLES = ["sky", "far", "mid", "near", "overlay"] as const;
export type LayerRole = (typeof LAYER_ROLES)[number];
/** z bands (design §4.4): characters live between mid (30) and overlay (90). */
export const Z = { sky: 0, far: 10, mid: 30, backProps: 40, seated: 45, standing: 50, near: 60, frontProps: 70, overlay: 90, bubbles: 95, captions: 100 } as const;
/** Layers with z below this draw before the seated pass; [SEATED_Z, OVERLAY_Z) draw between seated and standing. */
export const SEATED_Z = Z.seated;
export const OVERLAY_Z = Z.overlay;

export const assetRefSchema = z
  .object({
    key: z.string().min(1).max(200), // content-hash key "sets/<setId>/<role>.<hash>", no extension
    w: finite.positive(),
    h: finite.positive(),
    tiers: z.array(z.enum(["s", "m", "l"])).min(1),
    formats: z.array(z.enum(["avif", "webp", "png"])).min(1),
    alpha: z.boolean(),
    bytes: z.record(z.enum(["s", "m", "l"]), finite.nonnegative()).optional(),
  })
  .strict();

export const setLayerSchema = z
  .object({
    role: z.enum(LAYER_ROLES),
    asset: assetRefSchema.optional(),
    procedural: z.object({ place, part: z.enum(["back", "front", "paper"]) }).strict().optional(),
    parallax: finite.min(0).max(2), // 0 = infinitely far, 1 = character plane, >1 foreground
    z: finite,
    rect,
    blur: finite.min(0).max(40).optional(),
    haze: z.object({ color, amount: finite.min(0).max(1) }).strict().optional(),
    animate: z.object({ kind: z.enum(["drift", "sway", "flicker"]), speed: finite, amp: finite }).strict().optional(),
    nightVariant: assetRefSchema.optional(),
  })
  .strict()
  .refine((l) => !!l.asset !== !!l.procedural, "a layer has exactly one of asset | procedural");

export const anchorSchema = z
  .object({
    id: z.string().min(1).max(60),
    kind: z.enum(["seat", "surface", "entry", "exit", "mark", "light", "hang"]),
    x: finite,
    y: finite,
    depth: finite.min(0).max(2),
    facing: z.enum(["left", "right", "camera", "away"]).optional(),
    capacity: z.number().int().min(1).max(8).optional(),
    layer: z.enum(LAYER_ROLES).optional(),
  })
  .strict();

export const perspectiveSchema = z
  .object({
    groundY: finite, // feet at depth 1 (today FRAME.floor = 1340)
    horizonY: finite, // eye line / vanishing y
    vanishX: finite,
    refHeightPx: finite.positive(), // standing adult height at depth 1
    scaleAt: z.literal("linear"),
  })
  .strict()
  .refine((p) => p.horizonY < p.groundY, "horizon must be above the ground line");

export const walkZoneSchema = z
  .object({ poly: z.array(z.tuple([finite, finite])).min(3), minDepth: finite.positive(), maxDepth: finite.positive() })
  .strict();

export const styleTokensSchema = z
  .object({
    id: z.string().min(1).max(60),
    palette: z.object({ key: z.array(color).min(1).max(12), shadow: color, highlight: color, ink: color, paper: color.optional() }).strict(),
    light: z.object({ dir: z.tuple([finite, finite]), temperature: z.enum(["warm", "neutral", "cool"]), contrast: finite.min(0).max(1) }).strict(),
    timeOfDay: z.enum(["dawn", "day", "golden", "dusk", "night", "interior-night"]),
    line: z.object({ weightNear: finite.positive(), weightFar: finite.positive(), color }).strict(),
    shading: z.enum(["flat", "cel-2tone", "cel-3tone", "painterly"]),
    grain: z.object({ amount: finite.min(0).max(1), seed: z.number().int() }).strict().optional(),
    promptFragment: z.string().max(2000),
  })
  .strict();

const modelId = (what: string) => z.string().min(1).max(80).refine((m) => allowedModel(m), `${what}: retired or disallowed model id (no Gemini 2.5, Imagen, Veo/Omni, no argon on default paths)`);

export const genMetaSchema = z
  .object({
    task: z.string().max(60).optional(), // WORLD_TASKS id the asset came from
    model: modelId("model").refine((m) => (IMAGE_MODELS as readonly string[]).includes(m) || m.endsWith("-image"), "set art uses a Gemini image model"),
    location: z.string().min(1).max(40),
    promptTemplate: z.string().max(4000),
    promptLang: z.enum(["en", "fa"]),
    vars: z.record(z.string(), z.string()),
    refs: z.array(z.string()).max(14),
    aspectRatio: z.enum(["16:9", "21:9", "9:16"]),
    resolution: z.enum(["1K", "2K", "4K"]),
    mimeType: z.enum(["image/png", "image/webp", "image/jpeg"]),
    output: z.object({ uriPrefix: z.string().startsWith("gs://"), delivery: z.literal("URI") }).strict(),
    outputHash: z.string().min(8), // reproducibility = prompt + refs + model id + output hash (no seed)
    separation: z.enum(["per-layer", "plate+split"]),
    splitModel: modelId("splitModel").default(TEXT_MODEL),
    edits: z.array(z.object({ model: modelId("edit model"), instruction: z.string().max(2000), outputHash: z.string().min(8) }).strict()),
    alpha: z.object({ requested: z.boolean(), verified: z.boolean(), cleanup: z.enum(["gemini-edit", "cloud-run-postprocess"]).optional() }).strict(),
    createdAt: z.string(),
    costUsd: finite.nonnegative().optional(),
    reviewed: z.boolean(),
  })
  .strict();

export const setDefSchema = z
  .object({
    schema: z.literal(1),
    id: z.string().min(1).max(100),
    place,
    angle: z.enum(["wide", "reverse", "close", "insert"]),
    label: z.string().max(120),
    stage: z.object({ w: z.literal(1080), h: z.literal(1920) }).strict(),
    overscan: z.object({ x: finite.min(0), y: finite.min(0) }).strict(),
    layers: z.array(setLayerSchema).min(1).max(5),
    perspective: perspectiveSchema,
    walk: walkZoneSchema,
    anchors: z.array(anchorSchema).max(40),
    seats: z.array(finite.min(0).max(1)),
    style: z.string().min(1).max(60),
    gen: genMetaSchema.optional(),
    fallback: z.object({ place }).strict(),
    version: z.number().int().min(1),
    hash: z.string().min(1),
  })
  .strict()
  .refine((s) => s.layers.every((l, i) => i === 0 || s.layers[i - 1].z <= l.z), "layers are sorted by z")
  .refine((s) => !s.gen || s.layers.length >= 3, "generated sets have 3–5 parallax layers");

export type AssetRef = z.infer<typeof assetRefSchema>;
export type SetLayer = z.infer<typeof setLayerSchema>;
export type Anchor = z.infer<typeof anchorSchema>;
export type Perspective = z.infer<typeof perspectiveSchema>;
export type WalkZone = z.infer<typeof walkZoneSchema>;
export type StyleTokens = z.infer<typeof styleTokensSchema>;
export type GenMeta = z.infer<typeof genMetaSchema>;
export type SetDef = z.infer<typeof setDefSchema>;

/** Validate untrusted JSON (catalog snapshot, model output) into a SetDef. */
export function parseSetDef(raw: unknown): SetDef {
  return setDefSchema.parse(raw);
}

/** Small deterministic string hash (FNV-1a, hex) for set cache keys. */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
