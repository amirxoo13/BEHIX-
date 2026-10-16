import { normalizeFa } from "../catalog.ts";
import { z } from "zod";
import { FACES, type Expression } from "./face.ts";
import { CLOTHES, type Look } from "./figure.ts";
import { parseStory, type Beat, type StoryPlan } from "./story-parse.ts";
import { directStory } from "./story-direct.ts";
import type { Format } from "./layout.ts";
import { PLACE_IDS, type PlaceId } from "./places.ts";

const finite = z.number().finite();
export const lookSchema = z
  .object({
    kind: z.enum(["man", "woman", "boy", "girl", "oldMan", "oldWoman", "baby"]),
    hair: z
      .enum(["tufts", "short", "bald", "curly", "long", "bob", "ponytail", "scarf"])
      .optional(),
    clothing: z.enum(CLOTHES).optional(),
    glasses: z.boolean().optional(),
    mustache: z.boolean().optional(),
    beard: z.boolean().optional(),
    cap: z.boolean().optional(),
  })
  .strict();
const signatureSchema = z
  .string()
  .max(22000)
  .refine((value) => {
    if (value === "") return true;
    try {
      const tuple: unknown = JSON.parse(value);
      return (
        Array.isArray(tuple) &&
        tuple.length === 4 &&
        tuple.every((x) => typeof x === "string") &&
        ["action", "line", "narration"].includes(tuple[1])
      );
    } catch {
      return false;
    }
  }, "ارجاع بخش داستان معتبر نیست.");
const anchorSchema = z
  .object({
    signature: signatureSchema.refine((s) => s.length > 0),
    previous: signatureSchema,
    next: signatureSchema,
  })
  .strict();
const editSchema = z
  .object({
    id: z.string().max(100),
    beatId: z.string().max(100),
    anchor: anchorSchema,
    actor: z.string().max(100).optional(),
    x: finite.min(0.08).max(0.92).optional(),
    face: z.enum(Object.keys(FACES) as [Expression, ...Expression[]]).optional(),
    duration: finite.min(1).max(120).optional(),
    place: z.enum(PLACE_IDS as [PlaceId, ...PlaceId[]]).optional(),
    night: z.boolean().optional(),
    unresolved: z.boolean().optional(),
  })
  .strict();
const castSchema = z
  .object({ id: z.string().min(1).max(100), name: z.string().min(1).max(80), look: lookSchema })
  .strict();
export const projectSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(100),
    title: z.string().min(1).max(120),
    text: z.string().max(20000),
    edits: z.array(editSchema).max(500),
    cast: z.array(castSchema).max(8),
    settings: z
      .object({
        format: z.enum(["portrait", "square", "landscape"]),
        fps: z.union([z.literal(30), z.literal(60)]),
        captions: z.boolean(),
      })
      .strict(),
    updatedAt: finite.nonnegative(),
  })
  .strict()
  .superRefine((p, ctx) => {
    for (const field of ["cast", "edits"] as const) {
      const ids = p[field].map((v) => v.id);
      if (new Set(ids).size !== ids.length)
        ctx.addIssue({ code: "custom", path: [field], message: "شناسهٔ تکراری" });
    }
  });
export type StoryProject = z.infer<typeof projectSchema>;
export type StoryEdit = z.infer<typeof editSchema>;
export type LibraryCharacter = z.infer<typeof castSchema>;
export function newProject(text = "", title = "داستان تازه"): StoryProject {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title,
    text,
    edits: [],
    cast: [],
    settings: { format: "portrait", fps: 30, captions: true },
    updatedAt: Date.now(),
  };
}
export function importProject(json: string): StoryProject {
  if (json.length > 2_000_000) throw new Error("فایل پروژه بیش از حد بزرگ است.");
  let value:unknown;
  try { value=JSON.parse(json); } catch { throw new Error("فایل JSON معتبر نیست."); }
  const result = projectSchema.safeParse(value);
  if (!result.success) throw new Error("ساختار یا نسخهٔ فایل پروژه معتبر نیست.");
  return result.data;
}
export const projectJson = (p: StoryProject) => JSON.stringify(projectSchema.parse(p), null, 2);
const signature = (scene: string, b: Beat) =>
  JSON.stringify([scene, b.kind, b.kind === "line" ? b.speaker : "", normalizeFa(b.text)]);
