/**
 * Stable task ids for the (future) Gemini call sites of the world/set pipeline. The in-app skills
 * loader (src/ai/skills.ts, owned by the story branch) matches skills/<id>/SKILL.md `tasks:` against
 * these ids. No network or model calls live in this module: it only names tasks and default models.
 *
 * Model rules (BEHIX-DIRECTION 7–8, GCP map): text/planning/splitting → gemini-3.8-flash; images →
 * Gemini image models; never any Gemini 2.5 model; gemini-4-argon never on a default/interactive path.
 */
export const WORLD_TASKS = {
  /** script scene → SetDef draft (layers, perspective, anchors, style tokens, per-layer prompts) */
  setDesign: "world-set.design",
  /** one parallax layer / plate image from a SetDef prompt */
  layerArt: "world-set.layer-art",
  /** generated plate → layer polygons, groundY/horizon, walk zone, anchors (structured JSON) */
  split: "world-set.split",
  /** conversational image edits: fill behind cut-outs, extend overscan, alpha cleanup */
  edit: "world-set.edit",
  /** shot + beats → ShotCamera keys (pan/zoom/dolly/truck, motivated, within overscan) */
  cameraPlan: "world-camera.plan",
} as const;
export type WorldTask = (typeof WORLD_TASKS)[keyof typeof WORLD_TASKS];
export const WORLD_TASK_IDS: WorldTask[] = Object.values(WORLD_TASKS);

export const TEXT_MODEL = "gemini-3.8-flash";
export const IMAGE_MODELS = ["gemini-nano-banana-2.1", "gemini-3-pro-image", "gemini-3.1-flash-image", "gemini-3.1-flash-lite-image"] as const;
export type ImageModel = (typeof IMAGE_MODELS)[number];

/** Default model per task (overridable later via Remote Config / env, still checked by allowedModel). */
export const DEFAULT_MODEL: Record<WorldTask, string> = {
  "world-set.design": TEXT_MODEL,
  "world-set.layer-art": "gemini-nano-banana-2.1",
  "world-set.split": TEXT_MODEL,
  "world-set.edit": "gemini-nano-banana-2.1",
  "world-camera.plan": TEXT_MODEL,
};

/** Opt-in background "high quality" pass (never default/interactive): strict caps and a fallback. */
export type BackgroundPass = { thinkingBudget: number; timeoutMs: number; fallback: typeof TEXT_MODEL };
export const MAX_BACKGROUND_THINKING = 8192;
export const MAX_BACKGROUND_TIMEOUT_MS = 10 * 60_000;

/**
 * Model guard for world call sites. Retired (Gemini 2.5, Imagen) and out-of-scope (Veo, Omni video)
 * ids are always rejected. gemini-4-argon is only accepted as an explicit background pass with a
 * capped thinking budget, a timeout and gemini-3.8-flash as fallback.
 */
export function allowedModel(model: string, background?: BackgroundPass): boolean {
  if (/gemini-2\.5|imagen|veo|omni/i.test(model)) return false;
  if (/argon/i.test(model))
    return (
      !!background &&
      background.fallback === TEXT_MODEL &&
      background.thinkingBudget > 0 &&
      background.thinkingBudget <= MAX_BACKGROUND_THINKING &&
      background.timeoutMs > 0 &&
      background.timeoutMs <= MAX_BACKGROUND_TIMEOUT_MS
    );
  return true;
}
