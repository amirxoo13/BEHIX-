/**
 * برنامهٔ فیلم ۳ تا ۵ دقیقه‌ای: Gemini فقط این برنامه را می‌نویسد، موتور قطعی همیشه آن را اجرا می‌کند.
 * - filmPlanSchema: zod هم‌ارز film-plan.schema.json (آزمون برابری در film-plan.test.ts).
 * - repairFilmPlan: پاسخ خام مدل را با فهرست‌های موتور (مکان، حالت چهره، حرکت، شیء، صدا) درست/محدود می‌کند،
 *   زمان دیالوگ‌ها را قطعی می‌چیند و هر دیالوگ را به متن داستان کاربر برمی‌گرداند (متن ساختگی حذف می‌شود).
 * - compileFilmPlan: برنامه → StoryPlan همان موتور (directStory). بدون برنامه یا با برنامهٔ نامعتبر → parseStory.
 */
import { z } from "zod";
import { normalizeFa } from "./catalog.ts";
import { GESTURE_LABELS, HOLD_LABELS } from "./stick/edit-options.ts";
import { FACES, type Expression } from "./stick/face.ts";
import { CLOTHES, type Hold, type Look } from "./stick/figure.ts";
import { PLACE_IDS, PLACES, type PlaceId } from "./stick/places.ts";
import { directStory, lineDuration, type Directed } from "./stick/story-direct.ts";
import { parseStory, type Act, type Beat, type Gesture, type Move, type Shot, type StoryPlan, type StoryScene } from "./stick/story-parse.ts";
import { defaultVoices, VOICE_IDS } from "./stick/voice.ts";
import { FILM_LIMITS } from "./script-plan.ts";

/* ---------- فهرست‌ها (از خود موتور؛ آزمون، برابری با film-plan.schema.json را چک می‌کند) ---------- */

export const KINDS = ["man", "woman", "boy", "girl", "oldMan", "oldWoman", "baby"] as const;
export const HAIRS = ["tufts", "short", "bald", "curly", "long", "bob", "ponytail", "scarf"] as const;
export const EXPRESSIONS = Object.keys(FACES) as Expression[];
export const GESTURES = Object.keys(GESTURE_LABELS) as Gesture[];
export const HOLDS = Object.keys(HOLD_LABELS) as Hold[];
export const MOVES = ["enter", "exit", "approach", "toLeft", "toRight", "toCenter"] as const satisfies readonly Move[];
export const PLACES_LIST = PLACE_IDS;
export const SHOT_TYPES = ["establishing", "wide", "full", "medium", "mediumClose", "close", "extremeClose", "overShoulder", "twoShot", "insert", "reaction"] as const;
export const CAMERA_MOVES = ["static", "pushIn", "pullOut", "panLeft", "panRight", "truck", "follow", "shake", "rackFocus"] as const;
export const TRANSITIONS = ["cut", "fade", "dipToBlack", "crossDissolve", "wipe", "matchCut"] as const;
export const TIMES = ["dawn", "morning", "noon", "afternoon", "dusk", "night"] as const;
export const MOODS = ["calm", "tense", "comic", "sad", "romantic", "mysterious", "joyful", "angry"] as const;
export const PURPOSES = ["setup", "confrontation", "climax", "resolution", "epilogue"] as const;
export const STYLES = ["ink", "flatCutout", "puppetRig"] as const;
export const FORMATS = ["portrait", "square", "landscape"] as const;
export const FACINGS = ["left", "right", "camera"] as const;
export const LENSES = ["wide", "normal", "tele"] as const;
export const AUDIO_KINDS = ["sfx", "music", "ambience"] as const;

export const TARGET_MIN_SEC = 180;
export const TARGET_MAX_SEC = 300;
export const LIMITS = { characters: 8, locations: 20, acts: 5, scenesPerAct: 12, shotsPerScene: 40, totalShots: FILM_LIMITS.maxShots, onStage: 5, acting: 40, dialogue: 12, audio: 8 } as const;

/* ---------- zod ---------- */

const str = (max: number) => z.string().max(max);
const num = (min: number, max: number) => z.number().min(min).max(max);
const enumOf = <T extends string>(list: readonly T[]) => z.enum(list as unknown as [T, ...T[]]);

