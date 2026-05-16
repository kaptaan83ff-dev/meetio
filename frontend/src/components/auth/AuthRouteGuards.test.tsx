// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';

import { GuestOnlyRoute, ProtectedRoute } from '@/components/auth/AuthRouteGuards';

type MockAuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  initAuth: () => Promise<void>;
};

const initAuthMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted<MockAuthState>(() => ({
  isAuthenticated: false,
  isLoading: false,
  initAuth: initAuthMock,
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: MockAuthState) => unknown) => selector(authState),
}));

describe('AuthRouteGuards', () => {
  beforeEach(() => {
    initAuthMock.mockReset();
    initAuthMock.mockResolvedValue(undefined);
    authState.isAuthenticated = false;
    authState.isLoading = false;
  });

  it('redirects guests away from protected routes', async () => {
    render(
      <MemoryRouter initialEntries={['/calendar?view=week']}>
        <Routes>
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <div>Calendar Page</div>
              </ProtectedRoute>
            }
          />
          <Route path="/signin" element={<div>Sign In Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Sign In Page')).toBeTruthy();
    await waitFor(() => expect(initAuthMock).toHaveBeenCalledTimes(1));
  });

  it('redirects authenticated users away from guest-only routes', async () => {
    authState.isAuthenticated = true;

    render(
      <MemoryRouter initialEntries={['/signin?redirect=/settings']}>
        <Routes>
          <Route
            path="/signin"
            element={
              <GuestOnlyRoute>
                <div>Sign In Page</div>
              </GuestOnlyRoute>
            }
          />
          <Route path="/settings" element={<div>Settings Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Settings Page')).toBeTruthy();
    await waitFor(() => expect(initAuthMock).toHaveBeenCalledTimes(1));
  });
});
