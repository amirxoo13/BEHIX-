import { Wand2 } from "lucide-react";
import { useEffect, useState } from "react";
import { findChar } from "@/studio/characters";
import { fa } from "@/studio/format";
import { useStudio } from "@/studio/store";
import { VOICES, speak, speakableText, type TtsProgress, type VoiceId } from "@/studio/tts";
import type { Shot } from "@/studio/types";

const VOICE_KEY = "behix-voices";

function readVoices(): Record<string, VoiceId> {
  try {
    const raw = JSON.parse(localStorage.getItem(VOICE_KEY) ?? "{}") as Record<string, string>;
    const out: Record<string, VoiceId> = {};
    for (const [k, v] of Object.entries(raw)) if (VOICES.some((x) => x.id === v)) out[k] = v as VoiceId;
    return out;
  } catch {
    return {};
  }
}

function speakerOf(shot: Shot): string | null {
  if (shot.speaker === "a") return shot.actorA.charId;
  if (shot.speaker === "b") return shot.actorB.charId;
  return null;
}

/** صدای فارسی خودکار برای دیالوگ‌ها (داخل مرورگر). */
export function VoicePanel() {
  const shots = useStudio((s) => s.shots);
  const selected = useStudio((s) => s.selected);
  const audioUrls = useStudio((s) => s.audioUrls);
  const busyStudio = useStudio((s) => s.playing || s.exporting || s.recording);
  const [voices, setVoices] = useState<Record<string, VoiceId>>({});
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  useEffect(() => setVoices(readVoices()), []);

  const speakers = [...new Set(shots.map(speakerOf).filter((x): x is string => Boolean(x)))];
  // پیش‌فرض: شخصیت‌ها یکی‌درمیان صدای متفاوت می‌گیرند تا از هم تشخیص داده شوند.
  const voiceFor = (charId: string): VoiceId =>
    voices[charId] ?? VOICES[Math.max(0, speakers.indexOf(charId)) % VOICES.length].id;

  const setVoice = (charId: string, v: VoiceId) => {
    const next = { ...voices, [charId]: v };
    setVoices(next);
    try {
      localStorage.setItem(VOICE_KEY, JSON.stringify(next));
    } catch {
      // فقط یک راحتی است.
    }
  };

  const progressText = (p: TtsProgress, label: string) =>
    p.phase === "download"
      ? `دانلود صدای فارسی (فقط بار اول، حدود ۶۳ مگابایت): ${fa(Math.round(p.ratio * 100))}٪`
      : label;

  const make = async (indexes: number[]) => {
    setWorking(true);
    setError("");
    let done = 0;
    try {
      for (const i of indexes) {
        const shot = useStudio.getState().shots[i];
        const who = shot && speakerOf(shot);
        if (!shot || !who || !speakableText(shot.dialogue)) continue;
        const label = `در حال ساخت صدای نمای ${fa(i + 1)} (${fa(done + 1)} از ${fa(indexes.length)})…`;
        setNote(label);
        const { blob, seconds } = await speak(shot.dialogue, voiceFor(who), (p) => setNote(progressText(p, label)));
        const s = useStudio.getState();
        s.setAudio(shot.id, URL.createObjectURL(blob));
        // نما باید دست‌کم به اندازهٔ صدا طول بکشد (صدا با سرعت pitch پخش می‌شود).
        const need = Math.ceil((seconds / (shot.pitch || 1) + 0.4) * 10) / 10;
        if (need > shot.duration) s.patchShotAt(i, { duration: Math.min(30, need) });
        done++;
      }
      setNote(
        done
          ? `صدای ${fa(done)} نما ساخته شد. دهان‌ها از روی همین صدا تکان می‌خورند و در خروجی ویدیو هم هست. با بستن صفحه، صداها پاک می‌شوند.`
          : "نمایی با دیالوگ برای ساخت صدا پیدا نشد.",
      );
    } catch (err) {
      setError(
        `ساخت صدا انجام نشد: ${err instanceof Error ? err.message : "خطای نامشخص"}. اگر بار اول است، اتصال اینترنت (Hugging Face) را بررسی کنید.`,
      );
      setNote("");
    } finally {
      setWorking(false);
    }
  };

  const shot = shots[selected];
  const withoutAudio = shots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => speakerOf(s) && speakableText(s.dialogue) && !audioUrls[s.id])
    .map(({ i }) => i);
  const busy = working || busyStudio;

  return (
    <section className="panel mt-4 max-w-2xl" aria-labelledby="voice-title">
      <p className="kicker latin">PERSIAN VOICE</p>
      <h2 id="voice-title" className="mt-1 text-lg font-bold">
        صدای فارسی خودکار از متن دیالوگ
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        بدون ضبط، از روی متن هر دیالوگ صدای فارسی ساخته می‌شود (موتور متن‌باز Piper، داخل همین مرورگر، بدون مصرف توکن).
        فعلاً فقط دو صدای مرد فارسی موجود است؛ برای شخصیت زن یا بچه، «زیروبم پخش» را بالاتر ببرید.
      </p>

      {speakers.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {speakers.map((id) => (
            <label key={id} className="block">
              <span className="lbl">صدای {findChar(id).name}</span>
              <select
                className="field"
                value={voiceFor(id)}
                disabled={busy}
                onChange={(e) => setVoice(id, e.target.value as VoiceId)}
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !shot || !speakerOf(shot) || !speakableText(shot.dialogue)}
          onClick={() => {
            if (audioUrls[shot.id] && !window.confirm("این نما صدا دارد. با صدای ساخته‌شده جایگزین شود؟")) return;
            void make([selected]);
          }}
        >
          <Wand2 className="size-4" />
          ساخت صدا برای همین نما
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy || withoutAudio.length === 0} onClick={() => void make(withoutAudio)}>
          ساخت صدا برای همهٔ دیالوگ‌های بی‌صدا ({fa(withoutAudio.length)})
        </button>
      </div>
      {note && (
        <p role="status" className="mt-2 text-sm text-cyan">
          {note}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