const characterSchema = z.object({
  id: str(40), name: str(80), kind: z.enum(KINDS), traits: z.array(str(80)).min(0).max(6).optional(),
  look: z.object({ hair: z.enum(HAIRS).optional(), clothing: z.enum(CLOTHES).optional(), glasses: z.boolean().optional(), beard: z.boolean().optional(), mustache: z.boolean().optional(), cap: z.boolean().optional() }).strict().optional(),
  voice: z.object({ voiceId: str(40), style: str(200).optional() }).strict(),
  rigRef: str(200).optional(),
}).strict();
const locationSchema = z.object({ id: str(40), place: enumOf(PLACES_LIST), label: str(80), backgroundRef: str(200).optional() }).strict();
const blockingSchema = z.object({ characterId: str(40), startX: num(-0.2, 1.2), sit: z.boolean().optional(), facing: z.enum(FACINGS).optional(), hold: enumOf(HOLDS).optional() }).strict();
const actingSchema = z.object({
  characterId: str(40), atSec: num(0, 60), durationSec: num(0.2, 30), gesture: enumOf(GESTURES).optional(), expression: enumOf(EXPRESSIONS).optional(),
  intensity: num(0, 1).optional(), move: z.enum(MOVES).optional(), targetId: str(40).optional(), toX: num(-0.2, 1.2).optional(), sit: z.boolean().optional(),
  hold: enumOf(HOLDS).optional(), lookAt: str(40).optional(), thought: z.boolean().optional(),
}).strict();
const dialogueSchema = z.object({ speakerId: str(40), text: str(600), startSec: num(0, 120), endSec: num(0.3, 120), emotion: enumOf(EXPRESSIONS), delivery: str(200).optional(), overlapsPrevious: z.boolean().optional() }).strict();
const audioSchema = z.object({ kind: z.enum(AUDIO_KINDS), id: str(80), atSec: num(0, 120), durationSec: num(0, 300).optional(), volume: num(0, 1).optional(), continue: z.boolean().optional() }).strict();
const shotSchema = z.object({
  id: str(60), shotType: z.enum(SHOT_TYPES), cameraMove: z.enum(CAMERA_MOVES), subjectId: str(40).optional(), lens: z.enum(LENSES).optional(),
  durationSec: num(FILM_LIMITS.minShotSec, FILM_LIMITS.maxShotSec), characters: z.array(blockingSchema).min(0).max(LIMITS.onStage),
  acting: z.array(actingSchema).min(0).max(LIMITS.acting), dialogue: z.array(dialogueSchema).min(0).max(LIMITS.dialogue), caption: str(300).optional(),
  audio: z.array(audioSchema).min(0).max(LIMITS.audio).optional(), transitionOut: z.enum(TRANSITIONS), sourceLines: z.array(z.number().int().min(1)).min(0).max(40).optional(),
}).strict();
const sceneSchema = z.object({
  id: str(60), locationId: str(40), timeOfDay: z.enum(TIMES), mood: z.enum(MOODS), summary: str(400),
  sourceLines: z.array(z.number().int().min(1)).max(200).optional(), shots: z.array(shotSchema).min(1).max(LIMITS.shotsPerScene),
}).strict();
const actSchema = z.object({ id: str(40), title: str(120), purpose: z.enum(PURPOSES), scenes: z.array(sceneSchema).min(1).max(LIMITS.scenesPerAct) }).strict();
export const filmPlanSchema = z.object({
  meta: z.object({ title: str(120), language: z.enum(["fa"]), targetDurationSec: num(TARGET_MIN_SEC, TARGET_MAX_SEC), style: z.enum(STYLES), format: z.enum(FORMATS), fps: z.union([z.literal(30), z.literal(60)]).optional(), logline: str(400).optional() }).strict(),
  characters: z.array(characterSchema).min(1).max(LIMITS.characters),
  locations: z.array(locationSchema).min(1).max(LIMITS.locations),
  acts: z.array(actSchema).min(1).max(LIMITS.acts),
}).strict();

export type FilmPlan = z.infer<typeof filmPlanSchema>;
export type FilmShot = FilmPlan["acts"][number]["scenes"][number]["shots"][number];
export type FilmScene = FilmPlan["acts"][number]["scenes"][number];
export type FilmCharacter = FilmPlan["characters"][number];

/* ---------- JSON Schema → Vertex responseSchema ---------- */

const VERTEX_KEEP = new Set(["type", "anyOf", "enum", "format", "items", "maximum", "maxItems", "minimum", "minItems", "nullable", "properties", "description", "propertyOrdering", "required"]);

