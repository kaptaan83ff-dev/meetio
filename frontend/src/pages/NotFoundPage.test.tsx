// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';

import NotFoundPage from '@/pages/NotFoundPage';

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

describe('NotFoundPage', () => {
  beforeEach(() => {
    initAuthMock.mockReset();
    initAuthMock.mockResolvedValue(undefined);
    authState.isAuthenticated = false;
    authState.isLoading = false;
  });

  function renderRoute(path: string) {
    const router = createMemoryRouter([{ path: '*', element: <NotFoundPage /> }], {
      initialEntries: [path],
    });

    return render(<RouterProvider router={router} />);
  }

  it('shows guest recovery actions for anonymous users', async () => {
    renderRoute('/missing-public-page');

    expect(await screen.findByRole('link', { name: /go to homepage/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /start free trial/i })).toBeTruthy();
    expect(screen.getByText(/page you're looking for doesn't exist/i)).toBeTruthy();
    await waitFor(() => expect(initAuthMock).toHaveBeenCalledTimes(1));
  });

  it('shows workspace recovery actions for authenticated users', async () => {
    authState.isAuthenticated = true;

    renderRoute('/workspace/missing-route');

    expect(await screen.findByRole('link', { name: /go to dashboard/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /go back/i })).toBeTruthy();
    expect(screen.getByText(/your session is still active/i)).toBeTruthy();
  });
});
