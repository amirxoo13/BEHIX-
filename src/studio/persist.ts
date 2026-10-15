// ذخیره‌سازی امن پروژه: IndexedDB با مهاجرت از localStorage و پشتیبان JSON.
// این ماژول به React/zustand وابسته نیست تا در Node قابل تست باشد.
import { CAST, MAX_CUSTOM, isCustomId } from "./characters.ts";
import { DEFAULT_GENRE, DEFAULT_LOGLINE, DEFAULT_TITLE, KEY } from "./project.ts";
import { MAX_PROPS, PROP_IDS, type PropPlacement } from "./props.ts";
import { MAX_EXTRAS, VARIANTS, type ActorSlot, type Aspect, type CharacterDef, type Shot } from "./types.ts";

export type Persist = {
  shots: Shot[];
  aspect: Aspect;
  showRig: boolean;
  title: string;
  logline: string;
  genre: string;
  /** شخصیت‌های سفارشی (سر از روی عکس). پروژه‌های قدیمی این فیلد را ندارند. */
  characters?: CharacterDef[];
};

export const LEGACY_KEY = KEY;
export const IDB_NAME = "behix";
export const IDB_STORE = "kv";
export const IDB_KEY = "project";
export const BACKUP_FORMAT = "behix-backup";
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

/* ---------- normalize (T04-v3) ---------- */

const DEFAULT_CHAR = { a: CAST[0].id, b: CAST[1]?.id ?? CAST[0].id };
const BG_IDS = [
  "living", "kitchen", "bedroom", "bathroom", "toilet", "parking", "yard", "car",
  "street", "park", "cafe", "coffee", "bazaar", "milad", "azadi", "saadatabad", "fereshteh",
];
/** شناسه‌های پروژه‌های قدیمی که دیگر وجود ندارند. */
const LEGACY_BG: Record<string, { background: string; night: boolean }> = {
  streetDay: { background: "street", night: false },
  streetNight: { background: "street", night: true },
};
const CAMERA_IDS = ["wide", "medium", "closeLeft", "closeRight", "push", "comic"];
const SPEAKERS = ["a", "b", "none"];
const SFX_IDS = ["none", "beep", "slap", "shock", "crickets", "rimshot", "horn", "clink", "door"];
const ASPECTS = ["wide", "square", "story"];

