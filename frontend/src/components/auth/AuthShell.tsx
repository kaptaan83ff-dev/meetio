import { useEffect, type ReactNode } from 'react';

import { AuthBrandPanel } from '@/components/auth/AuthBrandPanel';

type AuthShellProps = {
  title: string;
  subtitle: string;
  chromeTitle?: string;
  divisionLabel?: string;
  variant: 'signin' | 'signup' | 'forgot' | 'reset' | 'verify' | 'twofactor';
  chromeTone?: 'yellow' | 'pink' | 'lime' | 'blue';
  children: ReactNode;
};

export function AuthShell({
  title,
  subtitle,
  chromeTitle = 'Auth Module • Sign In',
  divisionLabel = 'Division • Auth / 02',
  variant,
  chromeTone = 'yellow',
  children,
}: AuthShellProps) {
  useEffect(() => {
    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
    };
  }, []);

  const chromeToneClasses =
    chromeTone === 'pink'
      ? 'bg-electric-pink text-white'
      : chromeTone === 'lime'
        ? 'bg-neon-lime text-ink-black'
        : chromeTone === 'blue'
          ? 'bg-royal-blue text-white'
          : 'bg-sun-yellow text-ink-black';

  return (
    <div className="h-[100dvh] overflow-hidden bg-cream-canvas text-ink-black">
      <div className="relative h-[100dvh] overflow-hidden bg-dot-grid">
        <div className="flex h-full flex-col lg:flex-row">
          <AuthBrandPanel variant={variant} />

          <main className="flex h-full min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
            <div className="flex h-full min-h-0 w-full max-w-[30rem] flex-col justify-center">
              <div className="overflow-hidden border-[3px] border-ink-black bg-ghost-white shadow-hard">
                <div className={['flex h-10 items-center gap-2 border-b-2 border-ink-black px-4', chromeToneClasses].join(' ')}>
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full border border-ink-black bg-electric-pink" />
                    <span className="h-3 w-3 rounded-full border border-ink-black bg-sun-yellow" />
                    <span className="h-3 w-3 rounded-full border border-ink-black bg-neon-lime" />
                  </div>
                  <div
                    className={[
                      'flex-1 text-center font-mono text-[11px] font-bold uppercase tracking-[0.18em]',
                      chromeTone === 'blue' || chromeTone === 'pink' ? 'text-white' : 'text-ink-black',
                    ].join(' ')}
                  >
                    {chromeTitle}
                  </div>
                  <div className="w-14" />
                </div>

                <div className="relative bg-ghost-white px-4 py-4 sm:px-6 sm:py-5 lg:px-7 lg:py-6">
                  <div className="relative z-10 mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-ink-black/55">
                    <span className="grid h-5 w-5 place-items-center">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-current" />
                    </span>
                    {divisionLabel}
                  </div>
                  <header className="relative z-10 mb-4 space-y-2 text-center">
                    <p className="font-display text-[11px] font-black uppercase tracking-[0.24em] text-ink-black/55">
                      MeetIO Access
                    </p>
                    <h1 className="font-display text-[1.9rem] uppercase tracking-[-0.04em] text-ink-black sm:text-[2.05rem]">
                      {title}
                    </h1>
                    <p className="mx-auto max-w-md text-sm leading-6 text-ink-black/60">{subtitle}</p>
                  </header>

                  <div className="overflow-hidden">{children}</div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
