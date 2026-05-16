import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react';

import { ApiError } from '@/lib/apiClient';
import { resetPassword } from '@/lib/authApi';
import { getPasswordPolicyError, getPasswordPolicyState } from '@/lib/passwordPolicy';
import { showToast } from '@/lib/toast';
import { AuthShell } from '@/components/auth/AuthShell';

function LoadingSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  const passwordPolicy = useMemo(() => getPasswordPolicyState(newPassword), [newPassword]);
  const passwordError = passwordTouched ? getPasswordPolicyError(newPassword) : '';
  const confirmError = confirmTouched && confirmPassword && confirmPassword !== newPassword ? 'Passwords do not match.' : '';

  useEffect(() => {
    const state = location.state as { toast?: { tone: 'success' | 'info' | 'warning' | 'error' | 'action'; title: string; message: string } } | null;
    if (state?.toast) {
      showToast(state.toast);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location.state]);

  useEffect(() => {
    if (token) {
      return;
    }

    setTokenMissing(true);
    navigate('/forgot-password?toast=reset-link-invalid', {
      replace: true,
      state: {
        toast: {
          tone: 'error',
          title: 'Reset Link Invalid',
          message: 'This reset link is invalid or expired.',
        },
      },
    });
  }, [navigate, token]);

  const canSubmit = !isSubmitting;

  const ruleClass = (met: boolean) =>
    `flex min-h-8 items-center gap-1.5 border border-ink-black px-2 py-1.5 text-[9px] font-black uppercase leading-none tracking-[0.06em] ${
      met ? 'bg-[#f4ffe0] text-ink-black' : 'bg-cream-canvas text-ink-black/50'
    }`;

  const ruleDotClass = (met: boolean) =>
    `grid h-3.5 w-3.5 place-items-center rounded-full border-2 ${
      met ? 'border-neon-lime bg-neon-lime text-ink-black' : 'border-current bg-transparent'
    }`;

  const runReset = async () => {
    setPasswordTouched(true);
    setConfirmTouched(true);

    if (!token) {
      showToast({
        tone: 'error',
        title: 'Reset Link Invalid',
        message: 'This reset link is invalid or expired.',
      });
      return;
    }

    if (!passwordPolicy.isStrong) {
      showToast({
        tone: 'warning',
        title: 'Password Invalid',
        message: getPasswordPolicyError(newPassword),
      });
      return;
    }

    if (confirmPassword !== newPassword) {
      showToast({
        tone: 'warning',
        title: 'Password Mismatch',
        message: 'Passwords do not match.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      setCompleted(true);
      showToast({
        tone: 'success',
        title: 'Password Updated',
        message: 'Your password has been reset successfully.',
      });
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 400) {
          showToast({
            tone: 'error',
            title: 'Reset Link Expired',
            message: 'This reset link has expired. Request a new one.',
          });
          return;
        }
        if (error.code === 'VALIDATION_ERROR') {
          showToast({
            tone: 'error',
            title: 'Reset Failed',
            message: error.message,
          });
          return;
        }
      }

      showToast({
        tone: 'error',
        title: 'Reset Failed',
        message: 'We could not reset your password right now.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runReset();
  };

  if (tokenMissing) {
    return null;
  }

  return (
    <AuthShell
      title="Reset Password"
      subtitle="Choose a new password to complete the reset. Your sessions will be cleared after success."
      chromeTitle="Auth Module • Reset Password"
      divisionLabel="Division • Auth / 04"
      variant="reset"
      chromeTone="pink"
    >
      {completed ? (
        <div className="space-y-5">
          <div className="border-[3px] border-ink-black bg-ghost-white shadow-hard">
            <div className="flex items-center gap-3 border-b-2 border-ink-black bg-neon-lime px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-ink-black" aria-hidden="true" />
              <p className="font-display text-[11px] font-black uppercase tracking-[0.16em] text-ink-black">
                Password Updated
              </p>
            </div>
            <div className="space-y-4 px-5 py-6 text-sm text-ink-black/70">
              <p className="text-base font-medium text-ink-black">Password updated successfully.</p>
              <p>All active sessions were invalidated. Sign in again with your new password.</p>
              <Link
                to="/signin"
                className="inline-flex items-center justify-center gap-2 border-2 border-ink-black bg-sun-yellow px-4 py-3 font-display text-[11px] font-black uppercase tracking-[0.12em] text-ink-black transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Sign In
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-2 block font-display text-[11px] font-black uppercase tracking-[0.16em] text-ink-black">
              New Password
            </span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-black/45" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  setPasswordTouched(true);
                }}
                onBlur={() => setPasswordTouched(true)}
                className={[
                  'w-full border-2 border-ink-black bg-ghost-white py-3 pl-11 pr-12 text-[15px] text-ink-black outline-none transition-all duration-150',
                  'focus:-translate-x-0.5 focus:-translate-y-0.5 focus:bg-sun-yellow focus:shadow-hard',
                  'dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-800',
                  passwordError ? 'border-electric-pink bg-[#fff5f7]' : '',
                ].join(' ')}
                aria-invalid={Boolean(passwordError)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 border border-ink-black bg-ghost-white px-2 py-1 text-xs text-ink-black/55 transition-colors hover:bg-sun-yellow hover:text-ink-black"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 space-y-2">
              <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, index) => {
                  const active = newPassword.length > 0 && passwordPolicy.metRules > index;
                  const fillClass =
                    passwordPolicy.metRules === 4
                      ? 'bg-neon-lime'
                      : passwordPolicy.metRules >= 2
                        ? 'bg-sun-yellow'
                        : 'bg-electric-pink';
                  return (
                    <span
                      key={`reset-strength-${index}`}
                      className={[
                        'h-2.5 flex-1 border border-ink-black shadow-[1px_1px_0_0_#0a0a0a] transition-colors duration-200',
                        active ? fillClass : 'bg-cream-canvas',
                      ].join(' ')}
                    />
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div className={ruleClass(passwordPolicy.lengthOk)}>
                  <span className={ruleDotClass(passwordPolicy.lengthOk)}>
                    {passwordPolicy.lengthOk ? <CheckCircle2 className="h-2.5 w-2.5" /> : null}
                  </span>
                  8+ chars
                </div>
                <div className={ruleClass(passwordPolicy.numberOk)}>
                  <span className={ruleDotClass(passwordPolicy.numberOk)}>
                    {passwordPolicy.numberOk ? <CheckCircle2 className="h-2.5 w-2.5" /> : null}
                  </span>
                  Number
                </div>
                <div className={ruleClass(passwordPolicy.symbolOk)}>
                  <span className={ruleDotClass(passwordPolicy.symbolOk)}>
                    {passwordPolicy.symbolOk ? <CheckCircle2 className="h-2.5 w-2.5" /> : null}
                  </span>
                  Special char
                </div>
                <div className={ruleClass(passwordPolicy.uppercaseOk)}>
                  <span className={ruleDotClass(passwordPolicy.uppercaseOk)}>
                    {passwordPolicy.uppercaseOk ? <CheckCircle2 className="h-2.5 w-2.5" /> : null}
                  </span>
                  Uppercase
                </div>
              </div>
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block font-display text-[11px] font-black uppercase tracking-[0.16em] text-ink-black">
              Confirm New Password
            </span>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-black/45" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setConfirmTouched(true);
                }}
                onBlur={() => setConfirmTouched(true)}
                className={[
                  'w-full border-2 border-ink-black bg-ghost-white py-3 pl-11 pr-4 text-[15px] text-ink-black outline-none transition-all duration-150',
                  'focus:-translate-x-0.5 focus:-translate-y-0.5 focus:bg-sun-yellow focus:shadow-hard',
                  'dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-800',
                  confirmError ? 'border-electric-pink bg-[#fff5f7]' : '',
                ].join(' ')}
                aria-invalid={Boolean(confirmError)}
              />
            </div>
          </label>

          <button
            type="button"
            onClick={() => {
              void runReset();
            }}
            disabled={!canSubmit}
            className="flex w-full items-center justify-center gap-2 border-2 border-ink-black bg-sun-yellow px-5 py-4 font-display text-[12px] font-black uppercase tracking-[0.1em] text-ink-black shadow-hard transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0px_0px_#0a0a0a] disabled:cursor-not-allowed disabled:bg-cream-canvas disabled:text-ink-black/45 disabled:shadow-none"
          >
            {isSubmitting ? <LoadingSpinner /> : null}
            {isSubmitting ? 'Updating Password...' : 'Reset Password'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