export function isShotLike(v: unknown): v is Shot {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.duration === "number" && Number.isFinite(o.duration) && o.duration > 0;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function oneOf<T extends string>(v: unknown, allowed: string[], fallback: T): T {
  return typeof v === "string" && allowed.includes(v) ? (v as T) : fallback;
}

/* ---------- شخصیت‌های سفارشی ---------- */

const HEX = /^#[0-9a-f]{6}$/i;
const MAX_HEAD_SRC = 1_500_000;

function color(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX.test(v) ? v : fallback;
}

function unit(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null;
}

function point(v: unknown): { x: number; y: number } | null {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  const x = unit(o?.x);
  const y = unit(o?.y);
  return x === null || y === null ? null : { x, y };
}

/** شخصیت سفارشی معتبر، یا null. تصویر فقط data URL تصویر و با اندازهٔ محدود پذیرفته می‌شود. */
export function repairCharacter(v: unknown): CharacterDef | null {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  if (!o || typeof o.id !== "string" || !isCustomId(o.id)) return null;
  const name = typeof o.name === "string" ? o.name.trim().slice(0, 30) : "";
  if (!name) return null;
  const base = CAST[0];
  const def: CharacterDef = {
    id: o.id,
    name,
    skin: color(o.skin, base.skin),
    hair: color(o.hair, "#1a1a1a"),
    hairStyle: "bald",
    brow: "thick",
    facial: "none",
    shirt: color(o.shirt, base.shirt),
    pants: color(o.pants, base.pants),
    shoe: color(o.shoe, base.shoe),
    glasses: false,
    eyeBags: false,
    scale: typeof o.scale === "number" && o.scale >= 0.6 && o.scale <= 1.3 ? o.scale : 1,
    build: o.build === "slim" || o.build === "heavy" ? o.build : "normal",
  };
  const h = o.head && typeof o.head === "object" ? (o.head as Record<string, unknown>) : null;
  if (h && typeof h.src === "string" && /^data:image\/(png|webp|jpeg);base64,/.test(h.src) && h.src.length <= MAX_HEAD_SRC) {
    const mouth = point(h.mouth);
    const aspect = typeof h.aspect === "number" && h.aspect > 0.2 && h.aspect < 5 ? h.aspect : null;
    if (mouth && aspect) {
      const e = h.eyes && typeof h.eyes === "object" ? (h.eyes as Record<string, unknown>) : null;
      const l = point(e?.l);
      const r = point(e?.r);
      def.head = {
        src: h.src,
        aspect,
        mouth,
        size: typeof h.size === "number" && h.size >= 50 && h.size <= 200 ? h.size : 110,
        patch: color(h.patch, def.skin),
        ...(l && r ? { eyes: { l, r } } : {}),
      };
    }
  }
  return def;
}

function repairCharacters(v: unknown): CharacterDef[] {
  if (!Array.isArray(v)) return [];
  const out: CharacterDef[] = [];
  for (const item of v) {
    const c = repairCharacter(item);
    if (c && !out.some((x) => x.id === c.id)) out.push(c);
    if (out.length >= MAX_CUSTOM) break;
  }
  return out;
}

/** شناسه‌های مجاز بازیگر هنگام ترمیم نماها (ثابت‌ها + سفارشی‌های همان پروژه). */
let knownIds: Set<string> = new Set(CAST.map((c) => c.id));

// نما حذف نمی‌شود: بازیگرِ نبود/نامعتبر با شخصیت پیش‌فرضِ موجود در CAST ترمیم می‌شود.
function repairActor(v: unknown, slot: "a" | "b"): ActorSlot {
  const o = v && typeof v === "object" ? (v as Partial<ActorSlot>) : {};
  const known = typeof o.charId === "string" && knownIds.has(o.charId);
  return {
    ...o,
    charId: known ? (o.charId as string) : DEFAULT_CHAR[slot],
    emotion: typeof o.emotion === "string" ? o.emotion : "neutral",
    action: typeof o.action === "string" ? o.action : "idle",
  } as ActorSlot;
}

// حاضرین اضافه: نامعتبرها حذف می‌شوند (نه ترمیم) و تکراری‌ها و بازیگران اصلی کنار می‌روند.
function repairExtras(v: unknown, main: string[]): ActorSlot[] {
  if (!Array.isArray(v)) return [];
  const out: ActorSlot[] = [];
  for (const item of v) {
    const o = item && typeof item === "object" ? (item as Partial<ActorSlot>) : null;
    if (!o || typeof o.charId !== "string" || !knownIds.has(o.charId)) continue;
    if (main.includes(o.charId) || out.some((x) => x.charId === o.charId)) continue;
    out.push(repairActor(o, "a"));
    if (out.length >= MAX_EXTRAS) break;
  }
  return out;
}

function repairProps(v: unknown): PropPlacement[] {
  if (!Array.isArray(v)) return [];
  const out: PropPlacement[] = [];
  for (const item of v) {
    const o = item && typeof item === "object" ? (item as Partial<PropPlacement>) : null;
    if (!o || typeof o.id !== "string" || !(PROP_IDS as string[]).includes(o.id)) continue;
    const x = typeof o.x === "number" && Number.isFinite(o.x) ? Math.min(1, Math.max(0, o.x)) : 0.5;
    out.push({ id: o.id, x, layer: o.layer === "front" ? "front" : "back" });
    if (out.length >= MAX_PROPS) break;
  }
  return out;
}

// PERS-01c: همهٔ فیلدهای متنی/شمارشی با پیش‌فرض پر می‌شوند.
export function normalize(shot: Shot): Shot {
  const pitch = typeof shot.pitch === "number" && Number.isFinite(shot.pitch) ? shot.pitch : 1;
  const legacy = LEGACY_BG[shot.background as string];
  const actorA = repairActor(shot.actorA, "a");
  const actorB = repairActor(shot.actorB, "b");
  const variant = Number.isInteger(shot.variant) && shot.variant >= 0 && shot.variant < VARIANTS ? shot.variant : 0;
  return {
    ...shot,
    variant,
    night: legacy ? legacy.night : shot.night === true,
    heading: str(shot.heading, "") || "داخلی. مکان — روز",
    actionLine: str(shot.actionLine, ""),
    dialogue: str(shot.dialogue, ""),
    background: oneOf(legacy ? legacy.background : shot.background, BG_IDS, "living"),
    camera: oneOf(shot.camera, CAMERA_IDS, "wide"),
    speaker: oneOf(shot.speaker, SPEAKERS, "a"),
    sfx: oneOf(shot.sfx, SFX_IDS, "none"),
    pitch,
    actorA,
    actorB,
    extras: repairExtras(shot.extras, [actorA.charId, actorB.charId]),
    props: repairProps(shot.props),
  };
}

export type ParseResult = { ok: true; data: Persist; dropped: number } | { ok: false; error: string };

/** دادهٔ خام (شیء) را اعتبارسنجی و ترمیم می‌کند. هرگز throw نمی‌کند. */
export function parseProject(raw: unknown): ParseResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "ساختار پروژه نامعتبر است." };
  const d = raw as Record<string, unknown>;
  if (!Array.isArray(d.shots)) return { ok: false, error: "فهرست نماها در فایل نیست." };
  const characters = repairCharacters(d.characters);
  knownIds = new Set([...CAST.map((c) => c.id), ...characters.map((c) => c.id)]);
  let shots: Shot[];
  try {
    shots = d.shots.filter(isShotLike).map((s) => normalize(s));
  } finally {
    knownIds = new Set(CAST.map((c) => c.id));
  }
  if (shots.length === 0) return { ok: false, error: "هیچ نمای معتبری در فایل نیست." };
  return {
    ok: true,
    // T07-v4: تعداد نماهای نامعتبرِ کنارگذاشته‌شده؛ فراخوان باید قبل از بازنویسی از دادهٔ خام پشتیبان بگیرد.
    dropped: d.shots.length - shots.length,
    data: {
      shots,
      aspect: oneOf(d.aspect, ASPECTS, "wide"),
      showRig: d.showRig === true,
      title: str(d.title, "") || DEFAULT_TITLE,
      logline: str(d.logline, "") || DEFAULT_LOGLINE,
      genre: str(d.genre, "") || DEFAULT_GENRE,
      ...(Array.isArray(d.characters) ? { characters } : {}),
    },
  };
}

