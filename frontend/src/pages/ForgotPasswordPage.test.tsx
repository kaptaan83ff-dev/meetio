// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen } from '@testing-library/react';

import ForgotPasswordPage from './ForgotPasswordPage';
import { ToastViewport } from '@/components/toast/ToastViewport';

const forgotPasswordMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/authApi', () => ({
  forgotPassword: forgotPasswordMock,
}));

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    forgotPasswordMock.mockReset();
    vi.useRealTimers();
  });

  function getEmailInput(): HTMLInputElement {
    const input = document.querySelector('input[type="email"]');
    if (!input) {
      throw new Error('Email input not found');
    }
    return input as HTMLInputElement;
  }

  function getSubmitButton(): HTMLButtonElement {
    const button = document.querySelector('form button[type="submit"]');
    if (!button) {
      throw new Error('Submit button not found');
    }
    return button as HTMLButtonElement;
  }

  it('validates email and blocks submission', async () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
        <ToastViewport />
      </MemoryRouter>,
    );

    fireEvent.change(getEmailInput(), { target: { value: 'not-an-email' } });
    fireEvent.blur(getEmailInput());
    fireEvent.submit(document.querySelector('form')!);

    expect(await screen.findByText(/enter a valid email address/i)).toBeTruthy();
    expect(forgotPasswordMock).not.toHaveBeenCalled();
    expect(getSubmitButton().disabled).toBe(true);
  });

  it('shows the confirmation flow after submit and starts cooldown', async () => {
    forgotPasswordMock.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
        <ToastViewport />
      </MemoryRouter>,
    );

    fireEvent.change(getEmailInput(), { target: { value: '  person@example.com  ' } });
    fireEvent.submit(document.querySelector('form')!);

    expect(forgotPasswordMock).toHaveBeenCalledWith('person@example.com');
    expect(await screen.findByText(/^If that email is registered, a reset link has been sent\.$/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /resend in 60s/i }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('person@example.com')).toBeTruthy();
  });

  it('counts down the resend cooldown', async () => {
    forgotPasswordMock.mockResolvedValueOnce(undefined);

    render(
      <MemoryRouter>
        <ForgotPasswordPage />
        <ToastViewport />
      </MemoryRouter>,
    );

    fireEvent.change(getEmailInput(), { target: { value: 'reset@example.com' } });
    fireEvent.submit(document.querySelector('form')!);

    expect((await screen.findByRole('button', { name: /resend in 60s/i }) as HTMLButtonElement).disabled).toBe(true);
  });
});
