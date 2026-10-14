import { create } from "zustand";
import { playSfx, playUrl, stopAll } from "./audio.ts";
import { exportBackup, idbKV, importBackup, loadProject, saveProject, type Persist } from "./persist.ts";
import { DEFAULT_GENRE, DEFAULT_LOGLINE, DEFAULT_SHOTS, DEFAULT_TITLE, newId } from "./project.ts";
import type { ActorSlot, Aspect, Emotion, Shot } from "./types.ts";


let onDone: (() => void) | null = null;
let booted = false;
let armed = -1;

export function setPlayDone(fn: (() => void) | null) {
  onDone = fn;
}

export function resetArmed() {
  armed = -1;
}

export function consumeShotAudio(index: number) {
  if (index === armed) return;
  stopAll();
  armed = index;
  const s = useStudio.getState();
  const shot = s.shots[index];
  if (!shot) return;
  s.selectDuringPlay(index);
  if (shot.sfx !== "none") playSfx(shot.sfx);
  const url = s.audioUrls[shot.id];
  if (url && shot.speaker !== "none") void playUrl(url, shot.pitch);
}

export function finishPlayback() {
  const s = useStudio.getState();
  if (!s.playing) return;
  stopAll();
  armed = -1;
  useStudio.setState({ playing: false });
  const done = onDone;
  onDone = null;
  done?.();
}

type Meta = { title: string; logline: string; genre: string };