export function anchors(plan: StoryPlan) {
  return plan.scenes.flatMap((s) =>
    s.beats.map((b, i) => ({
      beat: b,
      anchor: {
        signature: signature(s.heading, b),
        previous: i ? signature(s.heading, s.beats[i - 1]) : "",
        next: i + 1 < s.beats.length ? signature(s.heading, s.beats[i + 1]) : "",
      },
    })),
  );
}
export function reconcileEdits(edits: StoryEdit[], plan: StoryPlan): StoryEdit[] {
  const candidates = anchors(plan);
  return edits.map((edit) => {
    if (edit.actor && !plan.cast.some((c) => c.id === edit.actor))
      return { ...edit, unresolved: true };
    let matches = candidates.filter((c) => c.anchor.signature === edit.anchor.signature);
    if (matches.length > 1)
      matches = matches.filter(
        (c) => c.anchor.previous === edit.anchor.previous && c.anchor.next === edit.anchor.next,
      );
    const match = matches.length === 1 ? matches[0] : undefined;
    return match
      ? { ...edit, beatId: match.beat.id!, anchor: match.anchor, unresolved: false }
      : { ...edit, unresolved: true };
  });
}
export function changeText(p: StoryProject, text: string): StoryProject {
  const limited = text.slice(0, 20000);
  return { ...p, text: limited, edits: reconcileEdits(p.edits, parseStory(limited)) };
}
export function setEdit(
  p: StoryProject,
  beatId: string,
  patch: {
    actor?: string;
    x?: number;
    face?: Expression;
    duration?: number;
    place?: PlaceId;
    night?: boolean;
  },
): StoryProject {
  const match = anchors(parseStory(p.text)).find((a) => a.beat.id === beatId);
  if (!match) return p;
  const index = p.edits.findIndex(
    (e) => !e.unresolved && e.beatId === beatId && e.actor === patch.actor,
  );
  const previous = p.edits[index];
  const edit: StoryEdit = {
    ...previous,
    ...patch,
    id: previous?.id ?? crypto.randomUUID(),
    beatId,
    anchor: match.anchor,
    unresolved: false,
  };
  const edits = [...p.edits];
  if (index >= 0) edits[index] = edit;
  else edits.push(edit);
  return projectSchema.parse({ ...p, edits });
}
export function compileProject(p: StoryProject) {
  const plan = parseStory(p.text);
  for (const member of plan.cast) {
    const saved = p.cast.find((c) => c.id === member.id);
    if (saved) member.look = { ...saved.look };
  }
  const edits = reconcileEdits(p.edits, plan);
  for (const scene of plan.scenes)
    for (const beat of scene.beats)
      for (const edit of edits) {
        if (edit.unresolved || edit.beatId !== beat.id) continue;
        if (edit.place !== undefined) scene.place = edit.place;
        if (edit.night !== undefined) scene.night = edit.night;
        if (edit.duration !== undefined && beat.kind === "line") beat.duration = edit.duration;
        if (beat.kind !== "narration" && edit.actor && (edit.x !== undefined || edit.face)) {
          let act = beat.acts.find((a) => a.who === edit.actor);
          if (!act) {
            act = { who: edit.actor };
            beat.acts.push(act);
          }
          if (edit.x !== undefined) act.x = edit.x;
          if (edit.face) act.face = edit.face;
        }
      }
  const directed = directStory(plan);
  return { ...directed, unresolved: edits.filter((e) => e.unresolved) };
}
export function copyCharacter(p: StoryProject, character: LibraryCharacter): StoryProject {
  // Snapshot semantics: library changes never mutate existing projects.
  const cast = p.cast.filter((c) => c.id !== character.id);
  if (cast.length >= 8) throw new Error("حداکثر هشت شخصیت در هر داستان ذخیره می‌شود.");
  return { ...p, cast: [...cast, structuredClone(character)] };
}
export type History<T> = { past: T[]; present: T; future: T[] };
export const history = <T>(present: T): History<T> => ({ past: [], present, future: [] });
export function remember<T>(h: History<T>, present: T, coalesce = false): History<T> {
  return { past: coalesce ? h.past : [...h.past, h.present].slice(-100), present, future: [] };
}
export function undo<T>(h: History<T>): History<T> {
  return h.past.length
    ? { past: h.past.slice(0, -1), present: h.past.at(-1)!, future: [h.present, ...h.future] }
    : h;
}
export function redo<T>(h: History<T>): History<T> {
  return h.future.length
    ? { past: [...h.past, h.present].slice(-100), present: h.future[0], future: h.future.slice(1) }
    : h;
}
export const withSettings = (p: StoryProject, format: Format) => ({
  ...p,
  settings: { ...p.settings, format },
});
export type { Look };
