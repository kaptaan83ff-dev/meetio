import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, Link2, ShieldAlert, X } from 'lucide-react';

export type AuthToastTone = 'success' | 'info' | 'warning' | 'error' | 'action';
export type AuthToastAction = {
  label: string;
  onClick: () => void;
};

export type AuthToastState = {
  title: string;
  message: string;
  tone: AuthToastTone;
  action?: AuthToastAction;
};

type AuthToastProps = AuthToastState & {
  durationMs?: number;
  onDismiss: () => void;
};

function getToneClasses(tone: AuthToastTone) {
  switch (tone) {
    case 'success':
      return 'bg-neon-lime text-ink-black';
    case 'action':
      return 'bg-neon-lime text-ink-black';
    case 'warning':
      return 'bg-sun-yellow text-ink-black';
    case 'info':
      return 'bg-royal-blue text-white';
    case 'error':
    default:
      return 'bg-electric-pink text-ink-black';
  }
}

function getToneIcon(tone: AuthToastTone) {
  switch (tone) {
    case 'success':
      return <CheckCircle2 className="h-4 w-4" aria-hidden="true" />;
    case 'action':
      return <Link2 className="h-4 w-4" aria-hidden="true" />;
    case 'warning':
      return <ShieldAlert className="h-4 w-4" aria-hidden="true" />;
    case 'info':
      return <Clock3 className="h-4 w-4" aria-hidden="true" />;
    case 'error':
    default:
      return <AlertCircle className="h-4 w-4" aria-hidden="true" />;
  }
}

export function AuthToast({ title, message, tone, action, durationMs = 5000, onDismiss }: AuthToastProps) {
  const [closing, setClosing] = useState(false);
  const dismissedRef = useRef(false);

  const requestDismiss = useCallback(() => {
    if (dismissedRef.current) {
      return;
    }

    dismissedRef.current = true;
    setClosing(true);
    window.setTimeout(onDismiss, 250);
  }, [onDismiss]);

  useEffect(() => {
    if (durationMs <= 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      requestDismiss();
    }, durationMs);

    return () => window.clearTimeout(timeout);
  }, [durationMs, requestDismiss]);

  const progressClass = tone === 'info' ? 'bg-white/30' : 'bg-ink-black/25';
  const iconToneClass =
    tone === 'success' || tone === 'action'
      ? 'text-neon-lime'
      : tone === 'warning'
        ? 'text-sun-yellow'
        : tone === 'info'
          ? 'text-white'
          : 'text-electric-pink';
  const actionClass =
    tone === 'info'
      ? 'bg-ghost-white text-ink-black hover:bg-sun-yellow'
      : 'bg-ink-black text-white hover:bg-ghost-white hover:text-ink-black';

  return (
    <div
      className={[
        'auth-toast pointer-events-auto relative overflow-hidden border-[3px] border-ink-black shadow-hard',
        getToneClasses(tone),
        closing ? 'auth-toast-exit' : 'auth-toast-enter',
      ].join(' ')}
    >
      <div className="flex items-start gap-3 px-4 py-4">
        <div className={['grid h-[30px] w-[30px] shrink-0 place-items-center border-2 border-ink-black bg-ink-black', iconToneClass].join(' ')}>
          {getToneIcon(tone)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[11px] font-black uppercase tracking-[0.12em]">{title}</p>
          <p className={['mt-1 text-[13px] leading-5', tone === 'info' ? 'text-white/90' : 'text-ink-black/75'].join(' ')}>
            {message}
          </p>
          {action ? (
            <button
              type="button"
              onClick={() => {
                action.onClick();
                requestDismiss();
              }}
              className={['mt-3 border-2 border-ink-black px-3 py-1.5 font-display text-[10px] font-black uppercase tracking-[0.1em] transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[2px_2px_0_0_#000]', actionClass].join(' ')}
            >
              {action.label}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={requestDismiss}
          className="grid h-[26px] w-[26px] shrink-0 place-items-center border border-ink-black bg-ink-black text-white transition-colors hover:bg-ghost-white hover:text-ink-black"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {durationMs > 0 ? (
        <div
          className={['auth-toast-progress absolute bottom-0 left-0 h-[3px]', progressClass].join(' ')}
          style={{ animationDuration: `${durationMs}ms` }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
