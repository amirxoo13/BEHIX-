/**
 * از سناریوی نوشته‌شده تا نماهای سایت، در دو مرحلهٔ جدا:
 *
 * ۱. فهم متن → `Plan`: چه کسی، کجا، چه می‌گوید، با چه حالتی. دو راه دارد:
 *    `planFromDictionary` (همین فایل، بدون هوش مصنوعی) یا مدل زبانی (script-llm.ts).
 *    هر دو فقط شناسه‌های داخل کاتالوگ را خروجی می‌دهند.
 * ۲. چینش → `layoutPlan`: کد ثابت که از `Plan` نماهای واقعی می‌سازد
 *    (کدام بازیگر چپ/راست، دوربین، مدت هر نما). مدل زبانی هیچ‌وقت این بخش را انجام نمی‌دهد.
 */
import { CAST, findChar } from "./characters.ts";
import {
  ACTION_ENTRIES,
  BACKGROUNDS,
  CHARACTERS,
  EMOTION_ENTRIES,
  SFX_ENTRIES,
  findAll,
  findFirst,
  normalizeFa,
  type Entry,
} from "./catalog.ts";
import { WORLD } from "./labels.ts";
import { newId } from "./project.ts";
import type { Action, BgId, CameraId, Emotion, SfxId, Shot, Speaker } from "./types.ts";

export type PlanShot = {
  /** شمارهٔ صحنه؛ نماهای پشت‌سرهم با شمارهٔ یکسان در یک مکان‌اند. */
  scene: number;
  heading: string;
  background: BgId;
  actionLine: string;
  /** شناسهٔ شخصیت گوینده، یا null برای نمای بدون دیالوگ. */
  speaker: string | null;
  dialogue: string;
  /** شخصیت‌های حاضر در صحنه به ترتیب ورود. */
  cast: string[];
  emotion: Record<string, Emotion>;
  action: Record<string, Action>;
  sfx: SfxId;
  camera?: CameraId;
};

export type Plan = {
  shots: PlanShot[];
  warnings: string[];
  /** تعداد جاهایی که دیکشنری مطمئن نبود؛ صفر یعنی مدل زبانی لازم نیست. */
  uncertain?: number;
};

export const MAX_SHOTS = 60;
export const MAX_SCRIPT_CHARS = 12000;

const HEADER = /^\s*\[(.+)\]\s*$/;
const HEADER_WORDS = ["صحنه", "سکانس", "داخلی", "خارجی"];
export const DIALOGUE = /^([^:：]{1,40})[:：]\s*(.*)$/;
const PAREN = /\(([^)]*)\)|（([^）]*)）/g;

/** جملهٔ گفته‌شده بدون پرانتزها، و متن داخل پرانتزها. */
export function splitDirections(text: string): { said: string; directions: string } {
  const dirs: string[] = [];
  const said = text.replace(PAREN, (_, a: string | undefined, b: string | undefined) => {
    dirs.push(a ?? b ?? "");
    return " ";
  });
  return { said: said.replace(/\s+/g, " ").trim(), directions: dirs.join(" ") };
}

export function isHeader(line: string): string | null {
  const m = HEADER.exec(line);
  if (m) return m[1].trim();
  const n = normalizeFa(line);
  if (HEADER_WORDS.some((w) => n === w || n.startsWith(`${w} `))) return line.trim();
  return null;
}

function backgroundOf(text: string): BgId | undefined {
  const bg = findFirst(text, BACKGROUNDS);
  if (bg === "streetDay" && normalizeFa(text).split(" ").includes("شب")) return "streetNight";
  return bg;
}

/** حالت/حرکت‌های یک خط توضیح را به نزدیک‌ترین شخصیتِ قبل از آن نسبت می‌دهد. */
function assignToCharacters<T extends string>(line: string, entries: Entry<T>[]): Record<string, T> {
  const chars = findAll(line, CHARACTERS);
  const out: Record<string, T> = {};
  if (chars.length === 0) return out;
  for (const m of findAll(line, entries)) {
    const before = chars.filter((c) => c.at <= m.at);
    const owner = (before[before.length - 1] ?? chars[0]).id;
    if (!(owner in out)) out[owner] = m.id;
  }
  return out;
}

