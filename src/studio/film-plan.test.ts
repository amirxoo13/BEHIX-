import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { z } from "zod";
import { FILM_PLAN_JSON_SCHEMA } from "./film-plan.schema.ts";
import { FIXTURE_PLAN, FIXTURE_STORY } from "./film-plan.fixture.ts";
import {
  compileFilmPlan, directFilm, filmPlanSchema, outlineVertexSchema, planSeconds, repairFilmPlan, shotsVertexSchema,
  storyPlanFor, toVertexSchema, traceDialogue, EXPRESSIONS, GESTURES, HOLDS, PLACES_LIST, type FilmPlan,
} from "./film-plan.ts";
import { GESTURE_LABELS, HOLD_LABELS } from "./stick/edit-options.ts";
import { FACES } from "./stick/face.ts";
import { PLACE_IDS } from "./stick/places.ts";
import { directStory } from "./stick/story-direct.ts";
import { parseStory } from "./stick/story-parse.ts";

type J = Record<string, unknown>;
const here = (f: string) => new URL(f, import.meta.url);
const fixture = () => structuredClone(FIXTURE_PLAN) as unknown as FilmPlan;

/** شکل قابل مقایسهٔ یک گره JSON Schema: نوع، فهرست‌ها، بازه‌ها، کلیدهای الزامی و خصوصیت‌ها. */
function shape(node: unknown, defs: J): unknown {
  let n = node as J;
  if (typeof n.$ref === "string") n = defs[n.$ref.split("/").pop()!] as J;
  if (Array.isArray(n.anyOf) && (n.anyOf as J[]).every((x) => "const" in x)) n = { enum: (n.anyOf as J[]).map((x) => x.const) };
  const out: J = {};
  if (n.type && !n.enum) out.type = n.type;
  if (n.enum) out.enum = [...(n.enum as unknown[])].map(String).sort();
  for (const k of ["minimum", "maximum", "minItems", "maxItems"]) if (n[k] !== undefined && n[k] !== Number.MAX_SAFE_INTEGER) out[k] = n[k];
  if (Array.isArray(n.required) && n.required.length) out.required = [...(n.required as string[])].sort();
  if (n.properties) out.properties = Object.fromEntries(Object.entries(n.properties as J).sort().map(([k, v]) => [k, shape(v, defs)]));
  if (n.items) out.items = shape(n.items, defs);
  return out;
}

describe("film plan schema", () => {
  it("UT-FP-01 committed JSON files match the TS schema module and the Vertex converter", () => {
    assert.deepEqual(JSON.parse(readFileSync(here("./film-plan.schema.json"), "utf8")), FILM_PLAN_JSON_SCHEMA);
    assert.deepEqual(JSON.parse(readFileSync(here("./film-plan.vertex.json"), "utf8")), toVertexSchema(FILM_PLAN_JSON_SCHEMA));
  });
  it("UT-FP-02 zod schema and JSON Schema agree on fields, required keys, enums and bounds", () => {
    const defs = (FILM_PLAN_JSON_SCHEMA.$defs ?? {}) as J;
    assert.deepEqual(shape(z.toJSONSchema(filmPlanSchema), {}), shape(FILM_PLAN_JSON_SCHEMA, defs));
  });
  it("UT-FP-03 enums are the engine's own catalogs", () => {
    assert.deepEqual(EXPRESSIONS, Object.keys(FACES));
    assert.deepEqual(GESTURES, Object.keys(GESTURE_LABELS));
    assert.deepEqual(HOLDS, Object.keys(HOLD_LABELS));
    assert.deepEqual(PLACES_LIST, PLACE_IDS);
  });
  it("UT-FP-04 Vertex schema keeps only supported keywords, string enums, no $ref", () => {
    const v = toVertexSchema(FILM_PLAN_JSON_SCHEMA);
    const text = JSON.stringify(v);
    for (const bad of ["$ref", "$defs", "additionalProperties", "$schema", "\"const\""]) assert.ok(!text.includes(bad), bad);
    assert.equal(v.title, undefined);
    const walk = (n: unknown): void => {
      if (Array.isArray(n)) return n.forEach(walk);
      if (!n || typeof n !== "object") return;
      const o = n as J;
      if (o.enum) assert.ok((o.enum as unknown[]).every((x) => typeof x === "string" && x.length > 0));
      if (typeof o.type === "string") assert.equal(o.type, o.type.toUpperCase());
      Object.values(o).forEach(walk);
    };
    walk(v);
    const outline = JSON.stringify(outlineVertexSchema(v));
    assert.ok(!outline.includes("\"shots\""));
    const shots = shotsVertexSchema(v) as { properties: { shots: { type: string } } };
    assert.equal(shots.properties.shots.type, "ARRAY");
  });
});