type Studio = {
  shots: Shot[];
  selected: number;
  aspect: Aspect;
  showRig: boolean;
  title: string;
  logline: string;
  genre: string;
  playing: boolean;
  exporting: boolean;
  playT0: number;
  audioUrls: Record<string, string>;
  pulses: { a: number; b: number };
  status: string;
  recording: boolean;
  boot: () => Promise<void>;
  /** پیام فارسی وضعیت ذخیره‌سازی (دادهٔ خراب/قفل)؛ UI توسط T02 نمایش داده می‌شود. */
  storageNotice: string;
  /** true یعنی ذخیرهٔ خودکار برای حفاظت از دادهٔ خراب متوقف است. */
  storageLocked: boolean;
  /** true تا پایان boot؛ در این فاصله setterهای پروژه نادیده گرفته می‌شوند. */
  booting: boolean;
  /** متن JSON پشتیبان پروژهٔ فعلی (UI بعداً دانلودش می‌کند). */
  exportBackup: () => string;
  /** بازیابی از متن JSON؛ در خطا پروژه دست نمی‌خورد. */
  importBackup: (text: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  select: (i: number) => void;
  selectDuringPlay: (i: number) => void;
  patchShot: (partial: Partial<Shot>) => void;
  patchActor: (slot: "a" | "b", partial: Partial<ActorSlot>) => void;
  setMeta: (partial: Partial<Meta>) => void;
  addShot: () => void;
  removeShot: (i: number) => void;
  /** تغییر طرح یا شب/روز برای همهٔ نماهایی که در این مکان‌اند. */
  patchPlace: (background: Shot["background"], partial: Partial<Pick<Shot, "variant" | "night">>) => void;
  /** همهٔ نماها را با نماهای تازه (مثلاً از چیدن خودکار سناریو) جایگزین می‌کند. */
  replaceShots: (shots: Shot[]) => boolean;
  moveShot: (i: number, dir: -1 | 1) => void;
  setAspect: (a: Aspect) => void;
  setShowRig: (v: boolean) => void;
  setAudio: (id: string, url: string | null) => void;
  trigger: (slot: "a" | "b", emotion: Emotion) => void;
  setStatus: (s: string) => void;
  setRecording: (v: boolean) => void;
  setPlaying: (playing: boolean, t0?: number) => void;
  setExporting: (v: boolean) => void;
};

function revoke(url: string | undefined) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

const kv = idbKV(typeof indexedDB === "undefined" ? undefined : indexedDB);
let ready = false;
let booting = true;
let activeKV: typeof kv = kv;
let saveChain: Promise<unknown> = Promise.resolve();

// نوشتن‌ها به ترتیب صف می‌شوند؛ تا پایان بارگذاری چیزی نوشته نمی‌شود تا دادهٔ قدیمی بازنویسی نشود.
function saveOf(state: Persist) {
  if (!ready) return;
  const snapshot = structuredClone(state);
  saveChain = saveChain
    .then(async () => {
      if (!ready) return;
      const where = await saveProject(activeKV, snapshot);
      if (where === "failed") {
        ready = false;
        useStudio.setState({
          storageLocked: true,
          storageNotice: "ذخیرهٔ خودکار ناموفق بود؛ ذخیرهٔ بعدی متوقف شد.",
        });
      }
    })
    .catch(() => undefined);
}

function persistFrom(s: {
  shots: Shot[];
  aspect: Aspect;
  showRig: boolean;
  title: string;
  logline: string;
  genre: string;
}): Persist {
  return {
    shots: s.shots,
    aspect: s.aspect,
    showRig: s.showRig,
    title: s.title,
    logline: s.logline,
    genre: s.genre,
  };
}

export const useStudio = create<Studio>((set, get) => ({
  shots: DEFAULT_SHOTS,
  selected: 0,
  aspect: "wide",
  showRig: false,
  title: DEFAULT_TITLE,
  logline: DEFAULT_LOGLINE,
  genre: DEFAULT_GENRE,
  playing: false,
  exporting: false,
  playT0: 0,
  audioUrls: {},
  pulses: { a: 0, b: 0 },
  status: "",
  recording: false,
  storageNotice: "",
  storageLocked: false,
  booting: true,
  boot: async () => {
    // Shell در هر route دوباره mount می‌شود؛ بارگذاری فقط یک‌بار (BUG-01).
    if (booted) return;
    booted = true;
    let locked = true;
    try {
      const res = await loadProject(kv);
      activeKV = res.useKV ? kv : null;
      locked = res.saveLocked;
      set({ storageNotice: res.notice ?? "", storageLocked: res.saveLocked });
      if (res.data) set({ ...res.data, selected: 0 });
    } catch {
      set({ storageNotice: "بارگذاری پروژه ناموفق بود؛ ذخیرهٔ خودکار متوقف شد.", storageLocked: true });
    } finally {
      // F1: فقط وقتی دادهٔ خراب امن کپی شده باشد ذخیره باز می‌شود.
      booting = false;
      ready = !locked;
      set({ booting: false });
    }
  },
  exportBackup: () => exportBackup(persistFrom(get())),
  importBackup: async (text) => {
    const res = importBackup(text);
    if (!res.ok) return res;
    if (get().storageLocked) {
      return { ok: false, error: "ذخیره‌سازی به دلیل دادهٔ خراب قفل است؛ پروژه جایگزین نشد." };
    }
    if (get().playing) finishPlayback();
    for (const url of Object.values(get().audioUrls)) revoke(url);
    set({ ...res.data, selected: 0, audioUrls: {} });
    const snapshot = structuredClone(res.data);
    const pending = saveChain.then(() => saveProject(activeKV, snapshot));
    saveChain = pending.catch(() => undefined);
    const where = await pending.catch(() => "failed" as const);
    if (where === "failed") {
      ready = false;
      set({ storageLocked: true, storageNotice: "پروژه بارگذاری شد اما ذخیره نشد." });
      return { ok: false, error: "پروژه بارگذاری شد اما ذخیره نشد." };
    }
    return { ok: true };
  },
  select: (i) => set({ selected: i }),
  selectDuringPlay: (i) => set({ selected: i }),
  patchShot: (partial) => {
    if (booting) return;
    const s = get();
    const next = s.shots.map((shot, i) => (i === s.selected ? { ...shot, ...partial } : shot));
    set({ shots: next });
    saveOf(persistFrom({ ...s, shots: next }));
  },
  patchActor: (slot, partial) => {
    if (booting) return;
    const s = get();
    const next = s.shots.map((shot, i) => {
      if (i !== s.selected) return shot;
      return slot === "a"
        ? { ...shot, actorA: { ...shot.actorA, ...partial } }
        : { ...shot, actorB: { ...shot.actorB, ...partial } };
    });
    set({ shots: next });
    saveOf(persistFrom({ ...s, shots: next }));
  },
  setMeta: (partial) => {
    if (booting) return;
    const s = get();
    const next = {
      title: partial.title ?? s.title,
      logline: partial.logline ?? s.logline,
      genre: partial.genre ?? s.genre,
    };
    set(next);
    saveOf(persistFrom({ ...s, ...next }));
  },
  addShot: () => {
    if (booting) return;
    const s = get();
    const last = s.shots[s.shots.length - 1];
    const shot: Shot = {
      ...last,
      id: newId(),
      heading: "داخلی. مکان تازه — روز",
      actionLine: "شرح تصویر این نما را بنویسید.",
      dialogue: "",
      sfx: "none",
      speaker: last.speaker === "a" ? "b" : "a",
      actorA: { ...last.actorA, emotion: "neutral", action: "idle" },
      actorB: { ...last.actorB, emotion: "neutral", action: "idle" },
    };
    const next = [...s.shots, shot];
    set({ shots: next, selected: next.length - 1 });
    saveOf(persistFrom({ ...s, shots: next }));
  },
  removeShot: (i) => {
    if (booting) return;
    const s = get();
    if (s.shots.length < 2) return;
    const next = s.shots.filter((_, idx) => idx !== i);
    const urls = { ...s.audioUrls };
    revoke(urls[s.shots[i].id]);
    delete urls[s.shots[i].id];
    const selected = Math.max(0, Math.min(s.selected, next.length - 1));
    set({ shots: next, selected, audioUrls: urls });
    saveOf(persistFrom({ ...s, shots: next }));
  },
  patchPlace: (background, partial) => {
    if (booting) return;
    const s = get();
    const next = s.shots.map((shot) => (shot.background === background ? { ...shot, ...partial } : shot));
    set({ shots: next });
    saveOf(persistFrom({ ...s, shots: next }));
  },
  replaceShots: (shots) => {
    if (booting || shots.length === 0) return false;
    const s = get();
    if (s.playing) finishPlayback();
    for (const url of Object.values(s.audioUrls)) revoke(url);
    set({ shots, selected: 0, audioUrls: {} });
    saveOf(persistFrom({ ...s, shots }));
    return true;
  },
  moveShot: (i, dir) => {
    if (booting) return;
    const s = get();
    const j = i + dir;
    if (j < 0 || j >= s.shots.length) return;
    const next = s.shots.slice();
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    let selected = s.selected;
    if (selected === i) selected = j;
    else if (selected === j) selected = i;
    set({ shots: next, selected });
    saveOf(persistFrom({ ...s, shots: next }));
  },
  setAspect: (aspect) => {
    if (booting) return;
    const s = get();
    set({ aspect });
    saveOf(persistFrom({ ...s, aspect }));
  },
  setShowRig: (showRig) => {
    if (booting) return;
    const s = get();
    set({ showRig });
    saveOf(persistFrom({ ...s, showRig }));
  },
  setAudio: (id, url) => {
    const audioUrls = { ...get().audioUrls };
    // فقط هنگام جایگزینی revoke می‌شود؛ در حذف (url=null) فراخواننده (sound.tsx:84-85) خودش revoke می‌کند تا دوبار revoke نشود.
    if (url && audioUrls[id] !== url) revoke(audioUrls[id]);
    if (url) audioUrls[id] = url;
    else delete audioUrls[id];
    set({ audioUrls });
  },
  trigger: (slot, emotion) => {
    get().patchActor(slot, { emotion });
    set({ pulses: { ...get().pulses, [slot]: performance.now() } });
  },
  setStatus: (status) => set({ status }),
  setRecording: (recording) => set({ recording }),
  setPlaying: (playing, t0) => set({ playing, playT0: t0 ?? get().playT0 }),
  setExporting: (exporting) => set({ exporting }),
}));
