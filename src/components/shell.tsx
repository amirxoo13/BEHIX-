import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FLOW, PHASES } from "@/studio/flow";
import { finishPlayback, useStudio } from "@/studio/store";

function clean(path: string) {
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

export function Shell({ children }: { children: ReactNode }) {
  const boot = useStudio((s) => s.boot);
  const title = useStudio((s) => s.title);
  const path = useRouterState({ select: (s) => clean(s.location.pathname) });
  const railRef = useRef<HTMLElement>(null);
  const storageNotice = useStudio((s) => s.storageNotice);
  const storageLocked = useStudio((s) => s.storageLocked);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    finishPlayback();
  }, [path]);

  // On mobile the rail scrolls horizontally; keep the current step visible.
  useEffect(() => {
    const active = railRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [path]);

  const index = FLOW.findIndex((item) => item.to === path);
  const prev = index > 0 ? FLOW[index - 1] : null;
  const next = index >= 0 && index < FLOW.length - 1 ? FLOW[index + 1] : null;

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="topbar">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <img src="/brand/app-icon.png" alt="" className="brand-mark" />
          <span className="min-w-0">
            <img src="/brand/wordmark.png" alt="BEHIX" className="brand-word" />
            <span className="mt-1 block truncate text-sm text-muted">{title}</span>
          </span>
        </Link>
      </header>
      <StorageBar notice={storageNotice} locked={storageLocked} />
      <div className="layout">
        <nav ref={railRef} className="rail" aria-label="خط تولید">
          <Link to="/" className="step-link" aria-current={path === "/" ? "page" : undefined}>
            <span className="step-no">00</span>
            پروژه
          </Link>
          {PHASES.map((phase) => (
            <Link
              key={phase.to}
              to={phase.to}
              className="step-link"
              aria-current={path === phase.to ? "page" : undefined}
            >
              <span className="step-no">{phase.no}</span>
              {phase.label}
            </Link>
          ))}
        </nav>
        <main className="work">
          {children}
          <div className="pager">
            {prev ? (
              <Link to={prev.to} className="btn btn-ghost">
                {prev.label}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link to={next.to} className="btn btn-primary">
                بعدی · {next.label}
              </Link>
            ) : (
              <span />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/**
 * T02: نوار هشدار ذخیره‌سازی (storageNotice/storageLocked از T07).
 * در حالت قفل دکمهٔ بستن ندارد؛ پیام غیرقفل فقط برای همین نشست و همین متن بسته می‌شود.
 */
// Shell در هر route دوباره mount می‌شود؛ بستن پیام در حافظهٔ ماژول (فقط همین نشست) نگه داشته می‌شود.
let dismissedNotice: string | null = null;

function StorageBar({ notice, locked }: { notice: string; locked: boolean }) {
  const [dismissed, setDismissedState] = useState<string | null>(dismissedNotice);
  const setDismissed = (v: string) => {
    dismissedNotice = v;
    setDismissedState(v);
  };
  if (!locked && (!notice || dismissed === notice)) return null;
  if (locked) {
    return (
      <div role="alert" className="storage-bar storage-bar-locked" data-testid="storage-bar">
        <p className="font-bold">⚠ تغییرات ذخیره نمی‌شود</p>
        <p className="mt-1 text-sm leading-6">
          {notice || "ذخیرهٔ خودکار برای محافظت از پروژهٔ شما متوقف شده است."} تا وقتی این پیام هست، هر تغییری با بستن
          صفحه از بین می‌رود.
        </p>
      </div>
    );
  }
  return (
    <div role="status" className="storage-bar storage-bar-notice" data-testid="storage-bar">
      <p className="min-w-0 flex-1 text-sm leading-6">{notice}</p>
      <button type="button" className="btn btn-ghost" onClick={() => setDismissed(notice)}>
        متوجه شدم
      </button>
    </div>
  );
}

export function PhaseHead({
  no,
  en,
  title,
  lede,
}: {
  no: string;
  en: string;
  title: string;
  lede: string;
}) {
  return (
    <div className="mb-5">
      <p className="kicker">
        {no} · {en}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{lede}</p>
    </div>
  );
}
