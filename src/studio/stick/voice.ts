/**
 * صداگذاری دیالوگ‌ها با Gemini 3.8 TTS روی Agent Platform (بخش خالص و قابل آزمون).
 * - صدای هر شخصیت از ۳۰ صدای Gemini، پیش‌فرض بر اساس جنسیت و سن
 * - حالت چهرهٔ دیالوگ به دستور لحن تبدیل می‌شود
 * - دهان شخصیت از روی پوش (envelope) صدای واقعی باز و بسته می‌شود
 */
import type { Expression } from "./face.ts";
import type { Look } from "./figure.ts";
import type { MouthPulse } from "./speech.ts";
import type { Directed } from "./story-direct.ts";
import type { Timeline } from "./story-render.ts";

/** مدل اصلی صدا (سرور می‌تواند با TTS_MODEL عوضش کند؛ این مقدار فقط کلید کش روی دستگاه است). */
export const TTS_MODEL = "gemini-3.8-flash-tts";
/** مدل پیش‌نمایش و جایگزین وقتی Flash خطا داد (سرور: TTS_PREVIEW_MODEL). */
export const TTS_PREVIEW_MODEL = "gemini-3.8-flash-lite-tts";
/**
 * مدل کلیپ‌های قدیمی MP3. فقط برای پیدا کردن کلیپ‌های از قبل ذخیره‌شده با کلید قدیمی (IndexedDB و GCS)؛
 * هرگز به هیچ API فرستاده نمی‌شود.
 */
export const LEGACY_CACHE_MODEL = "gemini-2.5-pro-tts";
/** صداهای Gemini TTS (مستندات Google Cloud) با جنسیت برای انتخاب پیش‌فرض. */
export const VOICES = {
  Kore: "f", Aoede: "f", Leda: "f", Zephyr: "f", Callirrhoe: "f", Autonoe: "f", Despina: "f", Erinome: "f",
  Laomedeia: "f", Achernar: "f", Gacrux: "f", Pulcherrima: "f", Vindemiatrix: "f", Sulafat: "f",
  Charon: "m", Puck: "m", Fenrir: "m", Orus: "m", Enceladus: "m", Iapetus: "m", Umbriel: "m", Algieba: "m",
  Algenib: "m", Rasalgethi: "m", Alnilam: "m", Schedar: "m", Achird: "m", Zubenelgenubi: "m", Sadachbia: "m", Sadaltager: "m",
} as const;
export type Voice = keyof typeof VOICES;
export const VOICE_IDS = Object.keys(VOICES) as Voice[];
export const MAX_LINE = 400;

const POOLS: Record<Look["kind"], Voice[]> = {
  man: ["Charon", "Orus", "Iapetus", "Alnilam"],
  woman: ["Kore", "Aoede", "Despina", "Erinome"],
  boy: ["Puck", "Achird"],
  girl: ["Leda", "Zephyr"],
  oldMan: ["Algenib", "Rasalgethi"],
  oldWoman: ["Vindemiatrix", "Sulafat"],
  baby: ["Leda"],
};
/** صدای پیش‌فرض یکتا برای هر شخصیت تا دو نفر هم‌صدا نشوند. */
export function defaultVoices(cast: { id: string; look: Look }[], chosen: Record<string, string> = {}): Record<string, Voice> {
  const used = new Set(Object.values(chosen));
  const out: Record<string, Voice> = {};
  for (const c of cast) {
    const pick = chosen[c.id];
    if (pick && pick in VOICES) {
      out[c.id] = pick as Voice;
      continue;
    }
    const pool = POOLS[c.look.kind];
    const v = pool.find((x) => !used.has(x)) ?? pool[0];
    used.add(v);
    out[c.id] = v;
  }
  return out;
}

const MOODS: Partial<Record<Expression, string>> = {
  smile: "warmly, with a smile", grin: "excitedly", laugh: "while laughing", smirk: "sarcastically",
  angry: "angrily", furious: "shouting furiously", pout: "sulking", sad: "sadly", cry: "crying, voice breaking",
  shocked: "in shock", surprised: "surprised", scared: "fearfully, trembling", worried: "worried, anxious",
  content: "calmly", kiss: "affectionately", sideEye: "suspiciously", annoyed: "irritated",
  embarrassed: "shyly, embarrassed", thinking: "thoughtfully, slowly", sleepy: "sleepily",
};
/**
 * لحن کوتاه برای Gemini 3.8 TTS (speechMetadata.style): کمتر از ۱۵ کلمه، فقط حس و گویش.
 * سن و جنسیت با خود صدا می‌آید نه با لحن، و پیش‌درآمدهایی مثل «Read this line…» روی 3.8 گاهی خوانده می‌شوند
 * (skills/audio-voice-direction؛ مستند: https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/text-to-speech/prompting-guide).
 * TODO(skills): AI skill task id "tts.line" (skills/audio-voice-direction)؛ بارگذار src/ai/skills.ts هنوز روی master نیست.
 */
