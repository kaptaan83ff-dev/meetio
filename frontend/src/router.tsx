import { createBrowserRouter } from 'react-router-dom';

/**
 * MeetIO Router Definition
 * All routes from TRD §2.3 are stubbed here to prevent TS errors.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <div>Landing Page Placeholder</div>,
  },
  {
    path: '/signin',
    element: <div>Sign In Placeholder</div>,
  },
  {
    path: '/signup',
    element: <div>Sign Up Placeholder</div>,
  },
  {
    path: '/forgot-password',
    element: <div>Forgot Password Placeholder</div>,
  },
  {
    path: '/dashboard',
    element: <div>Dashboard Placeholder</div>,
  },
  {
    path: '/calendar',
    element: <div>Calendar Placeholder</div>,
  },
  {
    path: '/messenger',
    element: <div>Messenger Placeholder</div>,
  },
  {
    path: '/action-items',
    element: <div>Action Items Placeholder</div>,
  },
  {
    path: '/settings',
    element: <div>Settings Placeholder</div>,
  },
  {
    path: '/profile',
    element: <div>Profile Placeholder</div>,
  },
  {
    path: '/meeting/:id/lobby',
    element: <div>Meeting Lobby Placeholder</div>,
  },
  {
    path: '/meeting/:id',
    element: <div>Meeting Room Placeholder</div>,
  },
  {
    path: '/meetings/:id/recap',
    element: <div>Meeting Recap Placeholder</div>,
  },
  {
    path: '/meetings/:id/transcript',
    element: <div>Meeting Transcript Placeholder</div>,
  },
  {
    path: '/meetings/:id/recording',
    element: <div>Meeting Recording Placeholder</div>,
  },
]);

export default router;
