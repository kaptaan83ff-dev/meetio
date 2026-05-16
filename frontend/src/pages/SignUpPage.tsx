import { FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, UserRound } from 'lucide-react';

import { ApiError } from '@/lib/apiClient';
import { login, register } from '@/lib/authApi';
import { getPasswordPolicyError, getPasswordPolicyState } from '@/lib/passwordPolicy';
import { showToast } from '@/lib/toast';
import { AuthShell } from '@/components/auth/AuthShell';
import { GoogleOAuthButton } from '@/components/auth/GoogleOAuthButton';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function LoadingSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
}

function getFriendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'EMAIL_TAKEN') {
      return 'An account with this email already exists. Sign in instead.';
    }
    if (error.code === 'REGISTER_INVALID_PASSWORD' || error.code === 'VALIDATION_ERROR') {
      return error.message;
    }
    return error.message || 'Something went wrong';
  }

  return 'Something went wrong';
}

export default function SignUpPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [displayNameTouched, setDisplayNameTouched] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const displayNameValue = displayName.trim();
  const passwordPolicy = useMemo(() => getPasswordPolicyState(password), [password]);
  const displayNameError = displayNameTouched && (displayNameValue.length < 2 || displayNameValue.length > 50);
  const emailError = emailTouched && !EMAIL_REGEX.test(email.trim());
  const passwordError = passwordTouched ? getPasswordPolicyError(password) : '';
  const passwordBarTone = passwordPolicy.metRules <= 1 ? 'weak' : passwordPolicy.metRules <= 3 ? 'medium' : 'strong';

  const canSubmit =
    EMAIL_REGEX.test(email.trim()) &&
    displayNameValue.length >= 2 &&
    displayNameValue.length <= 50 &&
    passwordPolicy.isStrong;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDisplayNameTouched(true);
    setEmailTouched(true);
    setPasswordTouched(true);

    if (!canSubmit) {
      if (displayNameValue.length < 2 || displayNameValue.length > 50) {
        showToast({
          tone: 'warning',
          title: 'Display Name Invalid',
          message: 'Display name must be between 2 and 50 characters.',
        });
      } else if (!EMAIL_REGEX.test(email.trim())) {
        showToast({
          tone: 'warning',
          title: 'Email Invalid',
          message: 'Enter a valid email address.',
        });
      } else if (passwordError) {
        showToast({
          tone: 'warning',
          title: 'Password Invalid',
          message: passwordError,
        });
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email.trim(), password, displayNameValue);
      await login(email.trim(), password).catch(() => undefined);
      showToast({
        tone: 'success',
        title: 'Verification Email Sent',
        message: `Verification email sent to ${email.trim()}. Check your inbox or Mailpit.`,
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Sign-Up Failed',
        message: getFriendlyError(error),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const ruleClass = (met: boolean) =>
    `flex min-h-8 items-center gap-1.5 border border-ink-black px-2 py-1.5 text-[9px] font-black uppercase leading-none tracking-[0.06em] ${
      met ? 'bg-[#f4ffe0] text-ink-black' : 'bg-cream-canvas text-ink-black/50'
    }`;

  const ruleDotClass = (met: boolean) =>
    `grid h-3.5 w-3.5 place-items-center rounded-full border-2 ${
      met ? 'border-neon-lime bg-neon-lime text-ink-black' : 'border-current bg-transparent'
    }`;

  return (
    <AuthShell
      title="Create Account"
      subtitle="Join MeetIO to keep meetings, action items, and follow-up work tied to one identity."
      chromeTitle="Auth Module • Sign Up"
      divisionLabel="Division • Auth / 01"
      variant="signup"
    >
      <GoogleOAuthButton className="mb-3 py-3" isLoading={isSubmitting} />

      <div className="relative my-3 flex items-center text-[10px] font-black uppercase tracking-[0.18em] text-ink-black/55">
        <span className="h-0.5 flex-1 bg-ink-black" />
        <span className="px-4">or use email</span>
        <span className="h-0.5 flex-1 bg-ink-black" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="mb-2 block font-display text-[11px] font-black uppercase tracking-[0.16em] text-ink-black">
            Display Name
          </span>
          <div className="relative">
            <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-black/45" />
            <input
              type="text"
              autoComplete="name"
              value={displayName}
              maxLength={50}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setDisplayNameTouched(true);
              }}
              onBlur={() => setDisplayNameTouched(true)}
              className={[
                'w-full border-2 border-ink-black bg-ghost-white py-3 pl-11 pr-16 text-[15px] text-ink-black outline-none transition-all duration-150',
                'focus:-translate-x-0.5 focus:-translate-y-0.5 focus:bg-sun-yellow focus:shadow-hard',
                'dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-800',
                displayNameError ? 'border-electric-pink bg-[#fff5f7]' : '',
              ].join(' ')}
              aria-invalid={displayNameError}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-ink-black/45">
              {displayNameValue.length}/50
            </span>
          </div>
        </label>

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
              className={[
                'w-full border-2 border-ink-black bg-ghost-white py-3 pl-11 pr-4 text-[15px] text-ink-black outline-none transition-all duration-150',
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
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
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
                const active = password.length > 0 && passwordPolicy.metRules > index;
                const fillClass =
                  passwordBarTone === 'strong' ? 'bg-neon-lime' : passwordBarTone === 'medium' ? 'bg-sun-yellow' : 'bg-electric-pink';
                return (
                  <span
                    key={`strength-${index}`}
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 border-2 border-ink-black bg-sun-yellow px-5 py-4 font-display text-[12px] font-black uppercase tracking-[0.1em] text-ink-black shadow-hard transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0px_0px_#0a0a0a] disabled:cursor-not-allowed disabled:bg-cream-canvas disabled:text-ink-black/45 disabled:shadow-none"
        >
          {isSubmitting ? <LoadingSpinner /> : null}
          {isSubmitting ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-black/60">
        Already have an account?{' '}
        <Link
          className="border-b-2 border-sun-yellow font-semibold text-ink-black transition-colors hover:bg-sun-yellow"
          to="/signin"
        >
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
