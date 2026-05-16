import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';

import { ApiError } from '@/lib/apiClient';
import { forgotPassword } from '@/lib/authApi';
import { showToast } from '@/lib/toast';
import { AuthShell } from '@/components/auth/AuthShell';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoadingSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
}

export default function ForgotPasswordPage() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const state = location.state as { toast?: { tone: 'success' | 'info' | 'warning' | 'error' | 'action'; title: string; message: string } } | null;
    if (state?.toast) {
      showToast(state.toast);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location.state]);

  useEffect(() => {
    const toastType = searchParams.get('toast');
    if (toastType === 'reset-link-invalid') {
      showToast({
        tone: 'error',
        title: 'Reset Link Invalid',
        message: 'This reset link is invalid or expired.',
      });
    }
  }, [searchParams]);

  const emailValue = email.trim();
  const emailError = emailTouched && !EMAIL_REGEX.test(emailValue);
  const isConfirmed = confirmedEmail.length > 0;

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [resendCooldown]);

  const canSubmit = useMemo(() => EMAIL_REGEX.test(emailValue) && !isSubmitting, [emailValue, isSubmitting]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailTouched(true);

    if (!EMAIL_REGEX.test(emailValue)) {
      showToast({
        tone: 'warning',
        title: 'Email Invalid',
        message: 'Enter a valid email address.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPassword(emailValue);
    } catch (error) {
      if (error instanceof ApiError && error.code !== 'VALIDATION_ERROR') {
        showToast({
          tone: 'error',
          title: 'Reset Failed',
          message: 'We could not process that request right now.',
        });
      }
    } finally {
      setConfirmedEmail(emailValue);
      setResendCooldown(60);
      showToast({
        tone: 'success',
        title: 'Reset Link Sent',
        message: 'If that email is registered, a reset link has been sent.',
      });
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !confirmedEmail) {
      return;
    }

    setIsSubmitting(true);
    try {
      await forgotPassword(confirmedEmail);
    } finally {
      setResendCooldown(60);
      showToast({
        tone: 'info',
        title: 'Reset Link Updated',
        message: 'If that email is registered, a fresh reset link has been sent.',
      });
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Forgot Password"
      subtitle="No problem. Enter your email and we will send a reset link if that account exists."
      chromeTitle="Auth Module • Reset Password"
      divisionLabel="Division • Auth / 03"
      variant="forgot"
      chromeTone="blue"
    >
      {!isConfirmed ? (
        <form onSubmit={handleSubmit} className="space-y-5">
          <label className="block">
            <span className="mb-2 block font-display text-[11px] font-black uppercase tracking-[0.16em] text-ink-black">
              Email Address
            </span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-black/45" />
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailTouched(true);
                }}
                onBlur={() => setEmailTouched(true)}
                placeholder="Enter your registered email"
                className={[
                  'w-full border-2 border-ink-black bg-ghost-white py-3.5 pl-11 pr-4 text-[15px] text-ink-black outline-none transition-all duration-150',
                  'focus:-translate-x-0.5 focus:-translate-y-0.5 focus:bg-sun-yellow focus:shadow-hard',
                  'dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-800',
                  emailError ? 'border-electric-pink bg-[#fff5f7]' : '',
                ].join(' ')}
                aria-invalid={emailError}
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 border-2 border-ink-black bg-sun-yellow px-5 py-4 font-display text-[12px] font-black uppercase tracking-[0.1em] text-ink-black shadow-hard transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0px_0px_#0a0a0a] disabled:cursor-not-allowed disabled:bg-cream-canvas disabled:text-ink-black/45 disabled:shadow-none"
          >
            {isSubmitting ? <LoadingSpinner /> : null}
            {isSubmitting ? 'Sending Reset Link...' : 'Send Reset Link'}
          </button>

          <p className="text-center text-sm text-ink-black/60">
            Remembered your password?{' '}
            <Link
              className="border-b-2 border-sun-yellow font-semibold text-ink-black transition-colors hover:bg-sun-yellow"
              to="/signin"
            >
              Back to Sign In
            </Link>
          </p>
        </form>
      ) : (
        <div className="space-y-5">
          <div className="border-[3px] border-ink-black bg-ghost-white shadow-hard">
            <div className="flex items-center gap-3 border-b-2 border-ink-black bg-neon-lime px-4 py-3">
              <span className="grid h-5 w-5 place-items-center">
                <span className="h-3 w-3 rounded-full border-2 border-ink-black bg-ghost-white" />
              </span>
              <p className="font-display text-[11px] font-black uppercase tracking-[0.16em] text-ink-black">Email Sent</p>
            </div>
            <div className="space-y-4 px-5 py-6 text-sm text-ink-black/70">
              <p className="text-base font-medium text-ink-black">
                If that email is registered, a reset link has been sent to{' '}
                <span className="font-black text-ink-black">{confirmedEmail}</span>.
              </p>
              <p>Check your inbox and spam folder. The link will expire after a short period.</p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendCooldown > 0 || isSubmitting}
                  className="inline-flex items-center justify-center gap-2 border-2 border-ink-black bg-ghost-white px-4 py-3 font-display text-[11px] font-black uppercase tracking-[0.12em] text-ink-black transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard disabled:cursor-not-allowed disabled:bg-cream-canvas disabled:text-ink-black/45 disabled:shadow-none"
                >
                  {isSubmitting ? <LoadingSpinner /> : null}
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Send Again'}
                </button>
                <Link
                  to="/signin"
                  className="inline-flex items-center justify-center gap-2 border-2 border-ink-black bg-sun-yellow px-4 py-3 font-display text-[11px] font-black uppercase tracking-[0.12em] text-ink-black transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>

          <div className="border border-ink-black bg-[#fff8dc] px-4 py-3 text-xs leading-6 text-ink-black/70">
            If you do not receive the email within a few minutes, wait for the cooldown to expire and try again.
          </div>
        </div>
      )}
    </AuthShell>
  );
}
