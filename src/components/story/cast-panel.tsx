import { useEffect, useMemo, useState } from "react";
import { BookmarkPlus, Trash2, UserPlus } from "lucide-react";
import { FrameThumb } from "@/components/story/frame-thumb";
import { CLOTHES, defaultHair, type Clothing, type Hair, type Look } from "@/studio/stick/figure";
import { changeText, copyCharacter, type LibraryCharacter, type StoryProject } from "@/studio/stick/project";
import { deleteCharacter, listCharacters, saveCharacter } from "@/studio/stick/project-db";
import { castTimeline } from "@/studio/stick/previews";
import type { CastMember } from "@/studio/stick/story-render";
import { VOICES, VOICE_IDS, type Voice } from "@/studio/stick/voice";

const KIND: Record<Look["kind"], string> = { man: "مرد", woman: "زن", boy: "پسربچه", girl: "دختربچه", oldMan: "پیرمرد", oldWoman: "پیرزن", baby: "نوزاد" };
const CLOTHING: Record<Clothing, string> = { classic: "ساده", tshirt: "تی‌شرت", shirt: "پیراهن", coat: "کت", dress: "پیراهن بلند", chador: "چادر" };
const HAIR: Record<Hair, string> = { tufts: "سیخ‌سیخی", short: "کوتاه", bald: "کچل", curly: "فرفری", long: "بلند", bob: "کوتاه صاف", ponytail: "دم‌اسبی", scarf: "روسری" };
const EXTRAS = [["glasses", "عینک"], ["mustache", "سبیل"], ["beard", "ریش"], ["cap", "کلاه"]] as const;

/**
 * بازیگران داستان با پیش‌نمایش زنده (مثل ساخت شخصیت در Plotagon):
 * نوع، مو، لباس و جزئیات چهره؛ ذخیره در کتابخانه و آوردن از کتابخانه به داستان.
 */
export function CastPanel({ project, cast, commit, voices, onVoice }: { project: StoryProject; cast: CastMember[]; commit: (f: (p: StoryProject) => StoryProject) => void; voices: Record<string, Voice>; onVoice: (castId: string, v: Voice) => void }) {
  const [library, setLibrary] = useState<LibraryCharacter[]>([]);
  const [error, setError] = useState("");
  const refresh = () => listCharacters().then(setLibrary).catch(() => setError("کتابخانهٔ شخصیت‌ها خوانده نشد."));
  useEffect(() => {
    void refresh();
  }, []);
  const alter = (c: CastMember, look: Look) => {
    try {
      commit((p) => copyCharacter(p, { ...c, look }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };
  const outside = library.filter((c) => !cast.some((x) => x.id === c.id));

  return (
    <div className="cast-panel">
      {cast.length === 0 && (
        <p className="studio-empty">هنوز شخصیتی در داستان نیست. در متن، بار اول اسم را با پرانتز معرفی کنید؛ مثلاً «مریم (زن، سمت چپ)».</p>
      )}
      <ul className="cast-list">
        {cast.map((c) => (
          <li key={c.id} className="cast-card">
            <CastPreview member={c} />
            <div className="cast-fields">
              <h3>{c.name}</h3>
              <div className="cast-grid">
                <label>
                  <span className="group-label">نوع</span>
                  <select className="field" value={c.look.kind} onChange={(e) => {
                    const kind = e.target.value as Look["kind"];
                    alter(c, { ...c.look, kind, hair: c.look.hair ?? defaultHair(kind) });
                  }}>
                    {Object.entries(KIND).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
                <label>
                  <span className="group-label">مو</span>
                  <select className="field" value={c.look.hair ?? defaultHair(c.look.kind)} onChange={(e) => alter(c, { ...c.look, hair: e.target.value as Hair })}>
                    {Object.entries(HAIR).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                </label>
                <label>
                  <span className="group-label">لباس</span>
                  <select className="field" value={c.look.clothing ?? "classic"} onChange={(e) => alter(c, { ...c.look, clothing: e.target.value as Clothing })}>
                    {CLOTHES.map((id) => <option key={id} value={id}>{CLOTHING[id]}</option>)}
                  </select>
                </label>
              </div>
              <label>
                <span className="group-label">صدا (Gemini)</span>
                <select className="field" value={voices[c.id] ?? ""} onChange={(e) => onVoice(c.id, e.target.value as Voice)}>
                  {VOICE_IDS.map((v) => <option key={v} value={v}>{v} · {VOICES[v] === "f" ? "زن" : "مرد"}</option>)}
                </select>
              </label>
              <div className="chips" aria-label={`جزئیات ${c.name}`}>
                {EXTRAS.map(([key, label]) => (
                  <button key={key} type="button" aria-pressed={!!c.look[key]} className={c.look[key] ? "chip is-on" : "chip"} onClick={() => alter(c, { ...c.look, [key]: !c.look[key] })}>
                    {label}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void saveCharacter(structuredClone(c)).then(refresh).catch(() => setError("ذخیرهٔ شخصیت انجام نشد."))}>
                <BookmarkPlus size={16} aria-hidden /> ذخیره در کتابخانه
              </button>
            </div>
          </li>
        ))}
      </ul>

      <h3 className="panel-subtitle">کتابخانهٔ شخصیت‌ها</h3>
      {library.length === 0 ? (
        <p className="studio-empty">شخصیت‌هایی که ذخیره کنید اینجا می‌آیند و در داستان‌های دیگر هم قابل استفاده‌اند.</p>
      ) : (
        <ul className="library-list">
          {library.map((c) => {
            const inStory = cast.some((x) => x.id === c.id);
            return (
              <li key={c.id}>
                <CastPreview member={c} small />
                <span className="grow"><b>{c.name}</b><small>{KIND[c.look.kind]}</small></span>
                <button type="button" className="icon-btn" disabled={inStory || project.cast.length >= 8} title={inStory ? "در داستان هست" : "افزودن به داستان"} aria-label={`افزودن ${c.name} به داستان`}
                  onClick={() => commit((p) => changeText(copyCharacter(p, c), `${p.text}${p.text.endsWith("\n") || !p.text ? "" : "\n"}${c.name} (${KIND[c.look.kind]}) وارد می‌شود.`))}>
                  <UserPlus size={16} aria-hidden />
                </button>
                <button type="button" className="icon-btn" aria-label={`حذف ${c.name} از کتابخانه`} title="حذف از کتابخانه" onClick={() => void deleteCharacter(c.id).then(refresh).catch(() => setError("حذف انجام نشد."))}>
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {outside.length > 0 && <p className="text-xs text-muted">افزودن از کتابخانه یک نسخهٔ مستقل در داستان می‌گذارد.</p>}
      {error && <p role="alert" className="story-warn">{error}</p>}
    </div>
  );
}

function CastPreview({ member, small }: { member: CastMember; small?: boolean }) {
  const timeline = useMemo(() => castTimeline(member), [member]);
  return <FrameThumb timeline={timeline} t={1} width={small ? 44 : 84} className={small ? "cast-thumb is-small" : "cast-thumb"} label={`ظاهر ${member.name}`} />;
}
