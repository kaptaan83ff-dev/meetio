import { type ReactNode } from 'react';
import { BadgeCheck, CalendarDays, CheckCircle2, Clock3, Fingerprint, KeyRound, LockKeyhole, MailCheck, RefreshCw, Sparkles, Video } from 'lucide-react';

type AuthVariant = 'signin' | 'signup' | 'forgot' | 'reset' | 'verify' | 'twofactor';

type Feature = {
  icon: ReactNode;
  label: string;
};

const variantContent: Record<
  AuthVariant,
  {
    eyebrow: string;
    headline: string;
    description: string;
    accent: string;
    features: Feature[];
  }
> = {
  signin: {
    eyebrow: 'AUTH MODULE / 02',
    headline: 'WELCOME\nBACK.',
    description: 'Continue your productive meetings where you left off.',
    accent: 'bg-electric-pink text-ink-black',
    features: [
      { icon: <Video className="h-3.5 w-3.5" />, label: 'Instant meeting access' },
      { icon: <CalendarDays className="h-3.5 w-3.5" />, label: 'Sync across devices' },
      { icon: <BadgeCheck className="h-3.5 w-3.5" />, label: 'Workspace ready' },
      { icon: <Sparkles className="h-3.5 w-3.5" />, label: 'Smart follow-up flow' },
    ],
  },
  signup: {
    eyebrow: 'AUTH MODULE / 01',
    headline: 'CREATE\nYOUR SPACE.',
    description: 'Join MeetIO and keep every meeting note, action item, and follow-up in one place.',
    accent: 'bg-neon-lime text-ink-black',
    features: [
      { icon: <Video className="h-3.5 w-3.5" />, label: 'Live collaboration' },
      { icon: <CalendarDays className="h-3.5 w-3.5" />, label: 'Meeting continuity' },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Verified identity' },
      { icon: <Sparkles className="h-3.5 w-3.5" />, label: 'Actionable summaries' },
    ],
  },
  forgot: {
    eyebrow: 'AUTH MODULE / 03',
    headline: 'RECOVER\nACCESS.',
    description: 'Reset your password securely with a time-limited email link.',
    accent: 'bg-royal-blue text-white',
    features: [
      { icon: <KeyRound className="h-3.5 w-3.5" />, label: 'One-time reset token' },
      { icon: <Clock3 className="h-3.5 w-3.5" />, label: 'Short expiry window' },
      { icon: <LockKeyhole className="h-3.5 w-3.5" />, label: 'No password hints' },
      { icon: <BadgeCheck className="h-3.5 w-3.5" />, label: 'Protected account flow' },
    ],
  },
  reset: {
    eyebrow: 'AUTH MODULE / 04',
    headline: 'SET A\nNEW PASSWORD.',
    description: 'Choose a strong password and clear old sessions in one move.',
    accent: 'bg-sun-yellow text-ink-black',
    features: [
      { icon: <KeyRound className="h-3.5 w-3.5" />, label: 'Token-based reset' },
      { icon: <LockKeyhole className="h-3.5 w-3.5" />, label: 'Session invalidation' },
      { icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Password policy checks' },
      { icon: <Sparkles className="h-3.5 w-3.5" />, label: 'Fresh sign-in ready' },
    ],
  },
  verify: {
    eyebrow: 'AUTH MODULE / 04',
    headline: 'VERIFY\nYOUR EMAIL.',
    description: 'Confirm your identity with the secure one-time link delivered to your inbox.',
    accent: 'bg-neon-lime text-ink-black',
    features: [
      { icon: <MailCheck className="h-3.5 w-3.5" />, label: 'Check your email inbox' },
      { icon: <Clock3 className="h-3.5 w-3.5" />, label: 'Time-limited verification link' },
      { icon: <RefreshCw className="h-3.5 w-3.5" />, label: 'Request a fresh link if needed' },
      { icon: <Fingerprint className="h-3.5 w-3.5" />, label: 'One-time use token' },
    ],
  },
  twofactor: {
    eyebrow: 'AUTH MODULE / 05',
    headline: 'VERIFY\nIDENTITY.',
    description: 'Use your authenticator app to complete the sign-in challenge.',
    accent: 'bg-neon-lime text-ink-black',
    features: [
      { icon: <Fingerprint className="h-3.5 w-3.5" />, label: '6-digit TOTP code' },
      { icon: <Clock3 className="h-3.5 w-3.5" />, label: 'Limited attempts' },
      { icon: <LockKeyhole className="h-3.5 w-3.5" />, label: 'Challenge session only' },
      { icon: <BadgeCheck className="h-3.5 w-3.5" />, label: 'Dashboard protected' },
    ],
  },
};

function MiniFeature({ icon, label }: Feature) {
  return (
    <div className="flex items-start gap-3 border border-white/15 bg-white/5 px-4 py-3 text-sm text-white/75">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center border border-white/20 bg-white/10 text-white">
        {icon}
      </span>
      <span className="leading-5">{label}</span>
    </div>
  );
}

export function AuthBrandPanel({ variant }: { variant: AuthVariant }) {
  const content = variantContent[variant];

  return (
    <aside className="relative hidden min-h-[100dvh] flex-[0_0_45%] overflow-hidden border-r-3 border-ink-black bg-ink-black lg:block">
      <div className="absolute inset-0 grid grid-cols-4 grid-rows-5">
        {Array.from({ length: 20 }).map((_, index) => {
          const palette = [
            'bg-sun-yellow',
            'bg-electric-pink',
            'bg-neon-lime',
            'bg-royal-blue',
            'bg-[#ff6b35]',
            'bg-[#1a1a1a]',
            'bg-[#7c3aed]',
            'bg-[#00d4aa]',
            'bg-electric-pink/70',
            'bg-sun-yellow/45',
            'bg-neon-lime/55',
            'bg-royal-blue/35',
            'bg-[#1a1a1a]',
            'bg-sun-yellow/70',
            'bg-electric-pink/35',
            'bg-neon-lime/75',
            'bg-royal-blue/60',
            'bg-[#1a1a1a]',
            'bg-[#7c3aed]/50',
            'bg-[#00d4aa]/40',
          ][index];

          return (
            <div
              key={`auth-block-${variant}-${index}`}
              className={[
                'relative border border-white/10 transition-transform duration-200 ease-out hover:z-10 hover:scale-105 hover:shadow-[0_0_0_3px_#ffe500]',
                palette,
                index % 3 === 0 || index % 5 === 0 ? 'animate-pulse' : '',
              ].join(' ')}
            />
          );
        })}
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(10,10,10,0.55),rgba(10,10,10,0.1)_50%,rgba(10,10,10,0.55))]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,229,0,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(255,79,139,0.14),transparent_32%)]" />

      <div className="relative z-10 flex h-full flex-col justify-between p-8 text-ghost-white xl:p-10">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center border-2 border-white/20 bg-white/10 text-sun-yellow">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-display text-[10px] font-black uppercase tracking-[0.35em] text-white/70">MeetIO</p>
            <p className="font-display text-sm font-black uppercase tracking-[0.2em] text-white">Access Layer</p>
          </div>
        </div>

        <div className="max-w-[28rem] space-y-5">
          <span className={['inline-flex border border-ink-black px-3 py-2 font-display text-[10px] font-black uppercase tracking-[0.24em]', content.accent].join(' ')}>
            {content.eyebrow}
          </span>
          <h2 className="font-display text-[3rem] leading-[0.92] tracking-[-0.06em] text-white sm:text-[3.45rem]">
            {content.headline.split('\n').map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
          <p className="max-w-xl text-sm leading-7 text-white/70">{content.description}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {content.features.map((feature) => (
            <MiniFeature key={feature.label} {...feature} />
          ))}
        </div>
      </div>
    </aside>
  );
}
