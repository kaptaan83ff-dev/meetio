import { PropsWithChildren, useEffect } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { useAuthStore } from '@/stores/authStore';

type RedirectState = {
  redirect?: string;
};

function getRedirectTarget(state: unknown, searchParams: URLSearchParams): string {
  if (state && typeof state === 'object' && 'redirect' in state) {
    const redirect = (state as RedirectState).redirect;
    if (redirect) {
      return redirect;
    }
  }

  return searchParams.get('redirect') || '/dashboard';
}

function RouteAuthLoading() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-cream-canvas bg-dot-grid text-ink-black">
      <div className="border-[3px] border-ink-black bg-ghost-white px-8 py-6 text-center shadow-hard">
        <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-hidden="true" />
        <p className="mt-3 font-display text-sm uppercase tracking-[0.2em]">Loading Session</p>
        <p className="mt-2 text-sm text-ink-black/60">Checking your MeetIO access.</p>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children }: PropsWithChildren) {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const initAuth = useAuthStore((state) => state.initAuth);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  if (isLoading) {
    return <RouteAuthLoading />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ redirect: `${location.pathname}${location.search}` }} />;
  }

  return children;
}

export function GuestOnlyRoute({ children }: PropsWithChildren) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const initAuth = useAuthStore((state) => state.initAuth);
  const redirectTarget = getRedirectTarget(location.state, searchParams);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  if (isLoading) {
    return <RouteAuthLoading />;
  }

  if (isAuthenticated) {
    return <Navigate to={redirectTarget} replace />;
  }

  return children;
}
