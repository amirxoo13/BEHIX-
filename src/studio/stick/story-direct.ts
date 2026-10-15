import { speechPulses } from "./speech.ts";
/**
 * کارگردان خودکار: از داستانِ فهمیده‌شده (story-parse) خط زمانِ فیلم می‌سازد.
 * - جای هر نفر (چپ/راست، نشیمن مبل و صندلی)، ورود و خروج با راه رفتن
 * - مدت هر دیالوگ به اندازهٔ خواندن طبیعی آن (برای صداگذاری انسانی بعدی)
 * - حرکت دست موقت (دست تکان دادن) بعد از چند لحظه برمی‌گردد؛ حالت‌های شدید چهره کم‌کم آرام می‌شوند
 * - دوربین: نمای باز، نزدیک شدن آرام به گوینده، و زوم ناگهانی روی شوک و فریاد
 * - برگهٔ زمان‌بندی دیالوگ‌ها (SRT) برای صداپیشه
 */
import { hash, type ActorKey, type ActorTrack, type TalkSpan } from "./animate.ts";
import type { Expression } from "./face.ts";
import type { Hold } from "./figure.ts";
import { PLACES } from "./places.ts";
import type { PoseId } from "./poses.ts";
import { FRAME, type CameraKey, type Caption, type SceneActor, type SceneTimeline, type Thought, type Timeline } from "./story-render.ts";
import { isMomentary, type Act, type Beat, type Gesture, type StoryPlan, type StoryScene } from "./story-parse.ts";

/** سرعت خواندن دیالوگ فارسی برای دوبله (کلمه در ثانیه). */
export const WORDS_PER_SEC = 2.4;
const OFF_LEFT = -0.16;
const OFF_RIGHT = 1.16;
const MAX_ON_STAGE = 5;

export type Cue = { beatId?:string; from: number; to: number; speaker: string; text: string; mood?: Expression; scene: number };

export type BeatTiming = { id:string; scene:number; from:number; to:number; text:string; kind:Beat["kind"]; speaker?:string };
export type Directed = { timeline: Timeline; cues: Cue[]; warnings: string[]; beats:BeatTiming[] };

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

export function lineDuration(text: string): number {
  return Math.min(9, Math.max(1.4, 0.45 + wordCount(text) / WORDS_PER_SEC));
}

const walkTime = (dx: number) => Math.max(0.7, Math.abs(dx) * 2.6);

/** حالت‌های شدید چهره بعد از یک لحظه به حالت ملایم‌تر برمی‌گردند. */
const CALM: Partial<Record<Expression, Expression>> = {
  laugh: "smile",
  grin: "smile",
  shocked: "surprised",
  surprised: "neutral",
  furious: "angry",
  cry: "sad",
  scared: "worried",
  kiss: "smile",
};
const PUNCH: ReadonlySet<Expression> = new Set(["shocked", "surprised", "furious", "scared"]);

type ActorState = {
  id: string;
  present: boolean;
  x: number;
  /** جایی که بعد از ورود می‌ایستد. */
  home: number;
  sit: boolean;
  face: Expression;
  hold: Hold;
  gesture: Gesture | null;
  keys: ActorKey[];
  talk: TalkSpan[];
};

/** جای ایستادن n نفر کنار هم. */
export function spread(n: number): number[] {
  if (n <= 1) return [0.5];
  if (n === 2) return [0.3, 0.7];
  if (n === 3) return [0.22, 0.5, 0.78];
  if (n === 4) return [0.17, 0.39, 0.61, 0.83];
  return Array.from({ length: n }, (_, i) => 0.12 + (0.76 * i) / (n - 1));
}