/** $ref را باز می‌کند و فقط کلیدهایی را نگه می‌دارد که responseSchema در Vertex می‌پذیرد (هم‌ارز to-vertex-schema.py). */
export function toVertexSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const defs = (schema.$defs ?? {}) as Record<string, unknown>;
  const conv = (n: unknown): unknown => {
    if (Array.isArray(n)) return n.map(conv);
    if (!n || typeof n !== "object") return n;
    const o = n as Record<string, unknown>;
    if (typeof o.$ref === "string") return conv(defs[o.$ref.split("/").pop() ?? ""]);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      if (!VERTEX_KEEP.has(k)) continue;
      if (k === "properties") out[k] = Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([p, s]) => [p, conv(s)]));
      else if (k === "type") out[k] = String(v).toUpperCase();
      else if (k === "enum") out[k] = (v as unknown[]).map(String);
      else if (k === "items" || k === "anyOf") out[k] = conv(v);
      else out[k] = v;
    }
    if (out.type === "INTEGER" && out.enum) out.type = "STRING";
    return out;
  };
  return conv(schema) as Record<string, unknown>;
}

/** مرحلهٔ ۱ (طرح کلی): همان برنامه بدون نماها. */
export function outlineVertexSchema(vertex: Record<string, unknown>): Record<string, unknown> {
  const copy = structuredClone(vertex) as { properties: { acts: { items: { properties: { scenes: { items: { properties: Record<string, unknown>; required: string[]; propertyOrdering?: string[] } } } } } } };
  const scene = copy.properties.acts.items.properties.scenes.items;
  delete scene.properties.shots;
  scene.required = scene.required.filter((k) => k !== "shots");
  if (scene.propertyOrdering) scene.propertyOrdering = scene.propertyOrdering.filter((k) => k !== "shots");
  return copy as unknown as Record<string, unknown>;
}

/** مرحلهٔ ۲ (نماهای یک صحنه). */
export function shotsVertexSchema(vertex: Record<string, unknown>): Record<string, unknown> {
  const scene = (vertex as { properties: { acts: { items: { properties: { scenes: { items: { properties: { shots: unknown } } } } } } } }).properties.acts.items.properties.scenes.items;
  return { type: "OBJECT", properties: { shots: structuredClone(scene.properties.shots) }, required: ["shots"] };
}

/* ---------- ترمیم ---------- */

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const numOr = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const pick = <T extends string>(list: readonly T[], v: unknown, d: T): T => (list.includes(v as T) ? (v as T) : d);
const pickOpt = <T extends string>(list: readonly T[], v: unknown): T | undefined => (list.includes(v as T) ? (v as T) : undefined);
const bool = (v: unknown) => (typeof v === "boolean" ? v : undefined);
const asciiId = (v: unknown, d: string) => {
  const s = typeof v === "string" ? v.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) : "";
  return s || d;
};
const lineNumbers = (v: unknown, lines: number, max: number) =>
  [...new Set(arr(v).filter((n): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= lines))].slice(0, max);
function unique(id: string, used: Set<string>): string {
  let out = id;
  for (let i = 2; used.has(out); i++) out = `${id}-${i}`;
  used.add(out);
  return out;
}

const DIALOGUE_LINE = /^\s*([^:：\n]{1,60}?)\s*(?:\([^)]*\)\s*)?[:：]\s*(.+)$/;
const stripParens = (s: string) => s.replace(/[(（][^)）]*[)）]/g, " ").replace(/\s+/g, " ").trim();

/** دیالوگ باید از متن کاربر باشد: یا عین (پس از یکسان‌سازی) در داستان آمده، یا گفتهٔ همان گوینده در خط‌های منبع نما است. */
export function traceDialogue(textIn: string, speakerName: string, source: string, sourceLines: number[]): { text: string; line?: number } | null {
  const lines = source.split("\n");
  const want = normalizeFa(stripParens(textIn));
  if (!want) return null;
  const findLine = (needle: string) => lines.findIndex((l) => normalizeFa(l).includes(needle));
  const at = findLine(want);
  if (at >= 0) return { text: stripParens(textIn), line: at + 1 };
  const who = normalizeFa(speakerName);
  for (const n of sourceLines) {
    const m = DIALOGUE_LINE.exec(lines[n - 1] ?? "");
    if (!m) continue;
    const speaker = normalizeFa(m[1]);
    if (who && (speaker.includes(who) || who.includes(speaker))) {
      const said = stripParens(m[2]);
      if (said) return { text: said, line: n };
    }
  }
  return null;
}

export type RepairResult = { plan: FilmPlan | null; warnings: string[] };
export type RepairOptions = { targetDurationSec?: number; format?: (typeof FORMATS)[number] };

/**
 * پاسخ خام مدل را به برنامهٔ معتبر تبدیل می‌کند. قطعی است: ورودی یکسان → خروجی یکسان.
 * چیزی که موتور نمی‌شناسد حذف یا با پیش‌فرض جایگزین می‌شود و هشدار فارسی می‌دهد.
 */