/* ---------- key-value backends ---------- */

export interface KV {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface LegacyStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

/** IndexedDB ساده (بدون وابستگی). اگر IndexedDB نباشد null برمی‌گرداند. */
export function idbKV(factory: IDBFactory | undefined = globalThis.indexedDB): KV | null {
  if (!factory) return null;
  let dbp: Promise<IDBDatabase> | null = null;
  const db = () => {
    dbp ??= new Promise<IDBDatabase>((resolve, reject) => {
      const open = factory.open(IDB_NAME, 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(IDB_STORE)) open.result.createObjectStore(IDB_STORE);
      };
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
      open.onblocked = () => reject(new Error("IndexedDB blocked"));
    }).catch((e) => {
      dbp = null;
      throw e;
    });
    return dbp;
  };
  return {
    async get(key) {
      const tx = (await db()).transaction(IDB_STORE, "readonly");
      return req(tx.objectStore(IDB_STORE).get(key));
    },
    async set(key, value) {
      const tx = (await db()).transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
      });
    },
  };
}

/** برای تست و حالت بدون IndexedDB. */
export function memoryKV(init: Record<string, unknown> = {}): KV & { data: Record<string, unknown> } {
  const data: Record<string, unknown> = { ...init };
  return {
    data,
    async get(k) {
      return structuredClone(data[k]);
    },
    async set(k, v) {
      data[k] = structuredClone(v);
    },
  };
}

