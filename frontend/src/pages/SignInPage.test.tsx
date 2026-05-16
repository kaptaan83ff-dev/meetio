// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';

import SignInPage from './SignInPage';
import { ToastViewport } from '@/components/toast/ToastViewport';

type MockAuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  initAuth: ReturnType<typeof vi.fn>;
  login: ReturnType<typeof vi.fn>;
};

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: MockAuthState) => unknown) =>
    selector({
      isAuthenticated: false,
      isLoading: false,
      error: null,
      initAuth: vi.fn(),
      login: vi.fn(),
    }),
}));

describe('SignInPage', () => {
  const replaceState = window.history.replaceState;

  beforeEach(() => {
    window.history.replaceState({}, '', '/signin?error=oauth_failed');
  });

  afterEach(() => {
    window.history.replaceState = replaceState;
  });

  it('shows google oauth failure toast', async () => {
    render(
      <MemoryRouter initialEntries={['/signin?error=oauth_failed']}>
        <SignInPage />
        <ToastViewport />
      </MemoryRouter>
    );

    expect(await screen.findByText('Google sign-in failed. Please try again.')).toBeTruthy();
  });
});
