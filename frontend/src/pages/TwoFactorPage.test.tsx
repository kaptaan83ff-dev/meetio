// @vitest-environment jsdom
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApiError } from '@/lib/apiClient';
import { ToastViewport } from '@/components/toast/ToastViewport';

const verify2FAMock = vi.hoisted(() => vi.fn());
const fetchCurrentUserMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());
let TwoFactorPageComponent: ComponentType;

vi.mock('@/lib/authApi', () => ({
  verify2FA: verify2FAMock,
}));

vi.mock('@/stores/authStore', () => ({
  useAuthStore: (selector: (state: { fetchCurrentUser: typeof fetchCurrentUserMock }) => unknown) =>
    selector({ fetchCurrentUser: fetchCurrentUserMock }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

describe('TwoFactorPage', () => {
  beforeEach(async () => {
    verify2FAMock.mockReset();
    fetchCurrentUserMock.mockReset();
    navigateMock.mockReset();
    TwoFactorPageComponent = (await import('./TwoFactorPage')).default;
  });

  function renderRoute(initialEntry: string, state?: Record<string, unknown>) {
    return render(
      <MemoryRouter initialEntries={[{ pathname: initialEntry, state }]}>
        <Routes>
          <Route path="/auth/2fa" element={<TwoFactorPageComponent />} />
          <Route path="/signin" element={<div>Sign In Page</div>} />
          <Route path="/dashboard" element={<div>Dashboard Page</div>} />
        </Routes>
        <ToastViewport />
      </MemoryRouter>,
    );
  }

  function getOtpInput() {
    const input = document.querySelector('input[aria-label="Authentication code"]') as HTMLInputElement | null;
    if (!input) {
      throw new Error('OTP input not found');
    }
    return input;
  }

  it('redirects to sign in when the session is missing', async () => {
    renderRoute('/auth/2fa');

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/signin', {
        replace: true,
        state: {
          toast: {
            tone: 'error',
            title: 'Session Expired',
            message: 'Session expired, please sign in again.',
          },
        },
      }),
    );
  });

  it('submits the code automatically and navigates to the dashboard', async () => {
    verify2FAMock.mockResolvedValueOnce(undefined);
    fetchCurrentUserMock.mockResolvedValueOnce(undefined);

    renderRoute('/auth/2fa', {
      totp_session_id: 'totp_123',
      email: 'person@example.com',
    });

    const user = userEvent.setup();
    await user.type(getOtpInput(), '123456');

    await waitFor(() => expect(verify2FAMock).toHaveBeenCalledWith('totp_123', '123456'));
    await waitFor(() => expect(fetchCurrentUserMock).toHaveBeenCalled());
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard', { replace: true }));
  });

  it('shows toast errors for invalid otp codes', async () => {
    verify2FAMock.mockRejectedValueOnce(new ApiError(400, 'INVALID_OTP', 'Incorrect code.'));

    renderRoute('/auth/2fa', {
      totp_session_id: 'totp_123',
      email: 'person@example.com',
    });

    const user = userEvent.setup();
    await user.type(getOtpInput(), '123456');

    expect(await screen.findByText(/incorrect code\. try again\./i)).toBeTruthy();
    expect(getOtpInput().value).toBe('');
  });
});
