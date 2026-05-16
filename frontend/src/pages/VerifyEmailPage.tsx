import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Clock3, Loader2, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';

import { ApiError } from '@/lib/apiClient';
import { requestVerifyToken, verifyEmail } from '@/lib/authApi';
import { showToast } from '@/lib/toast';
import { AuthShell } from '@/components/auth/AuthShell';
import { env } from '@/config/env';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type VerifyStatus = 'idle' | 'verifying' | 'verified' | 'failed';

function LoadingSpinner() {
  return <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />;
}

function getVerificationError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.status === 404) {
      return 'This verification link is invalid or expired. Request a fresh email.';
    }
    return error.message || 'We could not verify your email right now.';
  }

  return 'We could not verify your email right now.';
}

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const linkToken = searchParams.get('token')?.trim() || '';
  const autoVerifyStarted = useRef(false);

  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [status, setStatus] = useState<VerifyStatus>(linkToken ? 'verifying' : 'idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const emailValue = email.trim();
  const emailError = emailTouched && emailValue.length > 0 && !EMAIL_REGEX.test(emailValue);
  const canResend = EMAIL_REGEX.test(emailValue) && !isResending && resendCooldown === 0;
  const isLocalDev = env.appEnv === 'development';

  const verifyToken = useMemo(
    () => async (token: string) => {
      if (!token.trim()) {
        setStatus('failed');
        setErrorMessage('Verification token is missing. Open the verification link from your email.');
        showToast({
          tone: 'warning',
          title: 'Token Missing',
          message: 'Open the verification link from your inbox.',
        });
        return;
      }

      setStatus('verifying');
      setErrorMessage('');
      try {
        await verifyEmail(token.trim());
        setStatus('verified');
        showToast({
          tone: 'success',
          title: 'Email Verified',
          message: 'Your email is verified. You can now sign in.',
          action: {
            label: 'Sign In',
            onClick: () => navigate('/signin'),
          },
        });
      } catch (error) {
        const message = getVerificationError(error);
        setStatus('failed');
        setErrorMessage(message);
        showToast({
          tone: 'error',
          title: 'Verification Failed',
          message,
        });
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (!linkToken || autoVerifyStarted.current) {
      return;
    }

    autoVerifyStarted.current = true;
    void verifyToken(linkToken);
  }, [linkToken, verifyToken]);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [resendCooldown]);

  const handleResend = async () => {
    setEmailTouched(true);
    if (!EMAIL_REGEX.test(emailValue)) {
      showToast({
        tone: 'warning',
        title: 'Email Required',
        message: 'Enter the email you used during signup to request a fresh verification link.',
      });
      return;
    }

    setIsResending(true);
    try {
      await requestVerifyToken(emailValue);
      setResendCooldown(60);
      showToast({
        tone: 'info',
        title: 'Verification Email Sent',
        message: 'If that account exists and is not verified, a fresh verification link was sent.',
      });
    } catch (error) {
      showToast({
        tone: 'error',
        title: 'Resend Failed',
        message: error instanceof ApiError ? error.message : 'Could not send a fresh verification email right now.',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthShell
      title="Verify Email"
      subtitle="Open the secure verification link from your email to activate email/password sign-in."
      chromeTitle="Auth Module • Email Verify"
      divisionLabel="Division • Auth / 04"
      variant="verify"
      chromeTone="lime"
    >
      {status === 'verified' ? (
        <div className="space-y-5">
          <div className="border-[3px] border-ink-black bg-ghost-white shadow-hard">
            <div className="flex items-center gap-3 border-b-2 border-ink-black bg-neon-lime px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-ink-black" aria-hidden="true" />
              <p className="font-display text-[11px] font-black uppercase tracking-[0.16em] text-ink-black">Email Verified</p>
            </div>
            <div className="space-y-4 px-5 py-6 text-center text-sm text-ink-black/70">
              <div className="mx-auto grid h-20 w-20 place-items-center border-[3px] border-ink-black bg-neon-lime text-ink-black shadow-hard">
                <ShieldCheck className="h-9 w-9" aria-hidden="true" />
              </div>
              <p className="font-display text-xl uppercase tracking-[-0.03em] text-ink-black">Identity Confirmed</p>
              <p>Your email is verified. Continue to sign in with your email and password.</p>
              <Link
                to="/signin"
                className="inline-flex w-full items-center justify-center gap-2 border-2 border-ink-black bg-sun-yellow px-4 py-3 font-display text-[11px] font-black uppercase tracking-[0.12em] text-ink-black shadow-hard transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-hover"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Go to Sign In
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-3 border border-ink-black border-l-[3px] border-l-neon-lime bg-[#f4ffe0] px-4 py-3 text-xs leading-5 text-ink-black/70">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-black" aria-hidden="true" />
            <div>
              <p className="font-display text-[10px] font-black uppercase tracking-[0.12em] text-ink-black">Token Delivered</p>
              <p>
                {isLocalDev ? (
                  <>In local dev, open Mailpit at <span className="font-mono text-ink-black">localhost:8025</span> and click the MeetIO verification link.</>
                ) : (
                  'Check your inbox and click the MeetIO verification link. The page verifies automatically when the link opens.'
                )}
              </p>
            </div>
          </div>

          {status === 'verifying' ? (
            <div className="flex items-center justify-center gap-3 border-[3px] border-ink-black bg-sun-yellow px-5 py-4 font-display text-[12px] font-black uppercase tracking-[0.1em] text-ink-black shadow-hard">
              <LoadingSpinner />
              Verifying email...
            </div>
          ) : null}

          {errorMessage ? (
            <div className="flex items-start gap-2 border border-ink-black border-l-[3px] border-l-electric-pink bg-[#fff5f7] px-3 py-2 font-display text-[10px] font-black uppercase tracking-[0.08em] text-ink-black">
              <span className="mt-0.5">!</span>
              <span>{errorMessage}</span>
            </div>
          ) : null}

          <div className="border-[3px] border-ink-black bg-ghost-white shadow-hard">
            <div className="flex items-center gap-3 border-b-2 border-ink-black bg-cream-canvas px-4 py-3">
              <Clock3 className="h-4 w-4 text-ink-black" aria-hidden="true" />
              <p className="font-display text-[11px] font-black uppercase tracking-[0.14em] text-ink-black">Need a Fresh Link?</p>
            </div>
            <div className="space-y-3 px-4 py-4">
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setEmailTouched(true);
                }}
                onBlur={() => setEmailTouched(true)}
                placeholder="Enter signup email"
                className={[
                  'w-full border-2 border-ink-black bg-ghost-white px-4 py-3 text-sm text-ink-black outline-none transition-all duration-150',
                  'focus:-translate-x-0.5 focus:-translate-y-0.5 focus:bg-sun-yellow focus:shadow-hard',
                  emailError ? 'border-electric-pink bg-[#fff5f7]' : '',
                ].join(' ')}
                aria-invalid={emailError}
              />
              <button
                type="button"
                onClick={handleResend}
                disabled={!canResend}
                className="inline-flex w-full items-center justify-center gap-2 border-2 border-ink-black bg-ghost-white px-4 py-3 font-display text-[11px] font-black uppercase tracking-[0.12em] text-ink-black transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-neon-lime hover:shadow-hard disabled:cursor-not-allowed disabled:bg-cream-canvas disabled:text-ink-black/45 disabled:shadow-none"
              >
                {isResending ? <LoadingSpinner /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Link'}
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-ink-black/60">
            Already verified?{' '}
            <Link
              className="border-b-2 border-sun-yellow font-semibold text-ink-black transition-colors hover:bg-sun-yellow"
              to="/signin"
            >
              Back to Sign In
            </Link>
          </p>
        </div>
      )}
    </AuthShell>
  );
}