type SceneDraft = {
  heading: string;
  background?: BgId;
  backgroundFromText?: BgId;
  cast: string[];
  shots: Omit<PlanShot, "cast" | "background" | "scene" | "heading">[];
};

/** روش ۱: فهم سناریو با دیکشنری کاتالوگ. همیشه در دسترس، بدون اینترنت. */
export function planFromDictionary(script: string): Plan {
  const warnings: string[] = [];
  const scenes: SceneDraft[] = [];
  let scene: SceneDraft | null = null;
  let pendingDesc: string[] = [];
  let pendingSfx: SfxId = "none";
  let pendingEmotion: Record<string, Emotion> = {};
  let pendingAction: Record<string, Action> = {};
  const unknownNames = new Set<string>();
  let uncertain = 0;

  const open = (heading: string) => {
    scene = { heading, cast: [], shots: [] };
    scenes.push(scene);
    const bg = backgroundOf(heading);
    if (bg) scene.background = bg;
    else if (heading) {
      warnings.push(`مکانِ «${heading}» در کاتالوگ پیدا نشد.`);
      uncertain++;
    }
  };
  const addCast = (id: string) => {
    if (scene && !scene.cast.includes(id)) scene.cast.push(id);
  };
  const flushDescription = () => {
    if (!scene || pendingDesc.length === 0) return;
    scene.shots.push({
      actionLine: pendingDesc.join(" "),
      speaker: null,
      dialogue: "",
      emotion: pendingEmotion,
      action: pendingAction,
      sfx: pendingSfx,
    });
    pendingDesc = [];
    pendingSfx = "none";
    pendingEmotion = {};
    pendingAction = {};
  };

  for (const rawLine of script.slice(0, MAX_SCRIPT_CHARS).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = isHeader(line);
    if (heading !== null) {
      flushDescription();
      open(heading);
      continue;
    }
    if (!scene) open("");
    const current = scene as unknown as SceneDraft;

    const dlg = DIALOGUE.exec(line);
    const speaker = dlg ? findFirst(dlg[1], CHARACTERS) : undefined;
    if (dlg && speaker) {
      const { said, directions: dir } = splitDirections(dlg[2]);
      addCast(speaker);
      const emotion = { ...pendingEmotion };
      const action = { ...pendingAction };
      const e = findFirst(dir, EMOTION_ENTRIES);
      const a = findFirst(dir, ACTION_ENTRIES);
      if (e) emotion[speaker] = e;
      if (a) action[speaker] = a;
      const dirSfx = findFirst(dir, SFX_ENTRIES);
      if (dir.trim() && !e && !a && !dirSfx) uncertain++;
      current.shots.push({
        actionLine: pendingDesc.join(" "),
        speaker,
        dialogue: said,
        emotion,
        action,
        sfx: dirSfx ?? pendingSfx,
      });
      pendingDesc = [];
      pendingSfx = "none";
      pendingEmotion = {};
      pendingAction = {};
      continue;
    }
    if (dlg && normalizeFa(dlg[1]).split(" ").length <= 3) {
      unknownNames.add(dlg[1].trim());
      uncertain++;
    }

    // خط توضیح صحنه
    pendingDesc.push(line);
    for (const c of findAll(line, CHARACTERS)) addCast(c.id);
    if (!current.background && !current.backgroundFromText) {
      current.backgroundFromText = backgroundOf(line);
    }
    const sfx = findFirst(line, SFX_ENTRIES);
    if (sfx) pendingSfx = sfx;
    Object.assign(pendingEmotion, assignToCharacters(line, EMOTION_ENTRIES));
    Object.assign(pendingAction, assignToCharacters(line, ACTION_ENTRIES));
  }
  flushDescription();

  for (const name of unknownNames) {
    warnings.push(`«${name}» در فهرست بازیگرها نیست؛ آن خط توضیح صحنه حساب شد.`);
  }

  const shots: PlanShot[] = [];
  let lastBg: BgId | undefined;
  scenes.forEach((s, i) => {
    let background = s.background ?? s.backgroundFromText ?? lastBg;
    if (!background) {
      background = "living";
      uncertain++;
      warnings.push(`صحنهٔ ${i + 1}: مکان مشخص نبود؛ «${WORLD.living.place}» گذاشته شد.`);
    }
    lastBg = background;
    const heading = s.heading || WORLD[background].place;
    for (const shot of s.shots) {
      shots.push({ ...shot, scene: i, heading, background, cast: [...s.cast] });
    }
  });

  if (shots.length > MAX_SHOTS) {
    warnings.push(`فقط ${MAX_SHOTS} نمای اول ساخته شد.`);
    shots.length = MAX_SHOTS;
  }
  return { shots, warnings, uncertain };
}

