/**
 * نوع شخصیت در داستان: آدمک خطی (پیش‌فرض)، چهرهٔ عکس، یا شخصیت ریگ‌شده.
 * فیلدِ نبود = آدمک؛ پروژه‌ها و فایل‌های قدیمی بدون تغییر بار می‌شوند.
 */
import { z } from "zod";
import { VIEW_IDS, type ViewId } from "./rig-format.ts";

export type CharacterRef =
  | { kind: "stick" }
  | { kind: "photo"; charId: string }
  /** rigKey = کلید فایل ریگ/عروسک در Cloud Storage (cast/<owner>/<id>/<version>.json). */
  | { kind: "rig"; rigKey: string; view?: ViewId };

export type CharacterKind = CharacterRef["kind"];

export const characterRefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stick") }).strict(),
  z.object({ kind: z.literal("photo"), charId: z.string().min(1).max(200) }).strict(),
  z.object({ kind: z.literal("rig"), rigKey: z.string().min(1).max(220), view: z.enum(VIEW_IDS as [ViewId, ...ViewId[]]).optional() }).strict(),
]);

export const characterKind = (ref: CharacterRef | undefined): CharacterKind => ref?.kind ?? "stick";
