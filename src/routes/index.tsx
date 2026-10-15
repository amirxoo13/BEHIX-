import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { findChar } from "@/studio/characters";
import { PHASES, phaseStatus } from "@/studio/flow";
import { fa } from "@/studio/format";
import { totalDuration } from "@/studio/frame";
import { GENRES } from "@/studio/labels";
import { useStudio } from "@/studio/store";

export const Route = createFileRoute("/")({ component: DeskPage });

function DeskPage() {
  const title = useStudio((s) => s.title);
  const logline = useStudio((s) => s.logline);
  const genre = useStudio((s) => s.genre);
  const shots = useStudio((s) => s.shots);
  const audioUrls = useStudio((s) => s.audioUrls);
  const setMeta = useStudio((s) => s.setMeta);
  const names = [
    ...new Set(shots.flatMap((s) => [s.actorA, s.actorB, ...s.extras].map((x) => findChar(x.charId).name))),
  ];

  return (
    <Shell>
      <h1 className="sr-only">BEHIX — {title}</h1>
      <img className="lockup" src="/brand/lockup.png" alt="BEHIX. Animate Your Imagination." />
      <p className="mx-auto mt-4 max-w-xl text-center text-sm leading-6 text-muted">
        تولید را به ترتیب خط تولید جلو ببرید. سناریو، بعد شخصیت، بعد فضا، دکوپاژ، انیمیت، صدا و خروجی.
      </p>

      <Link to="/story" className="panel mx-auto mt-6 flex max-w-xl items-center justify-between gap-3 no-underline">
        <span>
          <span className="block text-lg font-bold">داستان به فیلم ✦ آدمکی</span>
          <span className="mt-1 block text-sm leading-6 text-muted">داستان را با همهٔ جزئیات بنویسید؛ فیلم بی‌صدای ۱۰۸۰×۱۹۲۰ و زیرنویس زمان‌دار برای صداپیشه ساخته می‌شود.</span>
        </span>
        <span className="btn btn-primary shrink-0">شروع</span>
      </Link>

      <div className="mx-auto mt-6 grid max-w-xl gap-3">
        <label className="lbl" htmlFor="title">
          نام پروژه
        </label>
        <input
          id="title"
          className="field text-lg font-bold"
          value={title}
          autoComplete="off"
          onChange={(e) => setMeta({ title: e.target.value })}
        />
        <label className="lbl" htmlFor="logline">
          لاگ‌لاین
        </label>
        <textarea
          id="logline"
          className="field tall"
          value={logline}
          onChange={(e) => setMeta({ logline: e.target.value })}
        />
        <label className="lbl" htmlFor="genre">
          گونه
        </label>
        <select id="genre" className="field" value={genre} onChange={(e) => setMeta({ genre: e.target.value })}>
          {GENRES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <dl className="mx-auto mt-5 grid max-w-xl grid-cols-3 gap-2 text-center">
        <div className="panel">
          <dt className="text-sm text-muted">نما</dt>
          <dd className="font-bold">{fa(shots.length)}</dd>
        </div>
        <div className="panel">
          <dt className="text-sm text-muted">زمان</dt>
          <dd className="font-bold">{fa(Number(totalDuration(shots).toFixed(1)))}ث</dd>
        </div>
        <div className="panel">
          <dt className="text-sm text-muted">بازیگر</dt>
          <dd className="font-bold">{fa(names.length)}</dd>
        </div>
      </dl>

      <div className="sheet mx-auto mt-6 max-w-xl">
        {PHASES.map((phase) => (
          <Link key={phase.to} to={phase.to}>
            <span className="step-no">{phase.no}</span>
            <span>
              <span className="block font-bold">{phase.label}</span>
              <span className="text-sm text-muted">{phaseStatus(phase.to, shots, audioUrls)}</span>
            </span>
            <span className="latin text-sm text-cyan">{phase.en}</span>
          </Link>
        ))}
      </div>
      <p className="mx-auto mt-4 max-w-xl text-sm text-muted">پروژه روی همین دستگاه می‌ماند.</p>
    </Shell>
  );
}
