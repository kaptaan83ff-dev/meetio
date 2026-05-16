import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  CheckSquare,
  FileText,
  Gauge,
  LockKeyhole,
  Play,
  Rocket,
  ShieldCheck,
  Sparkles,
  Video,
  Zap,
} from 'lucide-react';

import { useAuthStore } from '@/stores/authStore';

const featureCards = [
  {
    title: 'Live Meetings',
    description: 'Join fast, keep participants focused, and move from call to recap without losing context.',
    icon: Video,
    tone: 'bg-sun-yellow',
  },
  {
    title: 'AI Recaps',
    description: 'Turn raw conversations into decisions, summaries, follow-ups, and searchable memory.',
    icon: FileText,
    tone: 'bg-electric-pink',
  },
  {
    title: 'Action Items',
    description: 'Capture owners, due dates, and next steps while the conversation is still fresh.',
    icon: CheckSquare,
    tone: 'bg-neon-lime',
  },
  {
    title: 'Calendar Sync',
    description: 'Keep agendas, reminders, and meeting context attached to the schedule people already use.',
    icon: CalendarDays,
    tone: 'bg-royal-blue text-white',
  },
];

const trustItems = [
  'Verified email identity',
  'HttpOnly session cookies',
  '2FA-ready security flow',
  'Audit-friendly auth events',
];

function LandingBugMark() {
  return (
    <svg className="meetio-bug-icon" viewBox="0 0 512 512" role="img" aria-label="MeetIO signal bug">
      <path
        fill="currentColor"
        d="M352 0c-12.9 0-24.6 7.8-29.6 19.8l-21.7 52.1C287.9 66.9 274.2 64 260 64h-8c-14.2 0-27.9 2.9-40.7 7.9l-21.7-52.1C184.6 7.8 172.9 0 160 0c-17.7 0-32 14.3-32 32c0 4.2.8 8.3 2.4 12.2l21 50.4C119.9 117.4 96 154.8 96 200v24H80c-26.5 0-48-21.5-48-48c0-17.7-14.3-32-32-32v64c0 35.3 28.7 64 64 64h32v32H64c-35.3 0-64 28.7-64 64v64c17.7 0 32-14.3 32-32c0-26.5 21.5-48 48-48h16v8c0 13.6 2.8 26.5 7.8 38.3C80.7 410.7 64 435.3 64 464v16c0 17.7 14.3 32 32 32s32-14.3 32-32v-16c0-10.1 4.7-19.1 12-24.9c21.1 22.9 51.3 36.9 84 36.9h64c32.7 0 62.9-14 84-36.9c7.3 5.8 12 14.8 12 24.9v16c0 17.7 14.3 32 32 32s32-14.3 32-32v-16c0-28.7-16.7-53.3-39.8-65.7c5-11.8 7.8-24.7 7.8-38.3v-8h16c26.5 0 48 21.5 48 48c0 17.7 14.3 32 32 32v-64c0-35.3-28.7-64-64-64h-32v-32h32c35.3 0 64-28.7 64-64v-64c-17.7 0-32 14.3-32 32c0 26.5-21.5 48-48 48h-16v-24c0-45.2-23.9-82.6-55.4-105.4l21-50.4c1.6-3.9 2.4-8 2.4-12.2c0-17.7-14.3-32-32-32zM192 312v-80c0-13.3 10.7-24 24-24s24 10.7 24 24v80c0 13.3-10.7 24-24 24s-24-10.7-24-24zm104-104c13.3 0 24 10.7 24 24v80c0 13.3-10.7 24-24 24s-24-10.7-24-24v-80c0-13.3 10.7-24 24-24z"
      />
    </svg>
  );
}

