import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
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

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    finishPlayback();
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
      <div className="layout">
        <nav className="rail" aria-label="خط تولید">
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
        <div className="work">
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
        </div>
      </div>
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
    <header className="mb-5">
      <p className="kicker">
        {no} · {en}
      </p>
      <h1 className="mt-1 text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{lede}</p>
    </header>
  );
}
