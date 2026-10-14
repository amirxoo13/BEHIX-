/**
 * روش ۲: فهم سناریو با مدل زبانی. این فایل فقط متن درخواست را می‌سازد و پاسخ مدل را
 * سخت‌گیرانه با کاتالوگ چک می‌کند؛ تماس واقعی با مدل در سرور است (src/lib/script-ai.ts).
 * هر شناسه‌ای که در کاتالوگ نباشد دور ریخته می‌شود، پس مدل نمی‌تواند چیزی از خودش بسازد.
 */
import {
  ACTION_ENTRIES,
  BACKGROUNDS,
  CAMERA_ENTRIES,
  CHARACTERS,
  EMOTION_ENTRIES,
  IDS,
  SFX_ENTRIES,
  type Entry,
} from "./catalog.ts";
import { WORLD } from "./labels.ts";
import { MAX_SHOTS, type Plan, type PlanShot } from "./script-plan.ts";
import type { Action, BgId, CameraId, Emotion, SfxId } from "./types.ts";

export type ChatMessage = { role: "system" | "user"; content: string };

function list<T extends string>(entries: Entry<T>[]): string {
  return entries
    .map((e) => `- ${e.id}: ${[e.label, ...e.aliases.filter((a) => a !== e.label)].slice(0, 6).join("، ").replace(/\*/g, "")}`)
    .join("\n");
}

export function buildMessages(script: string): ChatMessage[] {
  const system = `You convert a Persian animation screenplay into JSON for an animation studio.
Use ONLY the ids listed below. Never invent ids. Reply with one JSON object and nothing else.

CHARACTERS (id: Persian names)
${list(CHARACTERS)}

BACKGROUNDS (id: Persian place names)
${list(BACKGROUNDS)}

EMOTIONS
${list(EMOTION_ENTRIES)}

ACTIONS
${list(ACTION_ENTRIES)}

SOUND EFFECTS
${list(SFX_ENTRIES.filter((e) => e.id !== "none"))}
- none: no sound effect

CAMERAS (optional)
${list(CAMERA_ENTRIES)}

Output format:
{"shots":[{"scene":0,"heading":"<scene heading as written>","background":"<background id>","actionLine":"<scene description text before this line, Persian>","speaker":"<character id or null>","dialogue":"<spoken words exactly as written, without stage directions>","characters":[{"id":"<character id>","emotion":"<emotion id>","action":"<action id>"}],"sfx":"<sound id or none>","camera":"<camera id, optional>"}]}

Rules:
- One shot per spoken line. A description with no spoken line after it becomes a shot with "speaker": null.
- "scene" starts at 0 and increases by 1 whenever the place changes.
- "characters" lists everyone present in that shot (the speaker first), with emotion and action read from the text and stage directions; use "neutral" and "idle" when nothing is said.
- Keep all Persian text exactly as written. Do not translate.`;
  return [
    { role: "system", content: system },
    { role: "user", content: script },
  ];
}

/** متن JSON را از پاسخ مدل جدا می‌کند (بعضی مدل‌ها دورش ``` یا توضیح می‌گذارند). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("پاسخ مدل JSON نداشت.");
  return JSON.parse(text.slice(start, end + 1));
}

function pick<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;
}

function text(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** پاسخ مدل را به `Plan` تبدیل می‌کند؛ هر چیز خارج از کاتالوگ با یک هشدار کنار گذاشته می‌شود. */
export function planFromModelReply(reply: string): { ok: true; plan: Plan } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = extractJson(reply);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "پاسخ مدل خوانا نبود." };
  }
  const rawShots = (data as { shots?: unknown })?.shots;
  if (!Array.isArray(rawShots) || rawShots.length === 0) {
    return { ok: false, error: "مدل هیچ نمایی برنگرداند." };
  }

  const warnings: string[] = [];
  const dropped = new Set<string>();
  const shots: PlanShot[] = [];
  let lastScene = 0;
  let lastBg: BgId | undefined;

  for (const [i, item] of rawShots.slice(0, MAX_SHOTS).entries()) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const scene = Number.isInteger(o.scene) && (o.scene as number) >= 0 ? (o.scene as number) : lastScene;
    let background = pick<BgId>(o.background, IDS.backgrounds as BgId[]);
    if (!background) {
      if (o.background !== undefined) dropped.add(`مکان «${String(o.background)}»`);
      background = lastBg ?? "living";
    }
    let speaker: string | null = pick(o.speaker, IDS.characters) ?? null;
    if (o.speaker && !speaker) {
      dropped.add(`شخصیت «${String(o.speaker)}»`);
      speaker = null;
    }
    const cast: string[] = [];
    const emotion: Record<string, Emotion> = {};
    const action: Record<string, Action> = {};
    if (speaker) cast.push(speaker);
    for (const c of Array.isArray(o.characters) ? o.characters : []) {
      const r = (c ?? {}) as Record<string, unknown>;
      const id = pick(r.id, IDS.characters);
      if (!id) {
        if (r.id !== undefined) dropped.add(`شخصیت «${String(r.id)}»`);
        continue;
      }
      if (!cast.includes(id)) cast.push(id);
      const e = pick<Emotion>(r.emotion, IDS.emotions as Emotion[]);
      const a = pick<Action>(r.action, IDS.actions as Action[]);
      if (e) emotion[id] = e;
      else if (r.emotion !== undefined) dropped.add(`حالت «${String(r.emotion)}»`);
      if (a) action[id] = a;
      else if (r.action !== undefined) dropped.add(`حرکت «${String(r.action)}»`);
    }
    const sfx = pick<SfxId>(o.sfx, IDS.sfx as SfxId[]) ?? "none";
    if (o.sfx !== undefined && !pick(o.sfx, IDS.sfx)) dropped.add(`صدای «${String(o.sfx)}»`);
    const camera = pick<CameraId>(o.camera, IDS.cameras as CameraId[]);
    const dialogue = speaker ? text(o.dialogue) : "";
    const actionLine = text(o.actionLine);
    if (!speaker && !actionLine && !dialogue) {
      warnings.push(`نمای ${i + 1} از پاسخ مدل خالی بود و حذف شد.`);
      continue;
    }
    shots.push({
      scene,
      heading: text(o.heading) || WORLD[background].place,
      background,
      actionLine,
      speaker,
      dialogue,
      cast,
      emotion,
      action,
      sfx,
      ...(camera ? { camera } : {}),
    });
    lastScene = scene;
    lastBg = background;
  }

  if (rawShots.length > MAX_SHOTS) warnings.push(`فقط ${MAX_SHOTS} نمای اول ساخته شد.`);
  for (const d of dropped) warnings.push(`${d} در کاتالوگ نبود و کنار گذاشته شد.`);
  if (shots.length === 0) return { ok: false, error: "هیچ نمای معتبری در پاسخ مدل نبود." };
  // شخصیت‌های هر صحنه را یکی می‌کنیم تا چینش، حاضران صحنه را بداند.
  const byScene = new Map<number, string[]>();
  for (const s of shots) {
    const all = byScene.get(s.scene) ?? [];
    for (const c of s.cast) if (!all.includes(c)) all.push(c);
    byScene.set(s.scene, all);
  }
  for (const s of shots) {
    const all = byScene.get(s.scene) ?? [];
    s.cast = [...s.cast, ...all.filter((c) => !s.cast.includes(c))];
  }
  return { ok: true, plan: { shots, warnings } };
}
