import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';

import { ApiError } from '@/lib/apiClient';
import { verify2FA } from '@/lib/authApi';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { AuthShell } from '@/components/auth/AuthShell';

type TwoFactorLocationState = {
  totp_session_id?: string;
  email?: string;
  toast?: { tone: 'success' | 'info' | 'warning' | 'error' | 'action'; title: string; message: string };
};

const CODE_LENGTH = 6;
const LOCK_REDIRECT_DELAY_MS = 3000;

function LoadingSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
}

export default function TwoFactorPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const fetchCurrentUser = useAuthStore((state) => state.fetchCurrentUser);

  const state = (location.state as TwoFactorLocationState | null) ?? null;
  const totpSessionId = state?.totp_session_id?.trim() || '';
  const email = state?.email?.trim() || '';

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const hasAutoSubmitted = useRef(false);
  const lockRedirectTimer = useRef<number | null>(null);

  const digits = useMemo(() => code.replace(/\D/g, '').slice(0, CODE_LENGTH), [code]);
  const cells = useMemo(() => Array.from({ length: CODE_LENGTH }, (_, index) => digits[index] ?? ''), [digits]);

  const submitCode = useCallback(async (codeValue: string) => {
    if (!totpSessionId || codeValue.length !== CODE_LENGTH) {
      return;
    }

    setIsSubmitting(true);

    try {
      await verify2FA(totpSessionId, codeValue);
      await fetchCurrentUser();
      navigate('/dashboard', { replace: true });
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        if (caughtError.status === 400 && caughtError.code === 'INVALID_OTP') {
          setCode('');
          setAttemptsRemaining((value) => Math.max(0, value - 1));
          showToast({
            tone: 'error',
            title: 'Invalid Code',
            message: 'Incorrect code. Try again.',
          });
          return;
        }

        if (caughtError.status === 429 && caughtError.code === 'OTP_LOCKED') {
          showToast({
            tone: 'error',
            title: 'Session Locked',
            message: 'Too many attempts. Please sign in again.',
          });
          lockRedirectTimer.current = window.setTimeout(() => {
            navigate('/signin', {
              replace: true,
              state: {
                toast: {
                  tone: 'error',
                  title: 'Session Locked',
                  message: 'Too many attempts. Please sign in again.',
                },
              },
            });
          }, LOCK_REDIRECT_DELAY_MS);
          return;
        }

        if (caughtError.status === 404 && caughtError.code === 'NOT_FOUND') {
          navigate('/signin', {
            replace: true,
            state: {
              toast: {
                tone: 'error',
                title: 'Session Expired',
                message: 'Session expired, please sign in again.',
              },
            },
          });
          return;
        }
      }

      showToast({
        tone: 'error',
        title: 'Verification Failed',
        message: 'We could not verify that code right now.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [fetchCurrentUser, navigate, totpSessionId]);

  useEffect(() => {
    if (state?.toast) {
      showToast(state.toast);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [state?.toast]);

  useEffect(() => {
    if (!totpSessionId) {
      navigate('/signin', {
        replace: true,
        state: {
          toast: {
            tone: 'error',
            title: 'Session Expired',
            message: 'Session expired, please sign in again.',
          },
        },
      });
    }
  }, [navigate, totpSessionId]);

  useEffect(() => {
    if (digits.length < CODE_LENGTH) {
      hasAutoSubmitted.current = false;
      return;
    }

    if (hasAutoSubmitted.current || !totpSessionId) {
      return;
    }

    hasAutoSubmitted.current = true;
    void submitCode(digits);
  }, [digits, submitCode, totpSessionId]);

  useEffect(() => {
    return () => {
      if (lockRedirectTimer.current !== null) {
        window.clearTimeout(lockRedirectTimer.current);
      }
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitCode(digits);
  };

  const handleChange = (value: string) => {
    const nextValue = value.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(nextValue);
  };

  if (!totpSessionId) {
    return null;
  }

  return (
    <AuthShell
      title="Two-Factor Authentication"
      subtitle="Enter the six-digit code from your authenticator app to finish signing in."
      chromeTitle="Auth Module • 2FA Verify"
      divisionLabel="Division • Auth / 05"
      variant="twofactor"
      chromeTone="lime"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="border-[3px] border-ink-black bg-[#fff8dc] px-4 py-3 text-xs leading-6 text-ink-black/75">
          <div className="flex items-start gap-3">
            <div className="grid h-8 w-8 shrink-0 place-items-center border-2 border-ink-black bg-sun-yellow">
              <ShieldCheck className="h-4 w-4 text-ink-black" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-[11px] font-black uppercase tracking-[0.12em] text-ink-black">
                Verify your sign-in
              </p>
              <p className="mt-1">Enter the 6-digit code from your authenticator app{email ? ` for ${email}` : ''}.</p>
            </div>
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block font-display text-[11px] font-black uppercase tracking-[0.16em] text-ink-black">
            Authentication Code
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            value={code}
            onChange={(event) => handleChange(event.target.value)}
            className={[
              'w-full border-2 border-ink-black bg-ghost-white px-4 py-3 text-center text-2xl font-black tracking-[0.3em] text-ink-black outline-none transition-all duration-150',
              'focus:-translate-x-0.5 focus:-translate-y-0.5 focus:bg-sun-yellow focus:shadow-hard',
            ].join(' ')}
            aria-label="Authentication code"
          />
        </label>

        <div className="grid grid-cols-6 gap-2 sm:gap-3" aria-hidden="true">
          {cells.map((digit, index) => (
            <div
              key={`totp-digit-${index}`}
              className={[
                'grid h-14 place-items-center border-2 border-ink-black bg-ghost-white text-2xl font-black text-ink-black transition-all duration-150 sm:h-16',
                digit ? 'bg-sun-yellow shadow-hard' : '',
              ].join(' ')}
            >
              {digit}
            </div>
          ))}
        </div>

        {attemptsRemaining <= 2 ? (
          <div className="border border-ink-black bg-[#fff8dc] px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-black/70">
            {attemptsRemaining} attempts remaining
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || digits.length !== CODE_LENGTH}
          className="flex w-full items-center justify-center gap-2 border-2 border-ink-black bg-sun-yellow px-5 py-4 font-display text-[12px] font-black uppercase tracking-[0.1em] text-ink-black shadow-hard transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0px_0px_#0a0a0a] disabled:cursor-not-allowed disabled:bg-cream-canvas disabled:text-ink-black/45 disabled:shadow-none"
        >
          {isSubmitting ? <LoadingSpinner /> : null}
          {isSubmitting ? 'Verifying...' : 'Verify Code'}
        </button>

        <p className="text-center text-sm text-ink-black/60">
          Didn't receive a code? Sign in again to request a fresh challenge.
        </p>
      </form>
    </AuthShell>
  );
}
