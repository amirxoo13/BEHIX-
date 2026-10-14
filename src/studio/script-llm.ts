/**
 * روش ۲: فهم سناریو با مدل زبانی — با کمترین مصرف توکن.
 *
 * - به مدل خط‌های شماره‌دار سناریو و یک کاتالوگ فشرده (فقط شناسه و اسم اصلی) داده می‌شود.
 * - مدل متن سناریو را دوباره نمی‌نویسد؛ فقط برای هر خط شماره و شناسه‌ها را برمی‌گرداند:
 *     {"s":[[3,"cafe","parviz","parviz:laugh:point,pahlavan:shock",""], ...]}
 * - متن دیالوگ، توضیح و سرصحنه از خود سناریو برداشته می‌شود؛ پس مدل نمی‌تواند متن را عوض کند.
 * - هر شناسه‌ای که در کاتالوگ نباشد دور ریخته می‌شود.
 * تماس واقعی با مدل در سرور است (src/lib/script-ai.ts).
 */
import { BACKGROUNDS, CHARACTERS, IDS } from "./catalog.ts";
import { WORLD } from "./labels.ts";
import {
  DIALOGUE,
  MAX_SHOTS,
  isHeader,
  sceneTraits,
  splitDirections,
  type Plan,
  type PlanShot,
} from "./script-plan.ts";
import type { Action, BgId, Emotion, SfxId } from "./types.ts";

export type ChatMessage = { role: "system" | "user"; content: string };

/** خط‌های سناریو با شمارهٔ ۱-پایه؛ خط‌های خالی شماره می‌گیرند ولی فرستاده نمی‌شوند. */
export function scriptLines(script: string): string[] {
  return script.split(/\r?\n/).map((l) => l.trim());
}

function numbered(script: string): string {
  return scriptLines(script)
    .map((l, i) => (l ? `${i + 1}|${l}` : ""))
    .filter(Boolean)
    .join("\n");
}

/** تعداد خط‌های غیرخالی؛ برای تعیین سقف طول جواب مدل. */
export function lineCount(script: string): number {
  return scriptLines(script).filter(Boolean).length;
}

/** سقف توکن خروجی: حدود ۴۰ توکن برای هر خط کافی است؛ جلوی جواب‌های طولانی و پرهزینه را می‌گیرد. */
export function maxOutputTokens(script: string): number {
  return Math.min(3000, 60 + 40 * lineCount(script));
}

export function buildMessages(script: string): ChatMessage[] {
  const chars = CHARACTERS.map((c) => `${c.id}=${c.label}`).join(", ");
  const places = BACKGROUNDS.map((b) => `${b.id}=${b.label}`).join(", ");
  const system = `Annotate a numbered Persian screenplay ("N|text"). Reply ONLY compact JSON, no spaces:
{"s":[[N,"bg","speaker","id:emotion:action,id:emotion:action","sfx"]]}
One item per spoken line (speaker=character id). Description lines belong to the next spoken line; give them their own item (speaker="") only when no spoken line follows in that scene.
List everyone present. Omit ":emotion:action" parts that are neutral/idle. sfx only if the text names that sound, else "". Use only these ids:
chars: ${chars}
bg: ${places}
emotion: neutral,smile,laugh,angry,cry,shock,poker(expressionless)
action: idle,walk,point,tea(holding tea glass),hips(hands on hips),head(hand on head)
sfx: clink,door,horn,shock,slap,beep(censor),crickets(awkward silence),rimshot`;
  return [
    { role: "system", content: system },
    { role: "user", content: numbered(script) },
  ];
}