export function repairFilmPlan(raw: unknown, source: string, opts: RepairOptions = {}): RepairResult {
  const warnings: string[] = [];
  const warn = (m: string) => { if (!warnings.includes(m)) warnings.push(m); };
  const root = obj(raw);
  const lineTotal = source.split("\n").length;
  const metaIn = obj(root.meta);
  const meta: FilmPlan["meta"] = {
    title: text(metaIn.title, 120) || "فیلم",
    language: "fa",
    targetDurationSec: clamp(numOr(opts.targetDurationSec ?? metaIn.targetDurationSec, 240), TARGET_MIN_SEC, TARGET_MAX_SEC),
    style: pick(STYLES, metaIn.style, "ink"),
    format: opts.format ?? pick(FORMATS, metaIn.format, "landscape"),
  };
  const fps = Number(metaIn.fps);
  if (fps === 30 || fps === 60) meta.fps = fps;
  const logline = text(metaIn.logline, 400);
  if (logline) meta.logline = logline;

  // شخصیت‌ها
  const charIds = new Set<string>();
  const characters: FilmCharacter[] = [];
  const charsIn = arr(root.characters);
  if (charsIn.length > LIMITS.characters) warn(`فقط ${LIMITS.characters} شخصیت اول نگه داشته شد.`);
  for (const [i, c0] of charsIn.slice(0, LIMITS.characters).entries()) {
    const c = obj(c0);
    const name = text(c.name, 80);
    if (!name) continue;
    const id = unique(asciiId(c.id, `c${i + 1}`), charIds);
    const kind = pick(KINDS, c.kind, "man");
    const lookIn = obj(c.look);
    const look: NonNullable<FilmCharacter["look"]> = {};
    const hair = pickOpt(HAIRS, lookIn.hair); if (hair) look.hair = hair;
    const clothing = pickOpt(CLOTHES, lookIn.clothing); if (clothing) look.clothing = clothing;
    for (const k of ["glasses", "beard", "mustache", "cap"] as const) { const b = bool(lookIn[k]); if (b !== undefined) look[k] = b; }
    const voiceIn = obj(c.voice);
    let voiceId = text(voiceIn.voiceId, 40);
    if (!VOICE_IDS.includes(voiceId as (typeof VOICE_IDS)[number])) {
      if (voiceId) warn(`صدای «${voiceId}» برای ${name} در فهرست صداها نیست؛ صدای پیش‌فرض گذاشته شد.`);
      voiceId = defaultVoices([{ id, look: { kind } as Look }])[id];
    }
    const ch: FilmCharacter = { id, name, kind, voice: { voiceId } };
    const style = text(voiceIn.style, 200); if (style) ch.voice.style = style;
    const traits = arr(c.traits).map((t) => text(t, 80)).filter(Boolean).slice(0, 6); if (traits.length) ch.traits = traits;
    if (Object.keys(look).length) ch.look = look;
    const rigRef = text(c.rigRef, 200); if (rigRef) ch.rigRef = rigRef;
    characters.push(ch);
  }
  if (!characters.length) return { plan: null, warnings: [...warnings, "برنامهٔ فیلم شخصیتی نداشت."] };
  const nameOf = (id: string) => characters.find((c) => c.id === id)?.name ?? id;
  const charRef = (v: unknown) => (typeof v === "string" && charIds.has(v) ? v : undefined);

  // مکان‌ها
  const locIds = new Set<string>();
  const locations: FilmPlan["locations"] = [];
  for (const [i, l0] of arr(root.locations).slice(0, LIMITS.locations).entries()) {
    const l = obj(l0);
    let place = pickOpt(PLACES_LIST, l.place);
    if (!place) { warn(`مکان «${text(l.place, 40)}» در فهرست مکان‌ها نیست؛ زمینهٔ ساده گذاشته شد.`); place = "blank"; }
    const loc: FilmPlan["locations"][number] = { id: unique(asciiId(l.id, `loc${i + 1}`), locIds), place, label: text(l.label, 80) || PLACES[place].label };
    const bg = text(l.backgroundRef, 200); if (bg) loc.backgroundRef = bg;
    locations.push(loc);
  }
  if (!locations.length) { locations.push({ id: unique("loc1", locIds), place: "blank", label: PLACES.blank.label }); warn("برنامه مکانی نداشت؛ زمینهٔ ساده گذاشته شد."); }

  // پرده‌ها، صحنه‌ها، نماها
  const sceneIds = new Set<string>();
  const shotIds = new Set<string>();
  let shotCount = 0;
  const acts: FilmPlan["acts"] = [];
  for (const [ai, a0] of arr(root.acts).slice(0, LIMITS.acts).entries()) {
    const a = obj(a0);
    const scenes: FilmScene[] = [];
    for (const [si, s0] of arr(a.scenes).slice(0, LIMITS.scenesPerAct).entries()) {
      const s = obj(s0);
      const sceneId = unique(asciiId(s.id, `a${ai + 1}s${si + 1}`), sceneIds);
      let locationId = typeof s.locationId === "string" && locIds.has(s.locationId) ? s.locationId : "";
      if (!locationId) { warn(`صحنهٔ ${sceneId}: مکانش در فهرست نبود؛ مکان اول گذاشته شد.`); locationId = locations[0].id; }
      const shots: FilmShot[] = [];
      for (const [hi, h0] of arr(s.shots).slice(0, LIMITS.shotsPerScene).entries()) {
        if (shotCount >= LIMITS.totalShots) { warn(`فقط ${LIMITS.totalShots} نمای اول نگه داشته شد.`); break; }
        const shot = repairShot(obj(h0), `${sceneId}-sh${hi + 1}`, shotIds, charRef, nameOf, source, lineTotal, warn);
        if (shot) { shots.push(shot); shotCount++; }
      }
      if (!shots.length) { warn(`صحنهٔ ${sceneId} نمایی نداشت و حذف شد.`); continue; }
      const scene: FilmScene = { id: sceneId, locationId, timeOfDay: pick(TIMES, s.timeOfDay, "noon"), mood: pick(MOODS, s.mood, "calm"), summary: text(s.summary, 400), shots };
      const sl = lineNumbers(s.sourceLines, lineTotal, 200); if (sl.length) scene.sourceLines = sl;
      scenes.push(scene);
    }
    if (!scenes.length) continue;
    acts.push({ id: asciiId(a.id, `act${ai + 1}`), title: text(a.title, 120) || `پردهٔ ${ai + 1}`, purpose: pick(PURPOSES, a.purpose, PURPOSES[Math.min(ai, PURPOSES.length - 1)]), scenes });
  }
  if (!acts.length) return { plan: null, warnings: [...warnings, "برنامهٔ فیلم هیچ نمای قابل اجرایی نداشت."] };

  const plan: FilmPlan = { meta, characters, locations, acts };
  const total = planSeconds(plan);
  const target = meta.targetDurationSec;
  if (total < target * 0.85 || total > target * 1.15) warn(`مدت نماها ${Math.round(total)} ثانیه است، هدف ${target} ثانیه بود.`);
  const checked = filmPlanSchema.safeParse(plan);
  if (!checked.success) return { plan: null, warnings: [...warnings, `برنامهٔ ترمیم‌شده هنوز نامعتبر است: ${checked.error.issues[0]?.message ?? ""}`] };
  return { plan: checked.data, warnings };
}