function poseFor(sit: boolean, gesture: Gesture | null, hold: Hold, face: Expression, toRight: boolean): PoseId {
  if (sit) {
    switch (gesture) {
      case "think":
        return "sitThink";
      case "phoneEar":
        return "sitPhone";
      case "cross":
        return "sitCross";
      case "handsFace":
      case "facepalm":
        return "sitHandsFace";
      case "drive":
        return "sitDrive";
      case "eat":
        return "sitEat";
      case "write":
        return "sitWrite";
      case "explain":
      case "shrug":
        return "sitExplain";
      case "wave":
      case "cheer":
        return "sitWave";
      case "point":
      case "reach":
        return toRight ? "sitReachR" : "sitReachL";
      default:
        break;
    }
    if (hold === "phone") return "sitPhone";
    if (hold !== "none") return "sitCupR";
    if (face === "content" || face === "sleepy") return "sitLeanBack";
    return "sit";
  }
  switch (gesture) {
    case "cross":
      return "standCross";
    case "hips":
      return "standHips";
    case "point":
      return toRight ? "standPointR" : "standPointL";
    case "reach":
      return toRight ? "standReachR" : "standReachL";
    case "wave":
      return "standWave";
    case "explain":
      return "standExplain";
    case "facepalm":
      return "standFacepalm";
    case "handsFace":
      return "standHandsFace";
    case "phoneEar":
      return "standPhoneEar";
    case "handChest":
      return "standHandChest";
    case "think":
      return "standThink";
    case "shrug":
      return "standShrug";
    case "cheer":
      return "standCheer";
    case "jump":
      return "standJump";
    case "kick":
      return "standKick";
    case "bow":
      return "standBow";
    default:
      break;
  }
  if (hold === "cup" || hold === "book" || hold === "flowers" || hold === "phone") return "standHoldFront";
  return "stand";
}

/** کسانی که در صحنه حضور دارند، به ترتیب اولین ذکر. */
function participants(scene: StoryScene): string[] {
  const out: string[] = [];
  const add = (id?: string) => {
    if (id && !out.includes(id)) out.push(id);
  };
  for (const b of scene.beats) {
    if (b.kind === "line") add(b.speaker);
    if (b.kind !== "narration") for (const a of b.acts) add(a.who);
  }
  return out;
}

function firstAct(scene: StoryScene, id: string, pick: (a: Act) => boolean): { act: Act; index: number } | null {
  let index = 0;
  for (const b of scene.beats) {
    if (b.kind !== "narration") {
      for (const a of b.acts) {
        if (a.who === id && pick(a)) return { act: a, index };
      }
      if (b.kind === "line" && b.speaker === id && pick({ who: id })) return { act: { who: id }, index };
    }
    index++;
  }
  return null;
}

