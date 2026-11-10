import { hash01 } from "./rig.ts";
/** Closed-form particles: seeking or exporting a frame never depends on earlier frames. */
export function tearsAt(time: number, crying: boolean, id: string) {
  if (!crying || !Number.isFinite(time) || time < 0) return [];
  let seed = 0;
  for (const ch of id) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0;
  const newest = Math.floor(time * 3);
  const drops: { x: number; y: number; life: number }[] = [];
  for (let i = Math.max(0, newest - 4); i <= newest; i++) {
    const born = i / 3 + hash01(seed + i) * 0.15;
    const age = time - born;
    const y = -6 + 18 * age + 20 * age * age;
    if (age >= 0 && age < 1 / 0.7 && y < 40)
      drops.push({ x: hash01(seed + i + 991) < 0.5 ? -16 : 16, y, life: 1 - age * 0.7 });
  }
  return drops;
}