describe("film plan repair and compile", () => {
  it("UT-FP-05 fixture plan is valid, repairs to itself and compiles to a 180-300 s film", () => {
    assert.ok(filmPlanSchema.safeParse(FIXTURE_PLAN).success);
    const { plan, warnings } = repairFilmPlan(fixture(), FIXTURE_STORY);
    assert.ok(plan);
    assert.deepEqual(warnings, []);
    assert.equal(planSeconds(plan!), planSeconds(fixture()));
    const film = directFilm(FIXTURE_STORY, plan);
    assert.equal(film.mode, "plan");
    assert.ok(film.timeline.duration >= 180 && film.timeline.duration <= 300, String(film.timeline.duration));
    assert.equal(film.timeline.scenes.length, 6);
    assert.equal(film.cues.length, 28);
    assert.ok(film.cues.every((c) => FIXTURE_STORY.includes(c.text)));
  });
  it("UT-FP-06 output is deterministic and beat ids are stable", () => {
    const a = directFilm(FIXTURE_STORY, fixture());
    const b = directFilm(FIXTURE_STORY, fixture());
    assert.deepEqual(a, b);
    const ids = a.beats.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.includes("s1-l1-0") || ids.some((id) => id.startsWith("s1-l1-")));
  });
  it("UT-FP-07 lines keep their planned timing and framing", () => {
    const story = compileFilmPlan(fixture(), FIXTURE_STORY);
    const first = story.scenes[0].beats.find((b) => b.kind === "line")!;
    assert.equal(first.kind, "line");
    assert.equal(first.shot, "medium");
    assert.ok(first.source && FIXTURE_STORY.split("\n")[first.source.line].includes(first.text));
    const narration = story.scenes[0].beats[0];
    assert.equal(narration.kind, "narration");
  });
  it("UT-FP-08 unknown catalog values are clamped or dropped with Persian warnings", () => {
    const raw = fixture() as unknown as J & { locations: J[]; characters: J[]; acts: { scenes: { shots: J[] }[] }[] };
    raw.locations[0].place = "moon";
    raw.characters[0].voice = { voiceId: "NotAVoice" };
    const shot = raw.acts[0].scenes[0].shots[1] as J & { acting: J[] };
    shot.durationSec = 999;
    shot.acting[0].gesture = "moonwalk";
    shot.shotType = "dutchAngle";
    const { plan, warnings } = repairFilmPlan(raw, FIXTURE_STORY);
    assert.ok(plan);
    assert.equal(plan!.locations[0].place, "blank");
    assert.ok(plan!.characters[0].voice.voiceId.length > 0 && plan!.characters[0].voice.voiceId !== "NotAVoice");
    const fixed = plan!.acts[0].scenes[0].shots[1];
    assert.equal(fixed.durationSec, 40);
    assert.equal(fixed.acting[0].gesture, undefined);
    assert.equal(fixed.shotType, "wide");
    assert.ok(warnings.some((w) => w.includes("moon")));
    assert.ok(warnings.some((w) => w.includes("NotAVoice")));
  });
  it("UT-FP-09 dialogue must trace to the source story", () => {
    const raw = fixture() as unknown as { acts: { scenes: { shots: { dialogue: J[]; sourceLines?: number[] }[] }[] }[] };
    const s1 = raw.acts[0].scenes[0].shots;
    s1[1].dialogue[0].text = "صبح بخیر علی جان، امروز روز خیلی بزرگی است.";
    s1[2].dialogue[0].text = "جمله‌ای که کاربر هرگز ننوشته است.";
    delete s1[2].sourceLines;
    const { plan, warnings } = repairFilmPlan(raw, FIXTURE_STORY);
    const shots = plan!.acts[0].scenes[0].shots;
    assert.equal(shots[1].dialogue[0].text, "صبح بخیر علی، امروز روز بزرگی است.");
    assert.equal(shots[2].dialogue.length, 0);
    assert.ok(warnings.some((w) => w.includes("در متن داستان نبود")));
    assert.deepEqual(traceDialogue("صبح  بخير علي", "سارا", FIXTURE_STORY, []), { text: "صبح بخير علي", line: 3 });
  });
  it("UT-FP-10 overlapping or too-short dialogue is laid out sequentially", () => {
    const raw = fixture() as unknown as { acts: { scenes: { shots: { dialogue: J[] }[] }[] }[] };
    const shot = raw.acts[0].scenes[0].shots[1];
    shot.dialogue.push({ ...shot.dialogue[0], startSec: 0.1, endSec: 0.2, text: "می‌دانم، از دیشب خوابم نبرده.", speakerId: "ali" });
    const fixed = repairFilmPlan(raw, FIXTURE_STORY).plan!.acts[0].scenes[0].shots[1];
    const [a, b] = [...fixed.dialogue].sort((x, y) => x.startSec - y.startSec);
    assert.ok(b.startSec >= a.endSec, JSON.stringify(fixed.dialogue));
    assert.ok(a.endSec - a.startSec >= 1);
    assert.ok(fixed.durationSec >= b.endSec);
  });
  it("UT-FP-11 no plan or an unusable plan falls back to the dictionary pipeline", () => {
    const text = "علی وارد می‌شود.\nعلی: سلام!";
    const none = storyPlanFor(text);
    assert.equal(none.mode, "text");
    assert.deepEqual(directFilm(text), { ...directStory(parseStory(text)), mode: "text" });
    const bad = storyPlanFor(text, { meta: {}, characters: [], acts: "oops" });
    assert.equal(bad.mode, "text");
    assert.ok(bad.warnings.some((w) => w.includes("فهم دیکشنری")));
    assert.ok(bad.story.scenes.length > 0);
  });
});