/** متن JSON را از پاسخ مدل جدا می‌کند (بعضی مدل‌ها دورش ``` می‌گذارند). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("پاسخ مدل JSON نداشت.");
  return JSON.parse(text.slice(start, end + 1));
}

function pick<T extends string>(v: unknown, allowed: readonly string[]): T | undefined {
  return typeof v === "string" && allowed.includes(v) ? (v as T) : undefined;
}

/** پاسخ فشردهٔ مدل + متن اصلی سناریو → `Plan`. */
export function planFromModelReply(
  reply: string,
  script: string,
): { ok: true; plan: Plan } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = extractJson(reply);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "پاسخ مدل خوانا نبود." };
  }
  const items = (data as { s?: unknown })?.s;
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "مدل هیچ نمایی برنگرداند." };

  const lines = scriptLines(script);
  const warnings: string[] = [];
  const dropped = new Set<string>();

  // هر خط مدل: [N, bg, speaker, chars, sfx]؛ فقط خط‌های موجود و غیرسرصحنه، به ترتیب و بدون تکرار.
  const rows = new Map<number, unknown[]>();
  for (const it of items) {
    if (!Array.isArray(it)) continue;
    const n = it[0];
    if (!Number.isInteger(n) || n < 1 || n > lines.length || !lines[n - 1]) continue;
    if (isHeader(lines[n - 1]) !== null || rows.has(n)) continue;
    rows.set(n, it);
  }
  const order = [...rows.keys()].sort((a, b) => a - b).slice(0, MAX_SHOTS);
  if (rows.size > MAX_SHOTS) warnings.push(`فقط ${MAX_SHOTS} نمای اول ساخته شد.`);

  // توضیحی که مستقیم قبل از یک دیالوگ آمده، جزء همان نماست نه نمای جدا (حتی اگر مدل جدا داده باشد).
  // فقط خطی «دیالوگ» است که گوینده‌اش یک شخصیت معتبر باشد (مدل گاهی دو اسم یا متن نامعتبر می‌نویسد).
  const isSpoken = (n: number) => pick(rows.get(n)?.[2], IDS.characters) !== undefined;
  const nextLine = (n: number) => {
    for (let i = n; i < lines.length; i++) if (lines[i]) return isHeader(lines[i]) === null ? i + 1 : -1;
    return -1;
  };
  const carry: { chars: string[]; sfx: unknown } = { chars: [], sfx: "" };

  const shots: PlanShot[] = [];
  let prev = 0;
  let lastBg: BgId | undefined;
  const placeVariant = new Map<BgId, number>();
  for (const n of order) {
    const row = rows.get(n)!;
    if (!isSpoken(n)) {
      const next = nextLine(n);
      if (next !== -1 && isSpoken(next)) {
        carry.chars.push(...String(row[3] ?? "").split(","));
        if (row[4]) carry.sfx = row[4];
        continue;
      }
    }
    const [, rawBg, rawSpeaker, ownChars, ownSfx] = row;
    const rawChars = [String(ownChars ?? ""), ...carry.chars].join(",");
    const rawSfx = ownSfx || carry.sfx;
    carry.chars = [];
    carry.sfx = "";

    // صحنه و سرصحنه از خط‌های سرصحنهٔ خود سناریو
    let scene = -1;
    let heading = "";
    for (let i = 0; i < n - 1; i++) {
      const h = lines[i] ? isHeader(lines[i]) : null;
      if (h !== null) {
        scene++;
        heading = h;
      }
    }
    scene = Math.max(0, scene);

    // مکانِ سرصحنه از خود سناریو دقیق‌تر است (مثلاً «خیابان فرشته»)؛ اگر پیدا شد، بر جواب مدل مقدم است.
    let background = sceneTraits(heading).background ?? pick<BgId>(rawBg, IDS.backgrounds);
    if (!background) {
      if (rawBg) dropped.add(`مکان «${String(rawBg)}»`);
      background = lastBg ?? "living";
    }
    lastBg = background;

    const speaker: string | null = pick(rawSpeaker, IDS.characters) ?? null;
    if (rawSpeaker && !speaker) dropped.add(`شخصیت «${String(rawSpeaker)}»`);

    const cast: string[] = speaker ? [speaker] : [];
    const emotion: Record<string, Emotion> = {};
    const action: Record<string, Action> = {};
    for (const part of String(rawChars ?? "").split(",")) {
      const [id, e, a] = part.trim().split(":");
      if (!id) continue;
      if (!pick(id, IDS.characters)) {
        dropped.add(`شخصیت «${id}»`);
        continue;
      }
      if (!cast.includes(id)) cast.push(id);
      // اولین مقدار برنده است: حالتِ خودِ خط دیالوگ بر توضیحِ قبلش مقدم است.
      if (e) {
        if (!pick(e, IDS.emotions)) dropped.add(`حالت «${e}»`);
        else if (!(id in emotion)) emotion[id] = e as Emotion;
      }
      if (a) {
        if (!pick(a, IDS.actions)) dropped.add(`حرکت «${a}»`);
        else if (!(id in action)) action[id] = a as Action;
      }
    }
    let sfx: SfxId = "none";
    if (rawSfx) {
      const s = pick<SfxId>(rawSfx, IDS.sfx);
      if (s) sfx = s;
      else dropped.add(`صدای «${String(rawSfx)}»`);
    }

    // متن‌ها از خود سناریو: توضیح‌های بین نمای قبلی و این خط، و جملهٔ این خط
    const between = lines.slice(prev, n - 1).filter((l) => l && isHeader(l) === null);
    let dialogue = "";
    let actionLine: string;
    if (speaker) {
      const m = DIALOGUE.exec(lines[n - 1]);
      dialogue = splitDirections(m ? m[2] : lines[n - 1]).said;
      actionLine = between.join(" ");
    } else {
      actionLine = [...between, lines[n - 1]].join(" ");
    }
    prev = n;

    // شب/روز و شمارهٔ طرح از خود سرصحنه خوانده می‌شود (بدون توکن اضافه).
    const traits = sceneTraits(heading);
    const variant = traits.variant ?? placeVariant.get(background) ?? 0;
    placeVariant.set(background, variant);
    shots.push({
      scene,
      heading: heading.replace(/^\[\s*|\s*\]$/g, "") || WORLD[background].place,
      background,
      variant,
      night: traits.night,
      actionLine,
      speaker,
      dialogue,
      cast,
      emotion,
      action,
      sfx,
    });
  }

  for (const d of dropped) warnings.push(`${d} در کاتالوگ نبود و کنار گذاشته شد.`);
  if (shots.length === 0) return { ok: false, error: "هیچ نمای معتبری در پاسخ مدل نبود." };
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
