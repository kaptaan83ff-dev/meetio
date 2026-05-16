// @vitest-environment jsdom
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ToastViewport } from '@/components/toast/ToastViewport';

const verifyEmailMock = vi.hoisted(() => vi.fn());
const requestVerifyTokenMock = vi.hoisted(() => vi.fn());
let VerifyEmailPageComponent: ComponentType;

vi.mock('@/lib/authApi', () => ({
  verifyEmail: verifyEmailMock,
  requestVerifyToken: requestVerifyTokenMock,
}));

describe('VerifyEmailPage', () => {
  beforeEach(async () => {
    verifyEmailMock.mockReset();
    requestVerifyTokenMock.mockReset();
    VerifyEmailPageComponent = (await import('./VerifyEmailPage')).default;
  });

  function renderRoute(initialEntry: string) {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/verify" element={<VerifyEmailPageComponent />} />
          <Route path="/signin" element={<div>Sign In Page</div>} />
        </Routes>
        <ToastViewport />
      </MemoryRouter>,
    );
  }

  it('auto-verifies the token from the email link', async () => {
    verifyEmailMock.mockResolvedValueOnce(undefined);
    renderRoute('/verify?token=token_123');

    await waitFor(() => expect(verifyEmailMock).toHaveBeenCalledWith('token_123'));
    expect(await screen.findByText(/identity confirmed/i)).toBeTruthy();
    expect(screen.getAllByText(/your email is verified/i).length).toBeGreaterThan(0);
  });

  it('allows requesting a fresh verification link', async () => {
    requestVerifyTokenMock.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    renderRoute('/verify');

    await user.type(screen.getByPlaceholderText(/enter signup email/i), 'person@example.com');
    await user.click(screen.getByRole('button', { name: /resend verification link/i }));

    await waitFor(() => expect(requestVerifyTokenMock).toHaveBeenCalledWith('person@example.com'));
    expect(await screen.findByText(/verification email sent/i)).toBeTruthy();
  });
});
