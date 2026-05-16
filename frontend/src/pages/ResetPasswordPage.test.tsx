// @vitest-environment jsdom
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApiError } from '@/lib/apiClient';
import { ToastViewport } from '@/components/toast/ToastViewport';

const resetPasswordMock = vi.hoisted(() => vi.fn());
let ForgotPasswordPageComponent: ComponentType;
let ResetPasswordPageComponent: ComponentType;

vi.mock('@/lib/authApi', () => ({
  resetPassword: resetPasswordMock,
  forgotPassword: vi.fn(),
}));

describe('ResetPasswordPage', () => {
  beforeEach(async () => {
    resetPasswordMock.mockReset();
    ForgotPasswordPageComponent = (await import('./ForgotPasswordPage')).default;
    ResetPasswordPageComponent = (await import('./ResetPasswordPage')).default;
  });

  function renderRoute(initialEntry: string) {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/reset-password" element={<ResetPasswordPageComponent />} />
          <Route path="/forgot-password" element={<ForgotPasswordPageComponent />} />
        </Routes>
        <ToastViewport />
      </MemoryRouter>,
    );
  }

  function getPasswordInputs(container: HTMLElement) {
    const inputs = container.querySelectorAll('input[type="password"]');
    if (inputs.length < 2) {
      throw new Error('Password inputs not found');
    }
    return {
      password: inputs[0] as HTMLInputElement,
      confirm: inputs[1] as HTMLInputElement,
    };
  }

  function getSubmitButton(container: HTMLElement) {
    const button = Array.from(container.querySelectorAll('form button[type="button"]')).find(
      (element) => element.textContent?.includes('Reset Password'),
    ) as HTMLButtonElement | undefined;
    if (!button) {
      throw new Error('Submit button not found');
    }
    return button;
  }

  it('redirects missing tokens back to forgot password with a toast', async () => {
    renderRoute('/reset-password');

    expect(await screen.findByRole('heading', { name: /forgot password/i })).toBeTruthy();
    expect(await screen.findByText(/this reset link is invalid or expired/i)).toBeTruthy();
  });

  it('shows validation errors before submitting', async () => {
    const user = userEvent.setup();
    const view = renderRoute('/reset-password?token=token_123456');

    const { password, confirm } = getPasswordInputs(view.container);
    await user.type(password, 'Password1');
    await user.type(confirm, 'Different1!');
    fireEvent.click(getSubmitButton(view.container));

    expect(await screen.findByText(/must include at least one special character/i)).toBeTruthy();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it.skip('resets password and shows the success state', async () => {
    resetPasswordMock.mockResolvedValueOnce(undefined);
    const view = renderRoute('/reset-password?token=token_123456');

    const { password, confirm } = getPasswordInputs(view.container);
    fireEvent.change(password, { target: { value: 'Password1!' } });
    fireEvent.change(confirm, { target: { value: 'Password1!' } });
    fireEvent.click(getSubmitButton(view.container));

    await waitFor(() => expect(resetPasswordMock).toHaveBeenCalledWith('token_123456', 'Password1!'));
    expect(await screen.findByText(/password updated successfully/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeTruthy();
  });

  it.skip('shows an expired-link banner on invalid token', async () => {
    resetPasswordMock.mockRejectedValueOnce(new ApiError(400, 'TOKEN_INVALID', 'Invalid token.'));
    const view = renderRoute('/reset-password?token=token_123456');

    const { password, confirm } = getPasswordInputs(view.container);
    fireEvent.change(password, { target: { value: 'Password1!' } });
    fireEvent.change(confirm, { target: { value: 'Password1!' } });
    fireEvent.click(getSubmitButton(view.container));

    expect(await screen.findByText(/this reset link has expired\. request a new one\./i)).toBeTruthy();
  });
});
