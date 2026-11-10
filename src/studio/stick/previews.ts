/**
 * پیش‌نمایش‌های کوچک برای کتابخانه‌ها (مثل گالری صحنه و ساخت شخصیت در Plotagon):
 * - مکان خالی، بدون بازیگر
 * - یک شخصیت ایستاده وسط قاب با حالت چهرهٔ انتخابی
 * خروجی همان Timeline موتور اصلی است، پس پیش‌نمایش دقیقاً همان چیزی است که در فیلم دیده می‌شود.
 */
import type { Expression } from "./face.ts";
import type { PlaceId } from "./places.ts";
import { FRAME, type CastMember, type SceneTimeline, type Timeline } from "./story-render.ts";

const emptyScene = (place: PlaceId, night: boolean): SceneTimeline => ({
  start: 0,
  end: 4,
  place,
  night,
  actors: [],
  captions: [],
  cameras: [{ t: 0, zoom: 1, cx: FRAME.w / 2, cy: 1000 }],
  thoughts: [],
  speakers: [],
});

/** یک مکان خالی برای کارت گالری صحنه‌ها. */
export function placeTimeline(place: PlaceId, night = false): Timeline {
  return { scenes: [emptyScene(place, night)], cast: [], duration: 4 };
}

/** یک شخصیت ایستاده در مکان خالی، با دوربین نزدیک‌تر تا ظاهرش خوب دیده شود. */
export function castTimeline(member: CastMember, face: Expression = "smile"): Timeline {
  const scene = emptyScene("blank", false);
  scene.actors = [{ cast: member.id, track: { keys: [{ t: 0, pose: "stand", face, x: 0.5 }], talk: [], seed: 1 } }];
  scene.cameras = [{ t: 0, zoom: 1.35, cx: FRAME.w / 2, cy: 1000 }];
  return { scenes: [scene], cast: [member], duration: 4 };
}

/** زمانی از صحنه که برای کارت آن صحنه نشان داده می‌شود: کمی بعد از شروع تا محو اول تمام شده باشد. */
export function sceneCoverTime(scene: { start: number; end: number }): number {
  const len = scene.end - scene.start;
  return scene.start + Math.min(len / 2, Math.max(0.4, len * 0.3));
}
