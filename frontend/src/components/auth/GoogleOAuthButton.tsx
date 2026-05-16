import { Loader2 } from 'lucide-react';

import { getGoogleOAuthAuthorizeUrl } from './googleOAuthUrl';

type GoogleOAuthButtonProps = {
  isLoading?: boolean;
  className?: string;
  onRedirect?: (url: string) => void;
};

function GoogleLogo() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-[18px] w-[18px] shrink-0">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.667 32.659 29.315 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.037l5.657-5.657C34.044 6.053 29.28 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917Z" />
      <path fill="#FF3D00" d="M6.306 14.691 12.876 19.5C14.655 14.988 18.998 11.8 24 11.8c3.059 0 5.842 1.154 7.961 3.037l5.657-5.657C34.044 6.053 29.28 4 24 4 16.318 4 9.656 8.337 6.306 14.691Z" />
      <path fill="#4CAF50" d="M24 44c5.187 0 9.891-1.98 13.47-5.203l-6.22-5.242C29.241 34.09 26.779 35 24 35c-5.292 0-9.631-3.318-11.292-7.925l-6.52 5.02C9.493 39.063 16.146 44 24 44Z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.02 12.02 0 0 1-4.053 5.555l.003-.002 6.22 5.242C36.03 35.679 40 30.587 40 24c0-1.341-.138-2.65-.389-3.917Z" />
    </svg>
  );
}

export function GoogleOAuthButton({ isLoading = false, className = '', onRedirect }: GoogleOAuthButtonProps) {
  const handleClick = () => {
    const nextUrl = getGoogleOAuthAuthorizeUrl();
    if (onRedirect) {
      onRedirect(nextUrl);
      return;
    }

    window.location.assign(nextUrl);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isLoading}
      className={[
        'flex w-full items-center justify-center gap-3 border-2 border-ink-black bg-ghost-white px-5 py-4 font-display text-[12px] font-black uppercase tracking-[0.08em] text-ink-black shadow-hard transition-all duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0px_0px_#0a0a0a] disabled:cursor-not-allowed disabled:bg-cream-canvas disabled:text-ink-black/45 disabled:shadow-none',
        className,
      ].join(' ')}
      aria-label="Continue with Google"
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GoogleLogo />}
      Continue with Google
    </button>
  );
}

export default GoogleOAuthButton;