function repairShot(h: Raw, fallbackId: string, used: Set<string>, charRef: (v: unknown) => string | undefined, nameOf: (id: string) => string, source: string, lineTotal: number, warn: (m: string) => void): FilmShot | null {
  const id = unique(asciiId(h.id, fallbackId), used);
  let duration = clamp(numOr(h.durationSec, 4), FILM_LIMITS.minShotSec, FILM_LIMITS.maxShotSec);
  const sourceLines = lineNumbers(h.sourceLines, lineTotal, 40);

  const onStage = new Set<string>();
  const characters: FilmShot["characters"] = [];
  for (const b0 of arr(h.characters)) {
    const b = obj(b0);
    const who = charRef(b.characterId);
    if (!who || onStage.has(who) || onStage.size >= LIMITS.onStage) continue;
    onStage.add(who);
    const block: FilmShot["characters"][number] = { characterId: who, startX: r2(clamp(numOr(b.startX, 0.5), -0.2, 1.2)) };
    const sit = bool(b.sit); if (sit !== undefined) block.sit = sit;
    const facing = pickOpt(FACINGS, b.facing); if (facing) block.facing = facing;
    const hold = pickOpt(HOLDS, b.hold); if (hold) block.hold = hold;
    characters.push(block);
  }

  // دیالوگ: ردیابی به متن، سپس زمان‌بندی پشت‌سرهم و قطعی
  const dialogue: FilmShot["dialogue"] = [];
  const linesIn = arr(h.dialogue).map(obj).filter((d) => charRef(d.speakerId))
    .map((d, i) => ({ d, i, start: numOr(d.startSec, 0) }))
    .sort((x, y) => x.start - y.start || x.i - y.i);
  let cursor = 0;
  for (const { d } of linesIn.slice(0, LIMITS.dialogue)) {
    const speakerId = charRef(d.speakerId)!;
    const traced = traceDialogue(text(d.text, 600), nameOf(speakerId), source, sourceLines);
    if (!traced) { warn(`نمای ${id}: دیالوگی که در متن داستان نبود حذف شد.`); continue; }
    const need = lineDuration(traced.text);
    const start = r2(Math.max(clamp(numOr(d.startSec, cursor), 0, 120), cursor));
    let end = clamp(numOr(d.endSec, start + need), 0.3, 120);
    if (end - start < need * 0.8) end = start + need;
    end = r2(Math.min(120, end));
    const line: FilmShot["dialogue"][number] = { speakerId, text: traced.text, startSec: start, endSec: end, emotion: pick(EXPRESSIONS, d.emotion, "neutral") };
    const delivery = text(d.delivery, 200); if (delivery) line.delivery = delivery;
    if (bool(d.overlapsPrevious)) line.overlapsPrevious = true;
    dialogue.push(line);
    cursor = end + 0.15;
    if (!sourceLines.includes(traced.line ?? 0) && traced.line && sourceLines.length < 40) sourceLines.push(traced.line);
  }
  const lastEnd = dialogue.length ? dialogue[dialogue.length - 1].endSec + 0.3 : 0;
  if (lastEnd > duration) duration = r2(clamp(lastEnd, FILM_LIMITS.minShotSec, FILM_LIMITS.maxShotSec));
  if (lastEnd > FILM_LIMITS.maxShotSec) warn(`نمای ${id}: دیالوگ‌ها از سقف ${FILM_LIMITS.maxShotSec} ثانیهٔ نما بلندترند.`);

  const acting: FilmShot["acting"] = [];
  for (const b0 of arr(h.acting).slice(0, LIMITS.acting)) {
    const b = obj(b0);
    const who = charRef(b.characterId);
    if (!who) continue;
    const beat: FilmShot["acting"][number] = { characterId: who, atSec: r2(clamp(numOr(b.atSec, 0), 0, Math.min(60, duration))), durationSec: r2(clamp(numOr(b.durationSec, 1), 0.2, 30)) };
    const gesture = pickOpt(GESTURES, b.gesture); if (gesture) beat.gesture = gesture;
    const expression = pickOpt(EXPRESSIONS, b.expression); if (expression) beat.expression = expression;
    if (typeof b.intensity === "number") beat.intensity = r2(clamp(b.intensity, 0, 1));
    const move = pickOpt(MOVES, b.move); if (move) beat.move = move;
    const target = charRef(b.targetId); if (target && target !== who) beat.targetId = target;
    if (typeof b.toX === "number") beat.toX = r2(clamp(b.toX, -0.2, 1.2));
    const sit = bool(b.sit); if (sit !== undefined) beat.sit = sit;
    const hold = pickOpt(HOLDS, b.hold); if (hold) beat.hold = hold;
    const lookAt = charRef(b.lookAt); if (lookAt) beat.lookAt = lookAt;
    if (bool(b.thought)) beat.thought = true;
    if (!beat.gesture && !beat.expression && !beat.move && beat.sit === undefined && !beat.hold && !beat.thought && beat.toX === undefined) continue;
    acting.push(beat);
  }
  acting.sort((x, y) => x.atSec - y.atSec);

  const audio: NonNullable<FilmShot["audio"]> = [];
  for (const c0 of arr(h.audio).slice(0, LIMITS.audio)) {
    const c = obj(c0);
    const cueId = text(c.id, 80);
    if (!cueId) continue;
    const cue: NonNullable<FilmShot["audio"]>[number] = { kind: pick(AUDIO_KINDS, c.kind, "sfx"), id: cueId, atSec: r2(clamp(numOr(c.atSec, 0), 0, 120)) };
    if (typeof c.durationSec === "number") cue.durationSec = r2(clamp(c.durationSec, 0, 300));
    if (typeof c.volume === "number") cue.volume = r2(clamp(c.volume, 0, 1));
    if (bool(c.continue)) cue.continue = true;
    audio.push(cue);
  }

  const shot: FilmShot = { id, shotType: pick(SHOT_TYPES, h.shotType, "wide"), cameraMove: pick(CAMERA_MOVES, h.cameraMove, "static"), durationSec: duration, characters, acting, dialogue, transitionOut: pick(TRANSITIONS, h.transitionOut, "cut") };
  const subject = charRef(h.subjectId); if (subject) shot.subjectId = subject;
  const lens = pickOpt(LENSES, h.lens); if (lens) shot.lens = lens;
  const caption = text(h.caption, 300); if (caption) shot.caption = caption;
  if (audio.length) shot.audio = audio;
  if (sourceLines.length) shot.sourceLines = [...sourceLines].sort((a, b) => a - b);
  return shot;
}

