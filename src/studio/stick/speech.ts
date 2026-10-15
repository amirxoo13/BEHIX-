/** Written Persian omits short vowels: these are documented estimates, not phonetics. */
const SYLLABLES: Record<string, number> = {
  سلام: 2,
  علی: 2,
  سارا: 2,
  من: 1,
  تو: 1,
  او: 1,
  ما: 1,
  شما: 2,
  نه: 1,
  بله: 2,
  خانه: 2,
  خونه: 2,
  بابا: 2,
  مادر: 2,
  پدر: 2,
  امروز: 2,
  فردا: 2,
  عزیزم: 3,
  چرا: 2,
  آروم: 2,
  برو: 2,
  نگه: 2,
  دار: 1,
  است: 1,
  هست: 1,
};
export type MouthPulse = { from: number; to: number; strength: number };
export function estimateSyllables(word: string): number {
  const w = word
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064B-\u065F\u200c]/g, "");
  return (
    SYLLABLES[w] ??
    Math.max(1, Math.min(8, Math.max((w.match(/[اآوی]/g) ?? []).length, Math.ceil(w.length / 3))))
  );
}
export function speechPulses(text: string, from: number, to: number): MouthPulse[] {
  if (!(to > from) || !text.trim()) return [];
  const units: { weight: number; sound: boolean }[] = [];
  for (const token of text.match(/[\p{L}\p{N}\u200c]+|[،؛.!؟?…]/gu) ?? []) {
    if (/^[،؛.!؟?…]$/.test(token))
      units.push({ weight: /[.!؟?…]/.test(token) ? 1.8 : 0.9, sound: false });
    else {
      for (let i = 0; i < estimateSyllables(token); i++) units.push({ weight: 1, sound: true });
      units.push({ weight: 0.35, sound: false });
    }
  }
  const sum = units.reduce((n, u) => n + u.weight, 0);
  const scale = (to - from) / (sum || 1);
  let cursor = from;
  const pulses: MouthPulse[] = [];
  for (const unit of units) {
    const end = cursor + unit.weight * scale;
    if (unit.sound) pulses.push({ from: cursor, to: end, strength: 0.8 });
    cursor = end;
  }
  return pulses;
}
export function mouthAt(pulses: MouthPulse[], t: number): number {
  const pulse = pulses.find((p) => t > p.from && t < p.to);
  return pulse
    ? pulse.strength * Math.sin((Math.PI * (t - pulse.from)) / (pulse.to - pulse.from))
    : 0;
}
/** Finite interval, normalized damped spring, with zero endpoint velocity. */
export function springEase(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  const phase = u * u * (3 - 2 * u);
  const f = (x: number) => 1 - Math.exp(-7 * x) * (Math.cos(10 * x) + 0.7 * Math.sin(10 * x));
  return f(phase) / f(1);
}
