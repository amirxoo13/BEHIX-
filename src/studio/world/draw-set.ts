/**
 * Renderer hook: draws the layers of a SetDef for one pass of renderStory.
 *   back    → layers with z < SEATED_Z (sky, far, mid / procedural place.back)
 *   front   → SEATED_Z ≤ z < OVERLAY_Z (near / procedural place.front), between seated and standing actors
 *   overlay → z ≥ OVERLAY_Z (foreground frames, after standing actors)
 * Parallax-1 layers ride the scene camera exactly like before; other parallax values get the
 * relative transform layerMatrix(p)·layerMatrix(1)⁻¹. Missing bitmaps → whole set falls back to its
 * procedural place (offline / not yet generated), so a scene is never half-drawn.
 */
import type { Ctx } from "../stick/figure-base.ts";
import { DESIGN, type stageFor } from "../stick/layout.ts";
import { makeCanvas } from "../stick/paper.ts";
import { PLACES, type Env } from "../stick/places.ts";
import { IDENTITY, blurFor, invert, layerMatrix, mul, type CamState, type Mat } from "./camera.ts";
import { proceduralSet } from "./procedural-sets.ts";
import { OVERLAY_Z, SEATED_Z, type SetDef, type SetLayer } from "./set-types.ts";

export type Stage = ReturnType<typeof stageFor>;
export type SetPass = "back" | "front" | "overlay";
export type AssetResolver = (key: string) => CanvasImageSource | undefined;
export type DrawSetOpts = { stage: Stage; w: number; h: number; env: Env; cam?: CamState; assets?: AssetResolver };

let layerCanvas: { c: ReturnType<typeof makeCanvas>; w: number; h: number } | null = null;
const isIdentity = (s: Stage) => s.k === 1 && s.ox === 0 && s.oy === 0;

/**
 * One procedural place layer with the uniform stage transform. Portrait (identity stage) draws straight
 * onto the frame exactly as before. Other formats draw into a transparent layer, extend its outer
 * design columns across the side bands (walls, floor and horizon lines continue), then composite the
 * layer itself on top so art that already reaches past the design edges wins over the extension.
 */
export function drawPlaceLayer(ctx: Ctx, stage: Stage, w: number, h: number, paint: (c: Ctx) => void) {
  if (isIdentity(stage)) {
    ctx.save();
    paint(ctx);
    ctx.restore();
    return;
  }
  if (!layerCanvas || layerCanvas.w !== w || layerCanvas.h !== h) layerCanvas = { c: makeCanvas(w, h), w, h };
  const layer = layerCanvas.c;
  const lc = layer.getContext("2d") as Ctx;
  lc.setTransform(1, 0, 0, 1, 0, 0);
  lc.clearRect(0, 0, w, h);
  lc.save();
  lc.translate(stage.ox, stage.oy);
  lc.scale(stage.k, stage.k);
  paint(lc);
  lc.restore();
  const left = Math.ceil(stage.ox) + 1;
  const right = Math.floor(stage.ox + DESIGN.w * stage.k) - 2;
  // bands reach one frame width past each edge so camera moves never uncover bare paper
  ctx.drawImage(layer, left, 0, 1, h, left - w - 1, 0, w + 1, h);
  ctx.drawImage(layer, right, 0, 1, h, right + 1, 0, w + 1, h);
  ctx.drawImage(layer, 0, 0);
}

const inPass = (l: SetLayer, pass: SetPass) => (pass === "back" ? l.z < SEATED_Z : pass === "front" ? l.z >= SEATED_Z && l.z < OVERLAY_Z : l.z >= OVERLAY_Z);

/** Every bitmap layer of the set can be drawn right now. */
export function setReady(set: SetDef, night: boolean, assets?: AssetResolver): boolean {
  return set.layers.every((l) => !l.asset || !!assets?.((night && l.nightVariant ? l.nightVariant : l.asset).key));
}

/**
 * Parallax correction for a layer, in frame pixels, to apply on top of the scene camera
 * (which is S·M₁·S⁻¹): X = S·M₁⁻¹·M_p·S⁻¹, so the layer ends up with S·M_p·S⁻¹.
 */
export function parallaxCorrection(cam: CamState | undefined, p: number, stage: Stage): Mat {
  if (!cam || p === 1) return IDENTITY;
  const rel = mul(invert(layerMatrix(cam, 1)), layerMatrix(cam, p));
  const S: Mat = [stage.k, 0, 0, stage.k, stage.ox, stage.oy];
  return mul(S, mul(rel, invert(S)));
}

export function drawSet(ctx: Ctx, set: SetDef, pass: SetPass, o: DrawSetOpts): void {
  if (!setReady(set, o.env.night, o.assets)) {
    const fb = proceduralSet(set.fallback.place);
    if (fb !== set) drawSet(ctx, fb, pass, { ...o, assets: undefined });
    return;
  }
  for (const l of set.layers) {
    if (!inPass(l, pass)) continue;
    if (l.procedural) {
      if (l.procedural.part === "paper") continue; // the renderer already drew the paper
      const def = PLACES[l.procedural.place];
      const paint = l.procedural.part === "back" ? def.back : def.front;
      if (!paint) continue;
      if (l.parallax === 1) {
        drawPlaceLayer(ctx, o.stage, o.w, o.h, (c) => paint(c, o.env));
        continue;
      }
      ctx.save();
      ctx.transform(...parallaxCorrection(o.cam, l.parallax, o.stage));
      drawPlaceLayer(ctx, o.stage, o.w, o.h, (c) => paint(c, o.env));
      ctx.restore();
      continue;
    }
    const ref = o.env.night && l.nightVariant ? l.nightVariant : l.asset!;
    const img = o.assets?.(ref.key);
    if (!img) continue;
    ctx.save();
    ctx.transform(...parallaxCorrection(o.cam, l.parallax, o.stage));
    const blur = blurFor(l.blur, l.parallax, o.cam?.focus ?? 1);
    if (blur > 0 && "filter" in ctx) ctx.filter = `blur(${blur * o.stage.k}px)`;
    const { k, ox, oy } = o.stage;
    ctx.drawImage(img, ox + l.rect.x * k, oy + l.rect.y * k, l.rect.w * k, l.rect.h * k);
    // `haze` is baked into the plate at generation/post-process time (a live tint would also tint
    // the transparent parts of the layer), so it is data only here.
    ctx.restore();
  }
}