export const planSeconds = (plan: FilmPlan) => plan.acts.reduce((t, a) => t + a.scenes.reduce((u, s) => u + s.shots.reduce((v, h) => v + h.durationSec, 0), 0), 0);

/* ---------- کامپایل به موتور ---------- */

const FRAMING: Record<FilmShot["shotType"], Shot> = {
  establishing: "wide", wide: "wide", full: "wide", twoShot: "wide",
  medium: "medium", overShoulder: "medium", reaction: "medium", mediumClose: "close",
  close: "close", extremeClose: "close", insert: "close",
};

type Ev = { t: number; order: number; beat: Beat };

/** لحن بیانِ هر دیالوگ که Gemini نوشته؛ پس از نام‌گذاری بخش‌ها در compileFilmVoicing خوانده می‌شود. */
const DELIVERY = new WeakMap<Beat, string>();

/**
 * صدای هر شخصیت و لحن بیان هر دیالوگ از برنامهٔ فیلم، برای تنظیمات صداگذاری پروژه.
 * کلید styles همان شناسهٔ بخش است (`${shot.id}-${n}`) که lineJobs با آن لحن را پیدا می‌کند.
 */
export function compileFilmVoicing(plan: FilmPlan, source = ""): { voices: Record<string, string>; styles: Record<string, string> } {
  const voices: Record<string, string> = {};
  for (const c of plan.characters) if (c.voice?.voiceId) voices[c.id] = c.voice.voiceId;
  const styles: Record<string, string> = {};
  const lines = source.split("\n");
  const nameOf = (id: string) => plan.characters.find((c) => c.id === id)?.name ?? id;
  for (const act of plan.acts)
    for (const scene of act.scenes)
      for (const shot of scene.shots)
        for (const b of shotBeats(shot, nameOf, lines)) {
          const d = DELIVERY.get(b);
          if (d && b.id) styles[b.id] = d.slice(0, 120);
        }
  return { voices, styles };
}