function HeroAction({ to, children, variant = 'primary' }: { to: string; children: ReactNode; variant?: 'primary' | 'dark' }) {
  return (
    <Link
      to={to}
      className={[
        'inline-flex min-h-14 items-center justify-center gap-3 border-2 border-ink-black px-7 py-4 font-display text-xs font-black uppercase tracking-[0.1em] transition-all duration-200',
        'hover:-translate-x-1 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-royal-blue/35',
        variant === 'primary'
          ? 'bg-sun-yellow text-ink-black shadow-hard hover:shadow-[11px_11px_0_0_#0a0a0a]'
          : 'bg-ink-black text-sun-yellow shadow-hard-yellow hover:shadow-[11px_11px_0_0_#ffe500]',
      ].join(' ')}
    >
      {children}
    </Link>
  );
}

export default function LandingPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const initAuth = useAuthStore((state) => state.initAuth);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-cream-canvas bg-dot-grid text-ink-black">
      <div className="meetio-scanlines" aria-hidden="true" />
      <div className="meetio-scanline-moving" aria-hidden="true" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-10" aria-label="Landing navigation">
        <Link to="/" className="group inline-flex items-center gap-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-royal-blue/35">
          <span className="grid h-11 w-11 place-items-center border-2 border-ink-black bg-ink-black text-sun-yellow shadow-hard transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5">
            <Video className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="font-display text-2xl uppercase tracking-[-0.05em]">MeetIO</span>
        </Link>

        <div className="hidden items-center gap-6 font-display text-[11px] font-black uppercase tracking-[0.14em] text-ink-black/70 md:flex">
          <a href="#features" className="transition-colors hover:text-ink-black">Features</a>
          <a href="#security" className="transition-colors hover:text-ink-black">Security</a>
          <a href="#workflow" className="transition-colors hover:text-ink-black">Workflow</a>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <Link to="/dashboard" className="inline-flex items-center gap-2 border-2 border-ink-black bg-neon-lime px-4 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.1em] shadow-hard transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-hover">
              <Gauge className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/signin" className="hidden border-2 border-ink-black bg-ghost-white px-4 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.1em] shadow-hard transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-sun-yellow hover:shadow-hard-hover sm:inline-flex">
                Sign In
              </Link>
              <Link to="/signup" className="inline-flex border-2 border-ink-black bg-electric-pink px-4 py-2.5 font-display text-[11px] font-black uppercase tracking-[0.1em] text-ink-black shadow-hard transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-hover">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-10 lg:pb-24 lg:pt-16">
        <div>
          <div className="mb-6 inline-flex items-center gap-3 border-2 border-ink-black bg-ink-black px-4 py-3 font-mono text-[11px] font-black uppercase tracking-[0.12em] text-electric-pink shadow-[4px_4px_0_0_#ff4f8b]">
            <span className="meetio-status-dot" aria-hidden="true" />
            <span>Meeting Signal Online</span>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </div>

          <h1 className="max-w-5xl font-display text-[clamp(3.2rem,8.5vw,8rem)] uppercase leading-[0.88] tracking-[-0.08em] text-ink-black">
            AI Meeting <span className="meetio-glitch-text block text-electric-pink" data-text="OS">OS</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg font-semibold leading-8 text-ink-black/70">
            MeetIO turns calls into a durable operating system for decisions, transcripts, recaps, tasks, calendar context, and follow-up work.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <HeroAction to={isAuthenticated ? '/dashboard' : '/signup'}>
              <Rocket className="h-4 w-4" aria-hidden="true" />
              {isAuthenticated ? 'Open Dashboard' : 'Start Free'}
            </HeroAction>
            <HeroAction to="/signin" variant="dark">
              <Play className="h-4 w-4" aria-hidden="true" />
              Sign In
            </HeroAction>
          </div>
        </div>

        <aside className="relative mx-auto w-full max-w-[420px] lg:mx-0">
          <div className="meetio-illustration-box">
            <LandingBugMark />
            <span className="meetio-illustration-badge meetio-illustration-badge-top">AI_SIGNAL</span>
            <span className="meetio-illustration-badge meetio-illustration-badge-bottom">MEET_OS</span>
          </div>

          <div className="mt-8 border-[3px] border-ink-black bg-ghost-white p-5 shadow-hard">
            <div className="mb-4 flex items-center justify-between border-b-2 border-ink-black pb-3">
              <span className="font-display text-xs font-black uppercase tracking-[0.16em]">Live Workflow</span>
              <Zap className="h-5 w-5 text-electric-pink" aria-hidden="true" />
            </div>
            <div className="space-y-3 font-mono text-xs font-black uppercase tracking-[0.08em]">
              <div className="flex items-center justify-between border border-ink-black bg-sun-yellow px-3 py-2">
                <span>Transcript</span>
                <span>00:18</span>
              </div>
              <div className="flex items-center justify-between border border-ink-black bg-neon-lime px-3 py-2">
                <span>Recap</span>
                <span>Ready</span>
              </div>
              <div className="flex items-center justify-between border border-ink-black bg-electric-pink px-3 py-2">
                <span>Tasks</span>
                <span>4 Found</span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-10">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono text-xs font-black uppercase tracking-[0.18em] text-electric-pink">Feature Stack</p>
            <h2 className="mt-2 font-display text-4xl uppercase tracking-[-0.05em] sm:text-5xl">Everything after the call matters.</h2>
          </div>
          <p className="max-w-xl text-sm font-semibold leading-6 text-ink-black/65">A focused workspace for the work created by meetings, not another place where notes go to die.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className="border-[3px] border-ink-black bg-ghost-white p-5 shadow-hard transition-all duration-200 hover:-translate-x-1 hover:-translate-y-1 hover:shadow-hard-hover">
                <div className={['mb-5 grid h-12 w-12 place-items-center border-2 border-ink-black shadow-[3px_3px_0_0_#0a0a0a]', feature.tone].join(' ')}>
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-display text-lg uppercase tracking-[-0.03em]">{feature.title}</h3>
                <p className="mt-3 text-sm font-medium leading-6 text-ink-black/65">{feature.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="security" className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-10">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="border-[3px] border-ink-black bg-ink-black p-7 text-ghost-white shadow-[12px_12px_0_0_#ff4f8b]">
            <LockKeyhole className="mb-6 h-10 w-10 text-sun-yellow" aria-hidden="true" />
            <h2 className="font-display text-4xl uppercase leading-none tracking-[-0.05em] text-sun-yellow">Built on verified identity.</h2>
            <p className="mt-5 text-sm font-semibold leading-7 text-white/70">The current platform foundation already uses verified email, OAuth, cookie sessions, refresh rotation, 2FA flows, and backend hardening.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {trustItems.map((item) => (
              <div key={item} className="flex items-center gap-3 border-[3px] border-ink-black bg-ghost-white p-5 shadow-hard">
                <ShieldCheck className="h-5 w-5 shrink-0 text-ink-black" aria-hidden="true" />
                <span className="font-display text-sm font-black uppercase tracking-[0.08em]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-10">
        <div className="border-[3px] border-ink-black bg-ghost-white p-6 shadow-hard lg:p-8">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              ['01', 'Meet', 'Start the call and collect context while people talk.'],
              ['02', 'Extract', 'Generate transcript, recap, decisions, and task candidates.'],
              ['03', 'Follow Up', 'Route reminders, action items, calendar links, and records.'],
            ].map(([step, title, copy]) => (
              <div key={step} className="border-2 border-ink-black bg-cream-canvas p-5">
                <div className="meetio-glitch-text mb-4 font-display text-4xl leading-none text-electric-pink" data-text={step}>
                  {step}
                </div>
                <h3 className="font-display text-xl uppercase tracking-[-0.04em]">{title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-ink-black/65">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex max-w-7xl flex-col gap-4 border-t-[3px] border-ink-black px-4 py-8 text-sm font-bold text-ink-black/60 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
        <span>© MeetIO • AI Meeting OS</span>
        <div className="flex gap-5">
          <Link to="/verify" className="hover:text-ink-black">Verify Email</Link>
          <Link to="/forgot-password" className="hover:text-ink-black">Recover Account</Link>
        </div>
      </footer>
    </main>
  );
}
