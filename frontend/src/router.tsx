import { createBrowserRouter } from 'react-router-dom';
import { CalendarCheck, CheckSquare, FileText, MessageCircle, Settings, UserRound, Video } from 'lucide-react';

import { GuestOnlyRoute, ProtectedRoute } from '@/components/auth/AuthRouteGuards';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import TwoFactorPage from '@/pages/TwoFactorPage';
import SignInPage from '@/pages/SignInPage';
import SignUpPage from '@/pages/SignUpPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import DashboardPage from '@/pages/DashboardPage';
import AppPlaceholderPage from '@/pages/AppPlaceholderPage';
import NotFoundPage from '@/pages/NotFoundPage';
import LandingPage from '@/pages/LandingPage';

const routerOptions = {
  future: {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
  },
} as unknown as Parameters<typeof createBrowserRouter>[1];

const routeErrorElement = <NotFoundPage routeError />;

const routes = [
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/signin',
    element: (
      <GuestOnlyRoute>
        <SignInPage />
      </GuestOnlyRoute>
    ),
  },
  {
    path: '/signup',
    element: (
      <GuestOnlyRoute>
        <SignUpPage />
      </GuestOnlyRoute>
    ),
  },
  {
    path: '/forgot-password',
    element: (
      <GuestOnlyRoute>
        <ForgotPasswordPage />
      </GuestOnlyRoute>
    ),
  },
  {
    path: '/auth/2fa',
    element: (
      <GuestOnlyRoute>
        <TwoFactorPage />
      </GuestOnlyRoute>
    ),
  },
  {
    path: '/reset-password',
    element: (
      <GuestOnlyRoute>
        <ResetPasswordPage />
      </GuestOnlyRoute>
    ),
  },
  {
    path: '/verify',
    element: <VerifyEmailPage />,
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardPage />
      </ProtectedRoute>
    ),
  },
  {
    path: '/calendar',
    element: (
      <ProtectedRoute>
        <AppPlaceholderPage title="Calendar" description="Calendar sync will attach agenda, reminders, and event context." icon={CalendarCheck} />
      </ProtectedRoute>
    ),
  },
  {
    path: '/messenger',
    element: (
      <ProtectedRoute>
        <AppPlaceholderPage title="Messenger" description="Team messages and meeting follow-ups will live here." icon={MessageCircle} />
      </ProtectedRoute>
    ),
  },
  {
    path: '/action-items',
    element: (
      <ProtectedRoute>
        <AppPlaceholderPage title="Action Items" description="Meeting tasks and due-date reminders will be tracked from meetings." icon={CheckSquare} />
      </ProtectedRoute>
    ),
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute>
        <AppPlaceholderPage title="Settings" description="Account, security, and workspace preferences will live here." icon={Settings} />
      </ProtectedRoute>
    ),
  },
  {
    path: '/profile',
    element: (
      <ProtectedRoute>
        <AppPlaceholderPage title="Profile" description="Profile identity, avatar, and account details will live here." icon={UserRound} />
      </ProtectedRoute>
    ),
  },
  {
    path: '/meeting/:id/lobby',
    element: (
      <ProtectedRoute>
        <AppPlaceholderPage title="Meeting Lobby" description="Pre-join controls, device checks, and guest policies will live here." icon={Video} />
      </ProtectedRoute>
    ),
  },
  {
    path: '/meeting/:id',
    element: (
      <ProtectedRoute>
        <AppPlaceholderPage title="Meeting Room" description="Live meeting audio, video, chat, and AI assistance will live here." icon={Video} />
      </ProtectedRoute>
    ),
  },
  {
    path: '/meetings/:id/recap',
    element: (
      <ProtectedRoute>
        <AppPlaceholderPage title="Meeting Recap" description="Summary, decisions, and action items will live here." icon={FileText} />
      </ProtectedRoute>
    ),
  },
  {
    path: '/meetings/:id/transcript',
    element: (
      <ProtectedRoute>
        <AppPlaceholderPage title="Meeting Transcript" description="Searchable meeting transcript and speaker segments will live here." icon={FileText} />
      </ProtectedRoute>
    ),
  },
  {
    path: '/meetings/:id/recording',
    element: (
      <ProtectedRoute>
        <AppPlaceholderPage title="Meeting Recording" description="Playback, chapters, and recording controls will live here." icon={Video} />
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
].map((route) => ({ ...route, errorElement: routeErrorElement }));

export const router = createBrowserRouter(routes, routerOptions);

export default router;