export function stylePrompt(mood?: Expression, _kind?: Look["kind"]): string {
  const m = mood ? MOODS[mood] : undefined;
  return m ? `${m}; natural, colloquial Tehrani Persian` : "natural, colloquial Tehrani Persian";
}

/** دستور لحن قدیمی (Gemini 2.5)؛ فقط برای ساختن کلید کلیپ‌های MP3 ذخیره‌شده، هرگز فرستاده نمی‌شود. */
export function legacyStylePrompt(mood?: Expression, kind?: Look["kind"]): string {
  const who = kind === "boy" || kind === "girl" ? "a child" : kind === "oldMan" || kind === "oldWoman" ? "an elderly person" : "an adult";
  return `Read this line as ${who} in natural, colloquial Tehrani Persian${mood && MOODS[mood] ? `, ${MOODS[mood]}` : ""}. Do not add words.`;
}

/** کلید پایدار هر کلیپ؛ با تغییر مدل، متن، صدا یا لحن عوض می‌شود. */
export async function clipKey(text: string, voice: Voice, prompt: string, model: string = TTS_MODEL): Promise<string> {
  const data = new TextEncoder().encode(`${model}|${voice}|${prompt}|${text}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * پالس‌های دهان از روی صدای واقعی: انرژی RMS در پنجره‌های ۴۰ میلی‌ثانیه،
 * بخش‌های بالای آستانه یک پالس با شدت نسبی‌اند.
 */
export function envelopePulses(samples: Float32Array, sampleRate: number, offset: number): MouthPulse[] {
  const win = Math.max(1, Math.round(sampleRate * 0.04));
  const rms: number[] = [];
  for (let i = 0; i < samples.length; i += win) {
    let s = 0;
    const end = Math.min(samples.length, i + win);
    for (let j = i; j < end; j++) s += samples[j] * samples[j];
    rms.push(Math.sqrt(s / (end - i)));
  }
  const peak = Math.max(...rms, 1e-6);
  const gate = peak * 0.12;
  const pulses: MouthPulse[] = [];
  let start = -1, top = 0;
  const step = win / sampleRate;
  for (let k = 0; k <= rms.length; k++) {
    const on = k < rms.length && rms[k] > gate;
    if (on && start < 0) {
      start = k;
      top = 0;
    }
    if (on) top = Math.max(top, rms[k]);
    // هر هجا حداکثر ۲۴۰ میلی‌ثانیه؛ صداهای کشیده چند بار باز و بسته می‌شوند
    if (start >= 0 && (!on || k - start >= 6)) {
      pulses.push({ from: offset + start * step, to: offset + k * step, strength: Math.min(1, 0.35 + (0.65 * top) / peak) });
      start = on ? k : -1;
      top = on ? rms[k] : 0;
    }
  }
  return pulses;
}

export type VoiceClip = { samples: Float32Array; sampleRate: number };
export type PlacedClip = VoiceClip & { start: number; beatId: string };

/**
 * کلیپ هر دیالوگ را روی بازهٔ حرف زدن همان دیالوگ می‌گذارد و پالس‌های دهان گوینده را
 * با پوش صدای واقعی جایگزین می‌کند. خط زمان ورودی دست نمی‌خورد.
 */
export function placeVoices(directed: Directed, clips: Map<string, VoiceClip>): { timeline: Timeline; placed: PlacedClip[] } {
  const timeline: Timeline = structuredClone(directed.timeline);
  const placed: PlacedClip[] = [];
  for (const beat of directed.beats) {
    const clip = beat.kind === "line" ? clips.get(beat.id) : undefined;
    if (!clip || !beat.speaker) continue;
    const scene = timeline.scenes[beat.scene];
    const local = beat.from - scene.start, end = beat.to - scene.start;
    const span = scene.speakers.find((s) => s.cast === beat.speaker && s.from >= local - 1e-6 && s.from < end);
    if (!span) continue;
    const start = scene.start + span.from;
    placed.push({ ...clip, start, beatId: beat.id });
    const track = scene.actors.find((a) => a.cast === beat.speaker)?.track;
    const talk = track?.talk.find((t) => Math.abs(t.from - span.from) < 1e-6);
    if (talk) {
      talk.pulses = envelopePulses(clip.samples, clip.sampleRate, span.from);
      talk.to = Math.max(talk.to, span.from + clip.samples.length / clip.sampleRate);
    }
  }
  return { timeline, placed };
}

/** مدت لازم برای هر دیالوگ تا صدا کامل پخش شود (حاشیهٔ شروع و پایان حرف زدن). */
export const lineDurationFor = (seconds: number) => Math.min(120, Math.max(1, Math.round((seconds + 0.5) * 10) / 10));

/** میکس همهٔ کلیپ‌ها در یک کانال، به طول فیلم. */
/** نرخ نمونهٔ صدای میکس‌شدهٔ فیلم (همان نرخ خروجی Gemini TTS). */
export const MIX_RATE = 24000;
export function mixClips(placed: PlacedClip[], duration: number, sampleRate = MIX_RATE): Float32Array {
  const out = new Float32Array(Math.ceil(duration * sampleRate));
  for (const c of placed) {
    const ratio = c.sampleRate / sampleRate;
    const at = Math.round(c.start * sampleRate);
    const len = Math.floor(c.samples.length / ratio);
    for (let i = 0; i < len && at + i < out.length; i++) out[at + i] += c.samples[Math.floor(i * ratio)];
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
  return out;
}

const SENTENCE = /[.!?؟…]+["»)\]]*\s+|\n+/g;
const CLAUSE = /[،,؛;:]\s*|\s[-–—]\s/g;

/**
 * دیالوگ بلندتر از max به تکه‌های ≤ max، اول سر مرز جمله، بعد سر ویرگول/نقطه‌ویرگول، در آخر سر فاصله.
 * هیچ حرفی جا نمی‌افتد (به‌جز فاصله‌های سر مرز). سرور هم همین سقف را دارد.
 */
export function splitLine(text: string, max = MAX_LINE): string[] {
  const t = text.trim();
  if (t.length <= max) return t ? [t] : [];
  const pieces = (s: string, re: RegExp) => {
    const out: string[] = [];
    let last = 0;
    for (const m of s.matchAll(re)) {
      const end = (m.index ?? 0) + m[0].length;
      out.push(s.slice(last, end));
      last = end;
    }
    out.push(s.slice(last));
    return out.filter((x) => x.trim());
  };
  const hard = (s: string) => {
    const out: string[] = [];
    let rest = s.trim();
    while (rest.length > max) {
      let cut = rest.lastIndexOf(" ", max);
      if (cut < max / 2) cut = max;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
    return out;
  };
  const units = pieces(t, SENTENCE).flatMap((s) => (s.trim().length <= max ? [s] : pieces(s, CLAUSE).flatMap((c) => (c.trim().length <= max ? [c] : hard(c)))));
  const chunks: string[] = [];
  let cur = "";
  for (const u of units) {
    if ((cur + u).trim().length <= max) cur += u;
    else {
      if (cur.trim()) chunks.push(cur.trim());
      cur = u;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

/** چند کلیپ پشت‌سرهم با مکث کوتاه بین‌شان (همه به نرخ کلیپ اول). */
export function concatClips(clips: VoiceClip[], gap = 0.12): VoiceClip {
  if (clips.length === 1) return clips[0];
  const sampleRate = clips[0]?.sampleRate ?? MIX_RATE;
  const pad = Math.round(gap * sampleRate);
  const parts = clips.map((c) => (c.sampleRate === sampleRate ? c.samples : resample(c.samples, c.sampleRate, sampleRate)));
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0) + pad * Math.max(0, parts.length - 1));
  let at = 0;
  parts.forEach((p, i) => {
    out.set(p, at);
    at += p.length + (i < parts.length - 1 ? pad : 0);
  });
  return { samples: out, sampleRate };
}

function resample(x: Float32Array, from: number, to: number): Float32Array {
  const out = new Float32Array(Math.floor((x.length * to) / from));
  for (let i = 0; i < out.length; i++) {
    const p = (i * from) / to, k = Math.floor(p), f = p - k;
    out[i] = (x[k] ?? 0) * (1 - f) + (x[k + 1] ?? x[k] ?? 0) * f;
  }
  return out;
}

/** WAV شانزده‌بیتی تک‌کاناله از نمونه‌ها (برای ذخیرهٔ کلیپ چندتکه روی دستگاه). */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const out = new Uint8Array(44 + samples.length * 2);
  const v = new DataView(out.buffer);
  const ascii = (at: number, s: string) => { for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i); };
  ascii(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  ascii(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const x = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  return out;
}
