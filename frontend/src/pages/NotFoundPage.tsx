import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate, useRouteError } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Gauge,
  Home,
  LifeBuoy,
  Loader2,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  Terminal,
  TriangleAlert,
  Video,
  type LucideIcon,
} from 'lucide-react';

import { useAuthStore } from '@/stores/authStore';

type NotFoundPageProps = {
  routeError?: boolean;
};

type DiagnosticRow = {
  label: string;
  value: string;
  accent?: 'error' | 'success';
};

function RouteLoading() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-cream-canvas bg-dot-grid text-ink-black">
      <div className="border-[3px] border-ink-black bg-ghost-white px-8 py-6 text-center shadow-hard">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-hidden="true" />
        <p className="mt-3 font-display text-sm uppercase tracking-[0.2em]">Checking Session</p>
      </div>
    </div>
  );
}

function getRouteErrorStatus(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error) {
    return String((error as { status?: number }).status || 404);
  }

  return '404';
}

function DiagnosticPanel({ rows }: { rows: DiagnosticRow[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="relative overflow-hidden border-[3px] border-ink-black bg-ghost-white p-5 shadow-hard sm:p-7">
      <span className="absolute inset-y-0 left-0 w-1.5 bg-electric-pink" aria-hidden="true" />
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-4 border-b border-ink-black pb-4 text-left"
        aria-expanded={isOpen}
      >
        <span className="inline-flex items-center gap-3 font-mono text-xs font-black uppercase tracking-[0.12em] text-ink-black">
          <Terminal className="h-4 w-4 text-electric-pink" aria-hidden="true" />
          Error Diagnostics
        </span>
        <ChevronDown className={['h-4 w-4 text-ink-black/55 transition-transform', isOpen ? 'rotate-180' : ''].join(' ')} />
      </button>

      {isOpen ? (
        <div className="pt-4">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-col gap-1 border-b border-dashed border-ink-black/15 py-2 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
              <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-black/55">{row.label}</span>
              <span
                className={[
                  'max-w-full break-all font-mono text-xs font-black text-ink-black sm:max-w-[360px] sm:text-right',
                  row.accent === 'error' ? 'text-electric-pink' : '',
                  row.accent === 'success' ? 'text-neon-lime [text-shadow:1px_1px_0_#0a0a0a]' : '',
                ].join(' ')}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ActionLink({
  to,
  children,
  variant = 'primary',
}: {
  to: string;
  children: ReactNode;
  variant?: 'primary' | 'dark';
}) {
  return (
    <Link
      to={to}
      className={[
        'inline-flex min-h-14 flex-1 items-center justify-center gap-3 border-2 border-ink-black px-6 py-4 font-display text-xs font-black uppercase tracking-[0.08em] transition-all duration-200',
        'hover:-translate-x-1 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-royal-blue/35',
        variant === 'primary'
          ? 'bg-sun-yellow text-ink-black shadow-hard hover:shadow-hard-hover'
          : 'bg-ink-black text-sun-yellow shadow-hard-yellow hover:shadow-hard-yellow-hover',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}

function QuickLink({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 text-sm font-bold text-ink-black/60 transition-colors hover:text-ink-black focus:outline-none focus-visible:ring-4 focus-visible:ring-royal-blue/35"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

function FilledBugIcon() {
  return (
    <svg className="meetio-bug-icon" viewBox="0 0 512 512" role="img" aria-label="Bug icon">
      <path
        fill="currentColor"
        d="M352 0c-12.9 0-24.6 7.8-29.6 19.8l-21.7 52.1C287.9 66.9 274.2 64 260 64h-8c-14.2 0-27.9 2.9-40.7 7.9l-21.7-52.1C184.6 7.8 172.9 0 160 0c-17.7 0-32 14.3-32 32c0 4.2.8 8.3 2.4 12.2l21 50.4C119.9 117.4 96 154.8 96 200v24H80c-26.5 0-48-21.5-48-48c0-17.7-14.3-32-32-32v64c0 35.3 28.7 64 64 64h32v32H64c-35.3 0-64 28.7-64 64v64c17.7 0 32-14.3 32-32c0-26.5 21.5-48 48-48h16v8c0 13.6 2.8 26.5 7.8 38.3C80.7 410.7 64 435.3 64 464v16c0 17.7 14.3 32 32 32s32-14.3 32-32v-16c0-10.1 4.7-19.1 12-24.9c21.1 22.9 51.3 36.9 84 36.9h64c32.7 0 62.9-14 84-36.9c7.3 5.8 12 14.8 12 24.9v16c0 17.7 14.3 32 32 32s32-14.3 32-32v-16c0-28.7-16.7-53.3-39.8-65.7c5-11.8 7.8-24.7 7.8-38.3v-8h16c26.5 0 48 21.5 48 48c0 17.7 14.3 32 32 32v-64c0-35.3-28.7-64-64-64h-32v-32h32c35.3 0 64-28.7 64-64v-64c-17.7 0-32 14.3-32 32c0 26.5-21.5 48-48 48h-16v-24c0-45.2-23.9-82.6-55.4-105.4l21-50.4c1.6-3.9 2.4-8 2.4-12.2c0-17.7-14.3-32-32-32zM192 312v-80c0-13.3 10.7-24 24-24s24 10.7 24 24v80c0 13.3-10.7 24-24 24s-24-10.7-24-24zm104-104c13.3 0 24 10.7 24 24v80c0 13.3-10.7 24-24 24s-24-10.7-24-24v-80c0-13.3 10.7-24 24-24z"
      />
    </svg>
  );
}

export default function NotFoundPage({ routeError = false }: NotFoundPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const error = useRouteError();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const initAuth = useAuthStore((state) => state.initAuth);
  const [isGoingBack, setIsGoingBack] = useState(false);

  const statusCode = routeError ? getRouteErrorStatus(error) : '404';
  const timestamp = useMemo(() => new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC', []);
  const requestedPath = `${location.pathname}${location.search}`;

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  if (isLoading) {
    return <RouteLoading />;
  }

  const isAuthView = isAuthenticated;
  const diagnostics: DiagnosticRow[] = [
    { label: 'Error Code', value: `HTTP ${statusCode} ${statusCode === '404' ? 'Not Found' : 'Route Error'}` },
    { label: 'Request Method', value: 'GET' },
    { label: 'Timestamp', value: timestamp },
    { label: 'Requested Path', value: requestedPath || '/', accent: 'error' },
    { label: 'Resource Type', value: isAuthView ? 'Workspace Route' : 'Page / Route' },
  ];

  if (isAuthView) {
    diagnostics.push({ label: 'Session Status', value: 'Active', accent: 'success' });
  }

  const handleGoBack = () => {
    setIsGoingBack(true);
    window.setTimeout(() => {
      if (window.history.length > 1) {
        navigate(-1);
        return;
      }
      navigate(isAuthView ? '/dashboard' : '/', { replace: true });
    }, 250);
  };

  return (
    <main className="meetio-404-page bg-dot-grid">
      <div className="meetio-scanlines" aria-hidden="true" />
      <div className="meetio-scanline-moving" aria-hidden="true" />

      <div className="meetio-404-container">
        <div className="meetio-404-grid">
          <section className="meetio-illustration-section">
            <div className="meetio-illustration-box">
              <FilledBugIcon />
              <span className="meetio-illustration-badge meetio-illustration-badge-top">
                ERR_NOT_FOUND
              </span>
              <span className="meetio-illustration-badge meetio-illustration-badge-bottom">
                0x{statusCode}
              </span>
            </div>
          </section>

          <section className="meetio-404-content">
            <div
              className="meetio-error-code-large meetio-glitch-text"
              data-text={statusCode}
              aria-label={`${statusCode} error`}
            >
              {statusCode}
            </div>

            <div className="meetio-status-badge">
              <span className="meetio-status-dot" aria-hidden="true" />
              <span>System Failure • Path Not Found</span>
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            </div>

            <h1 className="mb-4 font-display text-[clamp(1.75rem,4vw,2.75rem)] uppercase leading-[1.05] tracking-[-0.04em] text-ink-black">
              {isAuthView ? "Workspace Route Doesn't Exist." : "Oops! You've Hit a Dead End."}
            </h1>
            <p className="mb-8 max-w-2xl text-base leading-7 text-ink-black/65">
              {isAuthView
                ? 'Looks like you navigated to a route that does not exist in your workspace. Your session is still active and your data is safe.'
                : "The page you're looking for doesn't exist, has moved, or is not available yet. Use the actions below to get back on track."}
            </p>

            <div className="meetio-action-buttons-row">
              {isAuthView ? (
                <>
                  <ActionLink to="/dashboard">
                    <Gauge className="h-4 w-4" aria-hidden="true" />
                    Go to Dashboard
                  </ActionLink>
                  <button
                    type="button"
                    onClick={handleGoBack}
                    disabled={isGoingBack}
                    className="inline-flex min-h-14 flex-1 items-center justify-center gap-3 border-2 border-ink-black bg-ink-black px-6 py-4 font-display text-xs font-black uppercase tracking-[0.08em] text-sun-yellow shadow-hard-yellow transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-yellow-hover focus:outline-none focus-visible:ring-4 focus-visible:ring-royal-blue/35 disabled:cursor-wait disabled:opacity-70"
                  >
                    {isGoingBack ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowLeft className="h-4 w-4" aria-hidden="true" />}
                    {isGoingBack ? 'Going Back' : 'Go Back'}
                  </button>
                </>
              ) : (
                <>
                  <ActionLink to="/">
                    <Home className="h-4 w-4" aria-hidden="true" />
                    Go to Homepage
                  </ActionLink>
                  <ActionLink to="/signup" variant="dark">
                    <Rocket className="h-4 w-4" aria-hidden="true" />
                    Start Free Trial
                  </ActionLink>
                </>
              )}
            </div>
          </section>
        </div>

        <div className="mt-10">
          <DiagnosticPanel rows={diagnostics} />
        </div>

        <nav className="mt-8 flex flex-col items-center justify-center gap-4 border-t border-ink-black/25 pt-7 sm:flex-row sm:gap-10" aria-label="Helpful links">
          {isAuthView ? (
            <>
              <QuickLink to="/meeting/demo/lobby" icon={Video} label="My Meetings" />
              <QuickLink to="/calendar" icon={CalendarDays} label="Calendar" />
              <QuickLink to="/settings" icon={Settings} label="Settings" />
            </>
          ) : (
            <>
              <QuickLink to="/signin" icon={Search} label="Sign In" />
              <QuickLink to="/verify" icon={ShieldCheck} label="Verify Email" />
              <QuickLink to="/forgot-password" icon={LifeBuoy} label="Recover Account" />
            </>
          )}
        </nav>
      </div>
    </main>
  );
}
