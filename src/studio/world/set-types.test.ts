import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseSetDef, setDefSchema, fnv1a } from "./set-types.ts";
import { DEFAULT_MODEL, TEXT_MODEL, WORLD_TASK_IDS, allowedModel } from "./ai-tasks.ts";

const example = () => JSON.parse(readFileSync(new URL("./fixtures/living.wide.night.a.json", import.meta.url), "utf8"));

describe("SetDef schema", () => {
  it("accepts the design example (5 layers, perspective, anchors, gen metadata)", () => {
    const s = parseSetDef(example());
    assert.equal(s.layers.length, 5);
    assert.deepEqual(s.layers.map((l) => l.role), ["sky", "far", "mid", "near", "overlay"]);
    assert.equal(s.perspective.groundY, 1340);
    assert.equal(s.gen?.splitModel, "gemini-3.8-flash");
  });
  it("defaults splitModel to gemini-3.8-flash", () => {
    const raw = example();
    delete raw.gen.splitModel;
    assert.equal(parseSetDef(raw).gen?.splitModel, TEXT_MODEL);
  });
  it("rejects retired / disallowed models (Gemini 2.5, Imagen, argon by default, Veo)", () => {
    for (const [path, id] of [["model", "gemini-2.5-flash-image"], ["model", "imagen-4.0-generate"], ["splitModel", "gemini-4-argon"], ["splitModel", "gemini-2.5-pro"], ["model", "veo-3.1"]] as const) {
      const raw = example();
      raw.gen[path] = id;
      assert.equal(setDefSchema.safeParse(raw).success, false, `${path}=${id}`);
    }
    const edit = example();
    edit.gen.edits[0].model = "gemini-2.5-flash-image";
    assert.equal(setDefSchema.safeParse(edit).success, false);
  });
  it("rejects structural mistakes", () => {
    const unsorted = example();
    unsorted.layers.reverse();
    assert.equal(setDefSchema.safeParse(unsorted).success, false, "layers must be z-sorted");
    const both = example();
    both.layers[0].procedural = { place: "living", part: "back" };
    assert.equal(setDefSchema.safeParse(both).success, false, "asset xor procedural");
    const horizon = example();
    horizon.perspective.horizonY = 1500;
    assert.equal(setDefSchema.safeParse(horizon).success, false, "horizon above ground");
    const tooMany = example();
    tooMany.layers.push({ ...tooMany.layers[4], z: 95 });
    assert.equal(setDefSchema.safeParse(tooMany).success, false, "≤ 5 layers");
    const tooFew = example();
    tooFew.layers = tooFew.layers.slice(0, 2);
    assert.equal(setDefSchema.safeParse(tooFew).success, false, "generated sets need ≥ 3 layers");
    const http = example();
    http.gen.output.uriPrefix = "https://example.com/";
    assert.equal(setDefSchema.safeParse(http).success, false, "outputs go to gs://");
  });
  it("fnv1a is stable", () => {
    assert.equal(fnv1a("behix"), fnv1a("behix"));
    assert.notEqual(fnv1a("a"), fnv1a("b"));
    assert.match(fnv1a(""), /^[0-9a-f]{8}$/);
  });
});

describe("world AI task ids and model rules", () => {
  it("ids are unique, namespaced and have allowed default models", () => {
    assert.equal(new Set(WORLD_TASK_IDS).size, WORLD_TASK_IDS.length);
    for (const id of WORLD_TASK_IDS) {
      assert.match(id, /^world-(set|camera)\.[a-z-]+$/);
      assert.ok(allowedModel(DEFAULT_MODEL[id]), id);
      assert.doesNotMatch(DEFAULT_MODEL[id], /argon|2\.5/);
    }
    assert.equal(DEFAULT_MODEL["world-set.split"], "gemini-3.8-flash");
    assert.equal(DEFAULT_MODEL["world-camera.plan"], "gemini-3.8-flash");
  });
  it("argon only as a capped background pass with timeout and 3.8-flash fallback", () => {
    assert.equal(allowedModel("gemini-4-argon"), false);
    assert.equal(allowedModel("gemini-4-argon", { thinkingBudget: 4096, timeoutMs: 120_000, fallback: "gemini-3.8-flash" }), true);
    assert.equal(allowedModel("gemini-4-argon", { thinkingBudget: 1e9, timeoutMs: 120_000, fallback: "gemini-3.8-flash" }), false);
    assert.equal(allowedModel("gemini-4-argon", { thinkingBudget: 4096, timeoutMs: 8 * 3600_000, fallback: "gemini-3.8-flash" }), false);
    assert.equal(allowedModel("gemini-2.5-flash"), false);
  });
});