/** برنامهٔ فیلم → StoryPlan. شناسهٔ هر بخش `${shot.id}-${n}` است تا ویرایش‌های کاربر پایدار بمانند. */
export function compileFilmPlan(plan: FilmPlan, source = ""): StoryPlan {
  const lines = source.split("\n");
  const cast = plan.characters.map((c) => ({ id: c.id, name: c.name, look: { kind: c.kind, ...c.look } as Look, guessed: false }));
  const nameOf = (id: string) => plan.characters.find((c) => c.id === id)?.name ?? id;
  const scenes: StoryScene[] = [];
  for (const act of plan.acts)
    for (const scene of act.scenes) {
      const loc = plan.locations.find((l) => l.id === scene.locationId) ?? plan.locations[0];
      const beats: Beat[] = [];
      for (const shot of scene.shots) beats.push(...shotBeats(shot, nameOf, lines));
      scenes.push({ heading: `${act.title} — ${loc.label}`, place: loc.place as PlaceId, night: scene.timeOfDay === "dusk" || scene.timeOfDay === "night", beats });
    }
  return { cast, scenes, warnings: [] };
}

function shotBeats(shot: FilmShot, nameOf: (id: string) => string, lines: string[]): Beat[] {
  const framing = FRAMING[shot.shotType];
  const events: Ev[] = [];
  const toAct = (a: FilmShot["acting"][number]): Act => {
    const act: Act = { who: a.characterId };
    if (a.gesture) act.gesture = a.gesture;
    if (a.expression) act.face = a.expression;
    if (a.move) act.move = a.move;
    if (a.targetId) act.target = a.targetId;
    if (a.toX !== undefined && !a.move) act.x = clamp(a.toX, 0.08, 0.92);
    if (a.sit !== undefined) act.sit = a.sit;
    if (a.hold === "none") act.drop = true;
    else if (a.hold) act.hold = a.hold;
    if (a.thought) act.thought = true;
    return act;
  };
  const blocking: Act[] = shot.characters
    .filter((b) => b.startX >= 0 && b.startX <= 1)
    .map((b) => {
      const act: Act = { who: b.characterId, x: r2(clamp(b.startX, 0.08, 0.92)) };
      if (b.sit !== undefined) act.sit = b.sit;
      if (b.hold === "none") act.drop = true;
      else if (b.hold) act.hold = b.hold;
      return act;
    });
  const used = new Set<number>();
  shot.dialogue.forEach((d, i) => {
    const acts = shot.acting.map((a, k) => ({ a, k })).filter(({ a, k }) => !used.has(k) && a.atSec >= d.startSec - 0.05 && a.atSec < d.endSec);
    acts.forEach(({ k }) => used.add(k));
    const own = acts.some(({ a }) => a.characterId === d.speakerId && a.expression);
    const list = acts.map(({ a }) => toAct(a));
    if (!own && d.emotion !== "neutral") list.unshift({ who: d.speakerId, face: d.emotion });
    const at = lines.findIndex((l) => normalizeFa(l).includes(normalizeFa(d.text)));
    const beat: Beat = { kind: "line", speaker: d.speakerId, text: d.text, acts: list, duration: r2(d.endSec - d.startSec) };
    if (d.delivery) DELIVERY.set(beat, d.delivery);
    if (at >= 0) {
      const start = Math.max(0, lines[at].indexOf(d.text));
      beat.source = { line: at, start, end: start + d.text.length, text: lines[at] };
    }
    events.push({ t: d.startSec, order: 1 + i, beat });
  });
  const groups = new Map<number, Act[]>();
  shot.acting.forEach((a, k) => {
    if (used.has(k)) return;
    const key = Math.round(a.atSec * 20) / 20;
    groups.set(key, [...(groups.get(key) ?? []), toAct(a)]);
  });
  for (const [t, acts] of [...groups].sort((x, y) => x[0] - y[0])) {
    const label = acts.map((a) => [nameOf(a.who), a.gesture ? GESTURE_LABELS[a.gesture] : a.move ?? a.face ?? ""].filter(Boolean).join(" ")).join("، ");
    events.push({ t, order: 100, beat: { kind: "action", text: label, acts } });
  }
  events.sort((x, y) => x.t - y.t || x.order - y.order);

  const out: Beat[] = [];
  if (shot.caption) out.push({ kind: "narration", text: shot.caption, duration: Math.min(shot.durationSec, lineDuration(shot.caption)) });
  let clock = out.length ? (out[0].duration ?? 0) : 0;
  // جای‌گیری اول نما روی اولین بخش غیرروایی؛ اگر نبود، یک بخش کنش کوتاه
  if (blocking.length) {
    const first = events.find((e) => e.beat.kind !== "narration");
    if (first && first.t <= clock + 0.05 && first.beat.kind !== "narration") {
      const acts = first.beat.acts;
      for (const b of blocking) {
        const has = acts.find((a) => a.who === b.who);
        if (has) Object.assign(has, { ...b, ...has, x: has.x ?? b.x });
        else acts.push(b);
      }
    } else events.unshift({ t: clock, order: 0, beat: { kind: "action", text: "", acts: blocking } });
  }
  events.forEach((e, i) => {
    const t = Math.max(e.t, clock);
    if (t - clock > 0.05) out.push({ kind: "action", text: "", acts: [], delay: r2(t - clock) });
    const next = events[i + 1] ? Math.max(events[i + 1].t, t) : shot.durationSec;
    if (e.beat.kind === "line") clock = t + (e.beat.duration ?? 0);
    else { e.beat.duration = r2(Math.max(0.5, next - t)); clock = t + e.beat.duration; }
    e.beat.shot = framing;
    out.push(e.beat);
  });
  if (shot.durationSec - clock > 0.05) out.push({ kind: "action", text: "", acts: [], delay: r2(shot.durationSec - clock) });
  out.forEach((b, i) => { b.id = `${shot.id}-${i}`; });
  return out;
}