function legacyStorage(): LegacyStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/* ---------- load / migrate / save ---------- */

export const CORRUPT_PREFIX = "corrupt-";
export const LEGACY_CORRUPT_PREFIX = "behix-corrupt-";

export type LoadSource = "idb" | "migrated" | "legacy-fallback" | "none";
export type LoadResult = {
  data: Persist | null;
  source: LoadSource;
  /** پیام فارسی برای نمایش به کاربر (خطا/قرنطینه). */
  notice?: string;
  error?: string;
  /** اگر true، هیچ ذخیره‌ای نباید انجام شود (دادهٔ خراب امن کپی نشد). */
  saveLocked: boolean;
  /** آیا IndexedDB برای ذخیره‌های بعدی قابل اعتماد است. */
  useKV: boolean;
  quarantined: string[];
};

type Slot = { kind: "empty" } | { kind: "unreadable" } | { kind: "valid"; data: Persist; savedAt: number; provisional: boolean; dropped: number; raw: unknown } | { kind: "corrupt"; raw: unknown; error: string };

function savedAtOf(raw: unknown): number {
  const t = raw && typeof raw === "object" ? (raw as { savedAt?: unknown }).savedAt : undefined;
  return typeof t === "number" && Number.isFinite(t) ? t : 0;
}

function classify(raw: unknown): Slot {
  if (raw === undefined || raw === null) return { kind: "empty" };
  const p = parseProject(raw);
  const provisional = !!raw && typeof raw === "object" && (raw as { provisional?: unknown }).provisional === true;
  return p.ok ? { kind: "valid", data: p.data, savedAt: savedAtOf(raw), provisional, dropped: p.dropped, raw } : { kind: "corrupt", raw, error: p.error };
}

function readLegacySlot(ls: LegacyStorage | null): Slot {
  if (!ls) return { kind: "empty" };
  let raw: string | null;
  try {
    raw = ls.getItem(LEGACY_KEY);
  } catch {
    return { kind: "unreadable" };
  }
  if (raw === null || raw === "") return { kind: "empty" };
  try {
    const parsed: unknown = JSON.parse(raw);
    const slot = classify(parsed);
    return slot.kind === "corrupt" ? { ...slot, raw } : slot.kind === "empty" ? { kind: "corrupt", raw, error: "دادهٔ قدیمی خالی است." } : slot.kind === "valid" ? { ...slot, raw } : slot;
  } catch {
    return { kind: "corrupt", raw, error: "دادهٔ قدیمی localStorage خراب است." };
  }
}

async function quarantine(
  kv: KV | null,
  ls: LegacyStorage | null,
  origin: "idb" | "legacy",
  raw: unknown,
  now: number,
): Promise<string | null> {
  const key = `${CORRUPT_PREFIX}${now}-${origin}`;
  if (kv) {
    try {
      await kv.set(key, raw);
      const back = await kv.get(key);
      if (back !== undefined) return `idb:${key}`;
    } catch {
      /* try localStorage */
    }
  }
  if (ls) {
    try {
      const lkey = `${LEGACY_CORRUPT_PREFIX}${now}-${origin}`;
      ls.setItem(lkey, typeof raw === "string" ? raw : JSON.stringify(raw));
      if (ls.getItem(lkey) !== null) return `localStorage:${lkey}`;
    } catch {
      /* failed */
    }
  }
  return null;
}

function samePersist(a: Persist, b: Persist): boolean {
  return (
    a.aspect === b.aspect &&
    a.showRig === b.showRig &&
    a.title === b.title &&
    a.logline === b.logline &&
    a.genre === b.genre &&
    JSON.stringify(a.shots) === JSON.stringify(b.shots) &&
    JSON.stringify(a.characters ?? []) === JSON.stringify(b.characters ?? [])
  );
}

/**
 * - هر دو منبع خوانده می‌شوند؛ از بین نسخه‌های معتبر، جدیدتر (savedAt) انتخاب می‌شود (F2).
 * - دادهٔ خراب قبل از باز شدن قفل ذخیره در کلید جداگانه کپی می‌شود؛ اگر نشد saveLocked=true (F1).
 * - localStorage فقط پس از نوشتن+بازخوانی موفق IndexedDB پاک می‌شود.
 */
