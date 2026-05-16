import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';

import { useAuthStore } from '@/stores/authStore';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleOAuthButton } from '@/components/auth/GoogleOAuthButton';
import { showToast } from '@/lib/toast';

type RedirectState = {
  redirect?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getRedirectTarget(state: unknown, searchParams: URLSearchParams): string {
  if (state && typeof state === 'object' && 'redirect' in state) {
    const redirect = (state as RedirectState).redirect;
    if (redirect) {
      return redirect;
    }
  }

  return searchParams.get('redirect') || '/dashboard';
}

function LoadingSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
}

export default function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const login = useAuthStore((state) => state.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const redirectTarget = useMemo(() => getRedirectTarget(location.state, searchParams), [location.state, searchParams]);
  const toastType = searchParams.get('toast');
  const oauthError = searchParams.get('error');

  const emailError = emailTouched && !EMAIL_REGEX.test(email.trim());
  const passwordError = passwordTouched && password.trim().length === 0;

  useEffect(() => {
    const state = location.state as { toast?: { tone: 'success' | 'info' | 'warning' | 'error' | 'action'; title: string; message: string } } | null;
    if (state?.toast) {
      showToast(state.toast);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (toastType === 'session-expired') {
      showToast({
        tone: 'error',
        title: 'Session Expired',
        message: 'Session expired, please sign in again.',
      });
      return;
    }

    if (oauthError === 'oauth_failed') {
      showToast({
        tone: 'error',
        title: 'Google Sign-In Failed',
        message: 'Google sign-in failed. Please try again.',
      });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location.state, oauthError, toastType]);

  useEffect(() => {
    if (!error) {
      return;
    }

    showToast({
      tone: 'error',
      title: 'Sign-In Failed',
      message: error,
    });
  }, [error]);

  const clearServerError = () => {
    useAuthStore.setState({ error: null });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEmailTouched(true);
    setPasswordTouched(true);
    clearServerError();

    if (!EMAIL_REGEX.test(email.trim())) {
      showToast({
        tone: 'warning',
        title: 'Email Invalid',
        message: 'Enter a valid email address.',
      });
      return;
    }

    if (password.trim().length === 0) {
      showToast({
        tone: 'warning',
        title: 'Password Missing',
        message: 'Password is required.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      if (result?.requires_2fa) {
        navigate('/auth/2fa', {
          state: {
            totp_session_id: result.totp_session_id,
            email: email.trim(),
            redirect: redirectTarget,
          },
        });
        return;
      }

      if (useAuthStore.getState().isAuthenticated) {
        navigate(redirectTarget, { replace: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="Sign In"
      subtitle="Welcome back. Sign in to continue your meeting workflow, regain access to your dashboard, and keep your sessions in sync."
      variant="signin"
    >
      <GoogleOAuthButton className="mb-4" isLoading={submitting || isLoading} />

      <div className="relative my-5 flex items-center text-[11px] font-black uppercase tracking-[0.18em] text-ink-black/55">
        <span className="h-0.5 flex-1 bg-ink-black" />
        <span className="px-4">or use email</span>
        <span className="h-0.5 flex-1 bg-ink-black" />
      </div>

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
                clearServerError();
              }}
              onBlur={() => setEmailTouched(true)}
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

        <label className="block">
          <span className="mb-2 block font-display text-[11px] font-black uppercase tracking-[0.16em] text-ink-black">
            Password
          </span>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-black/45" />
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setPasswordTouched(true);
                clearServerError();
              }}
              onBlur={() => setPasswordTouched(true)}
              className={[
                'w-full border-2 border-ink-black bg-ghost-white py-3.5 pl-11 pr-12 text-[15px] text-ink-black outline-none transition-all duration-150',
                'focus:-translate-x-0.5 focus:-translate-y-0.5 focus:bg-sun-yellow focus:shadow-hard',
                'dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-800',
                passwordError ? 'border-electric-pink bg-[#fff5f7]' : '',
              ].join(' ')}
              aria-invalid={passwordError}
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
        </label>

        <div className="flex items-center justify-between gap-4 text-sm">
          <label className="flex items-start gap-3 text-ink-black/65">
            <input type="checkbox" className="mt-0.5 h-4 w-4 border-2 border-ink-black accent-sun-yellow" />
            <span>Remember me</span>
          </label>
          <Link
            className="border-b-2 border-sun-yellow pb-0.5 font-semibold text-ink-black transition-colors hover:bg-sun-yellow"
            to="/forgot-password"
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting || isLoading}
          className="flex w-full items-center justify-center gap-2 border-2 border-ink-black bg-sun-yellow px-5 py-4 font-display text-[12px] font-black uppercase tracking-[0.1em] text-ink-black shadow-hard transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0px_0px_#0a0a0a] disabled:cursor-not-allowed disabled:bg-cream-canvas disabled:text-ink-black/45 disabled:shadow-none"
        >
          {submitting || isLoading ? <LoadingSpinner /> : null}
          {submitting || isLoading ? 'Signing In...' : 'Sign In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-black/60">
        Don't have an account?{' '}
        <Link
          className="border-b-2 border-sun-yellow font-semibold text-ink-black transition-colors hover:bg-sun-yellow"
          to="/signup"
        >
          Sign up
        </Link>
      </p>
    </AuthShell>
  );
}