/* ---------- ورود به موتور، با بازگشت به فهم دیکشنری ---------- */

export type FilmDirected = Directed & { mode: "plan" | "text" };

/** برنامه اگر معتبر و قابل‌اجرا باشد اجرا می‌شود؛ وگرنه همان مسیر قدیمی parseStory → directStory. */
export function storyPlanFor(text: string, plan?: unknown): { story: StoryPlan; mode: "plan" | "text"; warnings: string[] } {
  if (plan !== undefined && plan !== null) {
    // همیشه با متن فعلی ترمیم می‌شود تا دیالوگی که کاربر از داستان پاک کرده اجرا نشود.
    const fixed = repairFilmPlan(plan, text);
    if (fixed.plan) {
      const story = compileFilmPlan(fixed.plan, text);
      if (story.scenes.some((s) => s.beats.length)) return { story: { ...story, warnings: fixed.warnings }, mode: "plan", warnings: fixed.warnings };
    }
    const warnings = [...fixed.warnings, "برنامهٔ فیلم قابل اجرا نبود؛ داستان با فهم دیکشنری ساخته شد."];
    const story = parseStory(text);
    return { story: { ...story, warnings: [...warnings, ...story.warnings] }, mode: "text", warnings };
  }
  return { story: parseStory(text), mode: "text", warnings: [] };
}

export function directFilm(text: string, plan?: unknown): FilmDirected {
  const { story, mode } = storyPlanFor(text, plan);
  return { ...directStory(story), mode };
}