export async function loadProject(
  kv: KV | null,
  ls: LegacyStorage | null = legacyStorage(),
  now: number = Date.now(),
): Promise<LoadResult> {
  let idb: Slot = { kind: "empty" };
  let useKV = !!kv;
  let idbUnreadable = false;
  if (kv) {
    try {
      idb = classify(await kv.get(IDB_KEY));
    } catch {
      idb = { kind: "unreadable" };
      useKV = false; // نخواندیم؛ پس رویش هم نمی‌نویسیم
      // F6: ممکن است پروژهٔ واقعی در IDB باشد؛ هیچ ذخیره‌ای (حتی در localStorage) مجاز نیست
      // تا ذخیرهٔ این نشست در نشست بعد روی پروژهٔ واقعی منتقل نشود.
      idbUnreadable = true;
    }
  }
  const legacy = readLegacySlot(ls);

  const quarantined: string[] = [];
  let saveLocked = idbUnreadable;
  const errors: string[] = [];
  for (const [origin, slot] of [["idb", idb], ["legacy", legacy]] as const) {
    if (slot.kind !== "corrupt") continue;
    errors.push(slot.error);
    const where = await quarantine(useKV ? kv : null, ls, origin, slot.raw, now);
    if (where) quarantined.push(where);
    else saveLocked = true;
  }
  // T07-v4: نماهای نامعتبر در کنار نماهای معتبر — قبل از هر بازنویسی/حذف کلید legacy، کپی خام گرفته می‌شود.
  let droppedTotal = 0;
  for (const [origin, slot] of [["idb", idb], ["legacy", legacy]] as const) {
    if (slot.kind !== "valid" || slot.dropped === 0) continue;
    droppedTotal += slot.dropped;
    const where = await quarantine(useKV ? kv : null, ls, origin, slot.raw, now);
    if (where) quarantined.push(where);
    else saveLocked = true; // پشتیبان نشد: نه بازنویسی IDB، نه حذف کلید legacy
  }

  let chosen: { data: Persist; from: "idb" | "legacy" } | null = null;
  if (idb.kind === "valid" && legacy.kind === "valid") {
    // F6: ذخیرهٔ «موقت» (بدون IDB در آن نشست) هرگز روی IDB معتبر برنده نمی‌شود.
    chosen = !legacy.provisional && legacy.savedAt > idb.savedAt ? { data: legacy.data, from: "legacy" } : { data: idb.data, from: "idb" };
  } else if (idb.kind === "valid") chosen = { data: idb.data, from: "idb" };
  else if (legacy.kind === "valid") chosen = { data: legacy.data, from: "legacy" };

  let source: LoadSource = "none";
  if (chosen?.from === "idb") {
    source = "idb";
    if (!saveLocked && useKV && kv) {
      try {
        await kv.set(IDB_KEY, { ...chosen.data, savedAt: idb.kind === "valid" ? idb.savedAt : now }); // نسخهٔ ترمیم‌شده
      } catch {
        /* بعداً */
      }
    }
  } else if (chosen?.from === "legacy") {
    source = "legacy-fallback";
    if (!saveLocked && useKV && kv) {
      try {
        const stamp = legacy.kind === "valid" && legacy.savedAt ? legacy.savedAt : now;
        await kv.set(IDB_KEY, { ...chosen.data, savedAt: stamp });
        const check = classify(await kv.get(IDB_KEY));
        if (check.kind === "valid" && samePersist(check.data, chosen.data)) {
          try {
            ls?.removeItem(LEGACY_KEY);
          } catch {
            /* بی‌خطر */
          }
          source = "migrated";
        }
      } catch {
        /* localStorage دست‌نخورده */
      }
    }
  }

  let notice: string | undefined;
  const newerProvisional =
    idb.kind === "valid" && legacy.kind === "valid" && legacy.provisional && legacy.savedAt > idb.savedAt;
  if (droppedTotal > 0 && !saveLocked) {
    notice = `${droppedTotal} نما خراب بود و کنار گذاشته شد؛ یک نسخه از دادهٔ اصلی جداگانه نگه داشته شد و پاک نشده است.`;
  } else if (quarantined.length) {
    notice = "بخشی از دادهٔ ذخیره‌شده خراب بود. یک نسخه از آن جداگانه نگه داشته شد و پاک نشده است.";
  }
  if (idbUnreadable) {
    notice =
      "حافظهٔ اصلی پروژه (IndexedDB) خوانده نشد؛ برای جلوگیری از بازنویسی پروژهٔ شما، ذخیرهٔ خودکار در این نشست متوقف شد. صفحه را دوباره باز کنید.";
  } else if (saveLocked) {
    notice = "دادهٔ ذخیره‌شده خراب است و نسخهٔ امن از آن ساخته نشد؛ برای جلوگیری از پاک شدن، ذخیرهٔ خودکار متوقف شد. لطفاً از پروژه پشتیبان بگیرید.";
  } else if (source === "legacy-fallback" && useKV) {
    notice ??= "انتقال پروژه به حافظهٔ جدید انجام نشد؛ دادهٔ قبلی سر جایش ماند.";
  }
  if (newerProvisional && !idbUnreadable && !saveLocked) {
    const extra = "نسخهٔ موقت جدیدتری در حافظهٔ قدیمی ماند و جایگزین پروژهٔ اصلی نشد.";
    notice = notice ? `${notice} ${extra}` : extra;
  }
  return {
    data: chosen?.data ?? null,
    source,
    notice,
    error: errors.length ? errors.join(" ") : undefined,
    saveLocked,
    useKV,
    quarantined,
  };
}

