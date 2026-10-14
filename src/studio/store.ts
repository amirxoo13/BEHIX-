import { create } from "zustand";
import { playSfx, playUrl, stopAll } from "./audio";
import { CAST } from "./characters";
import { DEFAULT_GENRE, DEFAULT_LOGLINE, DEFAULT_SHOTS, DEFAULT_TITLE, KEY, newId } from "./project";
import type { ActorSlot, Aspect, Emotion, Shot } from "./types";

type Persist = {
  shots: Shot[];
  aspect: Aspect;
  showRig: boolean;
  title: string;
  logline: string;
  genre: string;
};

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
  boot: () => void;
  select: (i: number) => void;
  selectDuringPlay: (i: number) => void;
  patchShot: (partial: Partial<Shot>) => void;
  patchActor: (slot: "a" | "b", partial: Partial<ActorSlot>) => void;
  setMeta: (partial: Partial<Meta>) => void;
  addShot: () => void;
  removeShot: (i: number) => void;
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

const DEFAULT_CHAR = { a: CAST[0].id, b: CAST[1]?.id ?? CAST[0].id };

function isShotLike(v: unknown): v is Shot {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.id === "string" && typeof o.duration === "number" && Number.isFinite(o.duration) && o.duration > 0;
}

// نما حذف نمی‌شود: بازیگرِ نبود/نامعتبر با شخصیت پیش‌فرضِ موجود در CAST ترمیم می‌شود و بقیهٔ داده‌ها حفظ می‌شوند.
function repairActor(v: unknown, slot: "a" | "b"): ActorSlot {
  const o = v && typeof v === "object" ? (v as Partial<ActorSlot>) : {};
  const known = typeof o.charId === "string" && CAST.some((c) => c.id === o.charId);
  return {
    ...o,
    charId: known ? (o.charId as string) : DEFAULT_CHAR[slot],
    emotion: typeof o.emotion === "string" ? o.emotion : "neutral",
    action: typeof o.action === "string" ? o.action : "idle",
  } as ActorSlot;
}

function revoke(url: string | undefined) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}

const BG_IDS = ["living", "kitchen", "yard", "cafe", "streetDay", "streetNight", "park", "car"];
const CAMERA_IDS = ["wide", "medium", "closeLeft", "closeRight", "push", "comic"];
const SPEAKERS = ["a", "b", "none"];
const SFX_IDS = ["none", "beep", "slap", "shock", "crickets", "rimshot", "horn", "clink", "door"];

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function oneOf<T extends string>(v: unknown, allowed: string[], fallback: T): T {
  return typeof v === "string" && allowed.includes(v) ? (v as T) : fallback;
}

// PERS-01c: همهٔ فیلدهای متنی/شمارشی نمای ذخیره‌شده با پیش‌فرض پر می‌شوند تا UI (مثلاً dialogue.trim) کرش نکند.
function normalize(shot: Shot): Shot {
  const pitch = typeof shot.pitch === "number" && Number.isFinite(shot.pitch) ? shot.pitch : 1;
  return {
    ...shot,
    heading: str(shot.heading, "") || "داخلی. مکان — روز",
    actionLine: str(shot.actionLine, ""),
    dialogue: str(shot.dialogue, ""),
    background: oneOf(shot.background, BG_IDS, "living"),
    camera: oneOf(shot.camera, CAMERA_IDS, "wide"),
    speaker: oneOf(shot.speaker, SPEAKERS, "a"),
    sfx: oneOf(shot.sfx, SFX_IDS, "none"),
    pitch,
    actorA: repairActor(shot.actorA, "a"),
    actorB: repairActor(shot.actorB, "b"),
  };
}

function saveOf(state: Persist) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota */
  }
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
  boot: () => {
    // Shell در هر route دوباره mount می‌شود؛ بارگذاری فقط یک‌بار تا انتخاب نما ریست نشود (BUG-01).
    if (booted) return;
    booted = true;
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<Persist>;
      if (!Array.isArray(data.shots)) return;
      const shots = data.shots.filter(isShotLike);
      if (shots.length === 0) return;
      set({
        shots: shots.map((shot) => normalize(shot)),
        aspect: data.aspect ?? "wide",
        showRig: !!data.showRig,
        title: data.title || DEFAULT_TITLE,
        logline: data.logline || DEFAULT_LOGLINE,
        genre: data.genre || DEFAULT_GENRE,
        selected: 0,
      });
    } catch {
      /* ignore broken save */
    }
  },
  select: (i) => set({ selected: i }),
  selectDuringPlay: (i) => set({ selected: i }),
  patchShot: (partial) => {
    const s = get();
    const next = s.shots.map((shot, i) => (i === s.selected ? { ...shot, ...partial } : shot));
    set({ shots: next });
    saveOf(persistFrom({ ...s, shots: next }));
  },
  patchActor: (slot, partial) => {
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
  moveShot: (i, dir) => {
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
    const s = get();
    set({ aspect });
    saveOf(persistFrom({ ...s, aspect }));
  },
  setShowRig: (showRig) => {
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
