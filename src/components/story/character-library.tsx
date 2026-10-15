import { useEffect, useState } from "react";
import { CLOTHES, type Clothing, type Look } from "@/studio/stick/figure";
import {
  copyCharacter,
  changeText,
  type LibraryCharacter,
  type StoryProject,
} from "@/studio/stick/project";
import { listCharacters, saveCharacter, deleteCharacter } from "@/studio/stick/project-db";
import type { CastMember } from "@/studio/stick/story-render";
const KIND = {
  man: "مرد",
  woman: "زن",
  boy: "پسربچه",
  girl: "دختربچه",
  oldMan: "پیرمرد",
  oldWoman: "پیرزن",
  baby: "نوزاد",
};
const CLOTHING: Record<Clothing, string> = {
  classic: "ساده",
  tshirt: "تی‌شرت",
  shirt: "پیراهن",
  coat: "کت",
  dress: "پیراهن بلند",
  chador: "چادر",
};
export function CharacterLibrary({
  project,
  cast,
  commit,
}: {
  project: StoryProject;
  cast: CastMember[];
  commit: (f: (p: StoryProject) => StoryProject) => void;
}) {
  const [library, setLibrary] = useState<LibraryCharacter[]>([]),
    [error, setError] = useState("");
  const refresh = () =>
    listCharacters()
      .then(setLibrary)
      .catch(() => setError("کتابخانه قابل خواندن نیست."));
  useEffect(() => {
    void refresh();
  }, []);
  const alter = (c: CastMember, look: Look) => commit((p) => copyCharacter(p, { ...c, look }));
  return (
    <details className="panel">
      <summary className="cursor-pointer font-bold">ظاهر و کتابخانهٔ شخصیت‌ها</summary>
      <div className="grid gap-3 mt-3">
        {cast.map((c) => (
          <div key={c.id} className="grid gap-2">
            <b>{c.name}</b>
            <div className="grid grid-cols-2 gap-2">
              <label>
                نوع
                <select
                  className="field"
                  value={c.look.kind}
                  onChange={(e) => alter(c, { ...c.look, kind: e.target.value as Look["kind"] })}
                >
                  {Object.entries(KIND).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                لباس
                <select
                  className="field"
                  value={c.look.clothing ?? "classic"}
                  onChange={(e) => alter(c, { ...c.look, clothing: e.target.value as Clothing })}
                >
                  {CLOTHES.map((id) => (
                    <option key={id} value={id}>
                      {CLOTHING[id]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="btn btn-ghost"
              onClick={() => {
                void saveCharacter(structuredClone(c))
                  .then(refresh)
                  .catch(() => setError("ذخیرهٔ شخصیت انجام نشد."));
              }}
            >
              ذخیرهٔ «{c.name}» در کتابخانه
            </button>
          </div>
        ))}
        <p className="text-sm text-muted">افزودن از کتابخانه، یک نسخهٔ مستقل در داستان می‌گذارد.</p>
        {library.map((c) => (
          <div key={c.id} className="flex flex-wrap gap-2 items-center">
            <span>
              {c.name} · {KIND[c.look.kind]}
            </span>
            <button
              className="btn btn-ghost"
              disabled={project.cast.length >= 8 && !project.cast.some((x) => x.id === c.id)}
              onClick={() =>
                commit((p) => {
                  const copied = copyCharacter(p, c);
                  return cast.some((x) => x.id === c.id)
                    ? copied
                    : changeText(
                        copied,
                        `${p.text}\n${c.name} (${KIND[c.look.kind]}) وارد می‌شود.`,
                      );
                })
              }
            >
              افزودن به داستان
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                void deleteCharacter(c.id)
                  .then(refresh)
                  .catch(() => setError("حذف انجام نشد."));
              }}
            >
              حذف از کتابخانه
            </button>
          </div>
        ))}
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