/** ذخیره در IndexedDB با savedAt؛ در صورت شکست (یا نبود IDB) به localStorage برمی‌گردد. */
export async function saveProject(
  kv: KV | null,
  data: Persist,
  ls: LegacyStorage | null = legacyStorage(),
  now: number = Date.now(),
): Promise<"idb" | "legacy" | "failed"> {
  // اگر IDB در این نشست در دسترس نبود، رکورد localStorage «موقت» علامت می‌خورد (F6).
  const record = kv ? { ...data, savedAt: now } : { ...data, savedAt: now, provisional: true };
  if (kv) {
    try {
      await kv.set(IDB_KEY, record);
      return "idb";
    } catch {
      /* fallback */
    }
  }
  try {
    ls?.setItem(LEGACY_KEY, JSON.stringify(record));
    return ls ? "legacy" : "failed";
  } catch {
    return "failed";
  }
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/* ---------- backup ---------- */

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  project: Persist;
};

export function exportBackup(data: Persist, now: Date = new Date()): string {
  const file: BackupFile = { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), project: data };
  return JSON.stringify(file, null, 2);
}

/** متن فایل پشتیبان را اعتبارسنجی می‌کند. هرگز throw نمی‌کند. */
export function importBackup(text: unknown): ParseResult {
  if (typeof text !== "string" || text.trim() === "") return { ok: false, error: "فایل خالی است." };
  // هر واحد UTF-16 حداقل ۱ بایت است؛ پس اول بررسی ارزان، بعد اندازهٔ واقعی UTF-8.
  if (text.length > MAX_BACKUP_BYTES || byteLength(text) > MAX_BACKUP_BYTES) return { ok: false, error: "فایل پشتیبان بیش از حد بزرگ است." };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "فایل JSON معتبر نیست." };
  }
  if (!raw || typeof raw !== "object") return { ok: false, error: "ساختار فایل نامعتبر است." };
  const f = raw as Record<string, unknown>;
  if (f.format !== BACKUP_FORMAT) return { ok: false, error: "این فایل پشتیبان BEHIX نیست." };
  if (typeof f.version !== "number" || f.version > BACKUP_VERSION) {
    return { ok: false, error: "نسخهٔ فایل پشتیبان پشتیبانی نمی‌شود." };
  }
  return parseProject(f.project);
}