function words(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

/** مدت نما از طول دیالوگ (حدود ۲.۴ کلمه در ثانیه)؛ بعد از ضبط صدا قابل تغییر است. */
export function durationFor(shot: Pick<PlanShot, "speaker" | "dialogue">): number {
  if (!shot.speaker || !shot.dialogue) return 3.5;
  return Math.round(clamp(1.5 + words(shot.dialogue) * 0.42, 2.5, 12) * 10) / 10;
}

/** موتور چینش: از برنامهٔ فهمیده‌شده، نماهای واقعی سایت را می‌سازد. */
export function layoutPlan(plan: Plan): { shots: Shot[]; warnings: string[] } {
  const warnings = [...plan.warnings];
  const everyone: string[] = [];
  for (const s of plan.shots) for (const c of [...s.cast, s.speaker ?? ""]) {
    if (c && !everyone.includes(c)) everyone.push(c);
  }

  const out: Shot[] = [];
  let sceneNo = -1;
  let pair: [string, string] = [CAST[0].id, CAST[1].id];
  let lastSpeaker: string | null = null;
  let carried: Record<string, Emotion> = {};
  let firstInScene = true;

  for (const p of plan.shots) {
    if (p.scene !== sceneNo) {
      sceneNo = p.scene;
      firstInScene = true;
      lastSpeaker = null;
      carried = {};
      const present = [...p.cast];
      if (p.speaker && !present.includes(p.speaker)) present.unshift(p.speaker);
      if (present.length === 0) present.push(everyone[0] ?? CAST[0].id);
      if (present.length === 1) {
        const only = present[0];
        present.push(everyone.find((c) => c !== only) ?? CAST.find((c) => c.id !== only)!.id);
        warnings.push(
          `صحنهٔ ${sceneNo + 1}: فقط یک شخصیت داشت؛ «${findChar(present[1]).name}» برای نفر دوم قاب گذاشته شد.`,
        );
      }
      pair = [present[0], present[1]];
    } else {
      firstInScene = false;
    }

    if (p.speaker && !pair.includes(p.speaker)) {
      const keepLeft = lastSpeaker === pair[0];
      pair = keepLeft ? [pair[0], p.speaker] : [p.speaker, pair[1]];
    }
    const side: Speaker = !p.speaker ? "none" : p.speaker === pair[0] ? "a" : "b";

    const slot = (id: string) => {
      const emotion = p.emotion[id] ?? carried[id] ?? "neutral";
      carried[id] = emotion;
      return { charId: id, emotion, action: p.action[id] ?? "idle" };
    };
    const actorA = slot(pair[0]);
    const actorB = slot(pair[1]);

    let camera: CameraId;
    if (p.camera) camera = p.camera;
    else if (firstInScene) camera = "wide";
    else if (side === "none") camera = "push";
    else if ((side === "a" ? actorA : actorB).emotion === "shock") camera = "comic";
    else if (words(p.dialogue) > 14) camera = "medium";
    else camera = side === "a" ? "closeLeft" : "closeRight";

    out.push({
      id: newId(),
      heading: p.heading,
      actionLine: p.actionLine,
      duration: durationFor(p),
      background: p.background,
      camera,
      dialogue: side === "none" ? "" : p.dialogue,
      speaker: side,
      sfx: p.sfx,
      pitch: 1,
      actorA,
      actorB,
    });
    if (p.speaker) lastSpeaker = p.speaker;
  }
  return { shots: out, warnings };
}