export function directStory(plan: StoryPlan): Directed {
  const warnings = [...plan.warnings];
  const scenes: SceneTimeline[] = [];
  const cues: Cue[] = [];
  const beats: BeatTiming[] = [];
  let clock = 0;
  const seedOf = (id: string) => (plan.cast.findIndex((c) => c.id === id) + 1) * 1.37;
  const nameOf = (id: string) => plan.cast.find((c) => c.id === id)?.name ?? id;

  plan.scenes.forEach((scene, sceneIndex) => {
    const place = PLACES[scene.place];
    const forceSit = !!place.forceSit;
    const ids = participants(scene);
    if (ids.length > MAX_ON_STAGE) warnings.push(`صحنهٔ ${sceneIndex + 1}: بیشتر از ${MAX_ON_STAGE} نفر جا نمی‌شوند؛ ${ids.length - MAX_ON_STAGE} نفر آخر حذف شدند.`);
    const cast = ids.slice(0, MAX_ON_STAGE);

    // ترتیب از چپ به راست: «سمت چپ»، بی‌سمت/وسط، «سمت راست»
    const rank = (id: string) => {
      const side = plan.cast.find((c) => c.id === id)?.side;
      if (forceSit && firstAct(scene, id, (a) => a.gesture === "drive")) return 3; // راننده سمت راست قاب
      return side === "left" ? 0 : side === "right" ? 2 : 1;
    };
    const ordered = [...cast].sort((a, b) => rank(a) - rank(b) || cast.indexOf(a) - cast.indexOf(b));
    const slots = spread(ordered.length);
    const seats = place.seats;
    const seatTaken = new Map<number, string>();
    const nearestSeat = (x: number, who: string): number | null => {
      let best: number | null = null;
      for (const s of seats) {
        const owner = seatTaken.get(s);
        if (owner && owner !== who) continue;
        if (best === null || Math.abs(s - x) < Math.abs(best - x)) best = s;
      }
      return best;
    };
    const takeSeat = (who: string, seat: number | null) => {
      for (const [s, o] of seatTaken) if (o === who) seatTaken.delete(s);
      if (seat !== null) seatTaken.set(seat, who);
    };
    let warnedNoSeat = false;
    const canSit = () => {
      if (seats.length > 0) return true;
      if (!warnedNoSeat) {
        warnings.push(`صحنهٔ ${sceneIndex + 1} (${place.label}): جای نشستن ندارد؛ شخصیت‌ها ایستاده می‌مانند.`);
        warnedNoSeat = true;
      }
      return false;
    };

    // حالت اول هر نفر
    const states = new Map<string, ActorState>();
    ordered.forEach((id, i) => {
      const enter = firstAct(scene, id, (a) => !!a.move || a.sit !== undefined);
      const entersLater = enter?.act.move === "enter";
      const sitFirst = firstAct(scene, id, (a) => a.sit !== undefined || !!a.move);
      let sit = forceSit || (!entersLater && sitFirst?.act.sit === true && !sitFirst.act.move);
      if (sit && !forceSit && !canSit()) sit = false;
      let x = slots[i];
      if (sit) {
        const seat = nearestSeat(x, id);
        if (seat !== null) {
          x = seat;
          takeSeat(id, seat);
        }
      }
      const st: ActorState = {
        id,
        present: !entersLater,
        x: entersLater ? (x < 0.5 ? OFF_LEFT : OFF_RIGHT) : x,
        home: x,
        sit,
        face: "neutral",
        hold: "none",
        gesture: forceSit && firstAct(scene, id, (a) => a.gesture === "drive") ? "drive" : null,
        keys: [],
        talk: [],
      };
      states.set(id, st);
    });

    const xOf = (id: string) => states.get(id)?.x ?? 0.5;
    const towardRight = (st: ActorState, target?: string) => {
      if (target && states.has(target)) return xOf(target) > st.x;
      // بدون هدف: به طرف وسط قاب یا نزدیک‌ترین نفر
      let best: ActorState | null = null;
      for (const o of states.values()) {
        if (o === st || !o.present) continue;
        if (!best || Math.abs(o.x - st.x) < Math.abs(best.x - st.x)) best = o;
      }
      return best ? best.x > st.x : st.x < 0.5;
    };
    const key = (st: ActorState, t: number, opts: { blend?: number; walk?: number; target?: string; pose?: PoseId } = {}) => {
      const k: ActorKey = {
        t,
        pose: opts.pose ?? poseFor(st.sit, st.gesture, st.hold, st.face, towardRight(st, opts.target)),
        face: st.face,
        holdR: st.hold,
        x: st.x,
        blend: opts.blend,
        walk: opts.walk,
      };
      const last = st.keys[st.keys.length - 1];
      if (last && last.t >= t - 0.01) st.keys[st.keys.length - 1] = { ...k, t: last.t, walk: k.walk ?? (last.x !== k.x ? last.walk : undefined) };
      else st.keys.push(k);
    };
    for (const st of states.values()) key(st, 0, { blend: 0.01 });

    /** راه رفتن تا x؛ اگر نشسته است اول بلند می‌شود. زمان رسیدن را برمی‌گرداند. */
    const walkTo = (st: ActorState, t: number, x: number): number => {
      let at = t;
      if (st.sit) {
        st.sit = false;
        takeSeat(st.id, null);
        key(st, at, { blend: 0.45 });
        at += 0.5;
      }
      const dx = x - st.x;
      if (Math.abs(dx) < 0.02) return at;
      const wd = walkTime(dx);
      st.gesture = st.gesture === "drive" ? null : st.gesture && isMomentary(st.gesture) ? null : st.gesture;
      st.x = x;
      key(st, at, { walk: wd, pose: st.hold !== "none" && st.hold !== "bag" && st.hold !== "ball" ? "standHoldFront" : "stand" });
      return at + wd;
    };

    const captions: Caption[] = [];
    const thoughts: Thought[] = [];
    const base = { zoom: 1, cy: 1000 };
    const cameras: CameraKey[] = [{ t: 0, zoom: base.zoom, cx: FRAME.w / 2, cy: base.cy }];
    const speakers: SceneTimeline["speakers"] = [];
    const cam = (t: number, rel: number, x: number, sit: boolean) => {
      const zoom = base.zoom * rel;
      const half = FRAME.w / (2 * zoom);
      const cx = Math.min(FRAME.w - half, Math.max(half, x * FRAME.w));
      const last = cameras[cameras.length - 1];
      const k = { t, zoom, cx, cy: rel > 1.15 ? (scene.place === "car" ? 800 : sit ? 1080 : 980) : base.cy };
      if (last.t >= t - 0.05) cameras[cameras.length - 1] = { ...k, t: last.t };
      else if (Math.abs(last.zoom - zoom) > 0.005 || Math.abs(last.cx - cx) > 4) cameras.push(k);
    };

    let t = 0.5;
    let lineNo = 0;
    for (const beat of scene.beats) {
      t += beat.delay ?? 0;
      const T = t;
      let dur: number;
      if (beat.kind === "narration") {
        dur = Math.max(1.4, 0.6 + wordCount(beat.text) / 2.6);
        captions.push({ from: T, to: T + dur, text: beat.text });
        cam(T, 1, 0.5, false);
        t += dur;
        if(beat.id) beats.push({id:beat.id,scene:sceneIndex,from:clock+T,to:clock+t,text:beat.text,kind:beat.kind});
        continue;
      }
      dur = beat.kind === "line" ? beat.duration ?? lineDuration(beat.text) : beat.acts.length ? 1.5 : beat.delay ? 0 : 0.7;
      if (beat.delay && beat.acts.length === 0) {
        if(beat.id) beats.push({id:beat.id,scene:sceneIndex,from:clock+T-beat.delay,to:clock+T,text:beat.text,kind:beat.kind});
        continue;
      }
      let busyUntil = T;
      let punch: ActorState | null = null;
      const momentary: ActorState[] = [];

      for (const a of beat.acts) {
        const st = states.get(a.who);
        if (!st) continue;
        if (a.x !== undefined) {
          st.x = a.x; st.home = a.x;
          if(st.sit){
            const seat=nearestSeat(a.x,st.id);
            if(seat!==null && (forceSit || Math.abs(seat-a.x)<=0.12)){st.x=seat;takeSeat(st.id,seat);}
            else if(!forceSit){st.sit=false;takeSeat(st.id,null);}
          }
        }
        if (a.face) st.face = a.face;
        if (a.drop) st.hold = "none";
        if (a.hold) st.hold = a.hold;
        let at = T;
        // حرکت در قاب
        if (a.move === "enter" && !st.present) {
          st.present = true;
          let home = st.home;
          if (a.target && states.get(a.target)?.present) {
            const tx = xOf(a.target);
            home = Math.min(0.84, Math.max(0.16, tx + (st.x < tx ? -0.2 : 0.2)));
          }
          at = walkTo(st, at, home);
        } else if (a.move === "exit" && st.present) {
          at = walkTo(st, at, st.x < 0.5 ? OFF_LEFT : OFF_RIGHT);
          st.present = false;
        } else if (a.move === "approach" && a.target && states.get(a.target)) {
          const tx = xOf(a.target);
          const want = Math.min(0.84, Math.max(0.16, tx + (st.x < tx ? -0.2 : 0.2)));
          at = walkTo(st, at, want);
        } else if (a.move === "toLeft" || a.move === "toRight" || a.move === "toCenter") {
          at = walkTo(st, at, a.move === "toLeft" ? 0.22 : a.move === "toRight" ? 0.78 : 0.5);
        }
        // نشستن/بلند شدن
        if (a.gesture === "jump" || a.gesture === "kick" || a.gesture === "bow") a.sit ??= false;
        if (a.sit === true && !st.sit && st.present && (forceSit || canSit())) {
          const seat = nearestSeat(st.x, st.id);
          if (seat !== null && Math.abs(seat - st.x) > 0.03) at = walkTo(st, at, seat);
          if (seat !== null) {
            st.x = seat;
            takeSeat(st.id, seat);
          }
          st.sit = true;
        } else if (a.sit === false && st.sit && !forceSit) {
          st.sit = false;
          takeSeat(st.id, null);
        }
        if (a.gesture) st.gesture = a.gesture;
        else if (a.drop && (st.gesture === "phoneEar" || st.gesture === "eat")) st.gesture = null;
        if (st.present) key(st, at, { blend: a.gesture && isMomentary(a.gesture) ? 0.32 : 0.45, target: a.target });
        if (a.gesture && isMomentary(a.gesture)) momentary.push(st);
        if (a.thought) thoughts.push({ actor: st.id, from: at + 0.2, to: T + Math.max(dur, 2.2) });
        if (a.face && PUNCH.has(a.face) && st.present) punch = st;
        busyUntil = Math.max(busyUntil, at + 0.6);
      }

      if (beat.kind === "line") {
        const st = states.get(beat.speaker);
        dur = beat.duration !== undefined ? Math.max(beat.duration, busyUntil - T + 0.3) : Math.max(dur, busyUntil - T + lineDuration(beat.text) * 0.8);
        const from = Math.max(T + 0.1, busyUntil - 0.3);
        const to = Math.max(from + 0.1, T + dur - 0.15);
        if (st) {
          st.talk.push({ from, to, pulses: speechPulses(beat.text, from, to) });
          // دیالوگ طولانی بدون حرکت مشخص: کمی با دست توضیح می‌دهد (هر دو دیالوگ یک‌بار)
          if (!beat.acts.some((a) => a.gesture) && wordCount(beat.text) >= 7 && st.gesture === null && st.hold === "none" && st.present && hash(lineNo + seedOf(st.id)) > 0.45) {
            st.gesture = "explain";
            key(st, from + 0.2, { blend: 0.5 });
            st.gesture = null;
            key(st, Math.max(from + 1.2, to - 0.5), { blend: 0.6 });
          }
          if (punch) cam(T, 1.28, punch.x, punch.sit);
          else if (st.present) cam(T, 1.07, (st.x + 0.5) / 2, st.sit);
        }
        speakers.push({ from, to, cast: beat.speaker });
        captions.push({ from: T, to: T + dur, text: beat.text });
        cues.push({
          beatId:beat.id,
          from: clock + T,
          to: clock + T + dur,
          speaker: nameOf(beat.speaker),
          text: beat.text,
          mood: beat.acts.find((a) => a.who === beat.speaker)?.face,
          scene: sceneIndex + 1,
        });
        lineNo++;
      } else {
        dur = Math.max(dur, busyUntil - T + 0.5);
        if (punch) cam(T, 1.28, punch.x, punch.sit);
        else cam(T, 1, 0.5, false);
      }

      // برگشت حرکت‌های لحظه‌ای و آرام شدن چهره
      const back = T + Math.min(dur - 0.05, Math.max(1.1, dur * 0.6));
      for (const st of momentary) {
        if (st.gesture && isMomentary(st.gesture)) st.gesture = null;
        if (st.present) key(st, back, { blend: 0.5 });
      }
      for (const st of states.values()) {
        const calm = CALM[st.face];
        if (calm && st.present) {
          st.face = calm;
          key(st, T + dur, { blend: 0.6 });
        }
      }
      t = T + dur;
      if(beat.id) beats.push({id:beat.id,scene:sceneIndex,from:clock+T,to:clock+t,text:beat.text,kind:beat.kind,...(beat.kind==="line"?{speaker:beat.speaker}:{})});
    }
    const end = t + 0.8;
    cam(t, 1, 0.5, false);

    const actors: SceneActor[] = [];
    for (const st of states.values()) {
      const track: ActorTrack = { keys: st.keys, talk: st.talk, seed: seedOf(st.id) };
      actors.push({ cast: st.id, track });
    }
    scenes.push({ start: clock, end: clock + end, place: scene.place, night: scene.night, actors, captions, cameras, thoughts, speakers });
    clock += end;
  });

  const timeline: Timeline = {
    scenes,
    cast: plan.cast.map((c) => ({ id: c.id, name: c.name, look: c.look })),
    duration: clock,
  };
  return { timeline, cues, warnings, beats };
}

const MOOD_FA: Partial<Record<Expression, string>> = {
  smile: "با لبخند",
  laugh: "با خنده",
  grin: "با ذوق",
  smirk: "با پوزخند",
  angry: "عصبانی",
  furious: "با فریاد",
  pout: "قهر",
  sad: "ناراحت",
  cry: "با گریه",
  surprised: "متعجب",
  shocked: "شوکه",
  worried: "نگران",
  scared: "ترسیده",
  content: "آرام",
  sideEye: "مشکوک",
  annoyed: "کلافه",
  embarrassed: "خجالت‌زده",
  thinking: "مردد",
  sleepy: "خواب‌آلود",
};

function srtTime(sec: number): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

/** زیرنویس SRT برای صداپیشه: «گوینده (حالت): متن» با زمان دقیق هر دیالوگ. */
export function cuesToSrt(cues: Cue[]): string {
  return cues
    .map((c, i) => {
      const mood = c.mood && MOOD_FA[c.mood] ? ` (${MOOD_FA[c.mood]})` : "";
      return `${i + 1}\n${srtTime(c.from)} --> ${srtTime(c.to)}\n${c.speaker}${mood}: ${c.text}\n`;
    })
    .join("\n");
}

export type { Beat };
