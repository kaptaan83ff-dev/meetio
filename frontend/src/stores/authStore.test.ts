import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/apiClient';

const loginMock = vi.fn();
const logoutMock = vi.fn();
const apiRequestMock = vi.fn();

vi.mock('@/lib/authApi', () => ({
  login: (...args: unknown[]) => loginMock(...args),
  logout: (...args: unknown[]) => logoutMock(...args),
  getSession: (...args: unknown[]) => apiRequestMock('/v1/auth/session', ...args),
}));

vi.mock('@/lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('@/lib/apiClient')>('@/lib/apiClient');
  return {
    ...actual,
    apiRequest: (...args: unknown[]) => apiRequestMock(...args),
    setAuthLogoutHandler: vi.fn(),
  };
});

describe('useAuthStore', () => {
  beforeEach(async () => {
    loginMock.mockReset();
    logoutMock.mockReset();
    apiRequestMock.mockReset();

    const { useAuthStore } = await import('./authStore');
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
    });
  });

  it('logs in and populates the current user on success', async () => {
    loginMock.mockResolvedValue(undefined);
    apiRequestMock.mockResolvedValue({
      id: 'usr_123',
      user_id: 'usr_123',
      display_name: 'MeetIO User',
      email: 'user@example.com',
      avatar_url: null,
      avatar_type: null,
      timezone: 'UTC',
      language: 'en',
      providers: ['email'],
    });

    const { useAuthStore } = await import('./authStore');
    const result = await useAuthStore.getState().login('user@example.com', 'Password123');

    expect(result).toBeUndefined();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe('user@example.com');
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('returns a 2FA challenge without authenticating the user', async () => {
    loginMock.mockResolvedValue({
      requires_2fa: true,
      totp_session_id: 'totp_123',
    });

    const { useAuthStore } = await import('./authStore');
    const result = await useAuthStore.getState().login('user@example.com', 'Password123');

    expect(result).toEqual({
      requires_2fa: true,
      totp_session_id: 'totp_123',
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('maps invalid credentials to a user-facing error', async () => {
    loginMock.mockRejectedValue(new ApiError(401, 'LOGIN_BAD_CREDENTIALS', 'Invalid credentials.'));

    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().login('user@example.com', 'bad-password');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().error).toBe('Invalid email or password');
  });

  it('clears local state even if logout fails', async () => {
    logoutMock.mockRejectedValue(new Error('network down'));

    const { useAuthStore } = await import('./authStore');
    useAuthStore.setState({
      user: {
        id: 'usr_123',
        user_id: 'usr_123',
        display_name: 'MeetIO User',
        email: 'user@example.com',
        avatar_url: null,
        avatar_type: null,
        timezone: 'UTC',
        language: 'en',
        providers: ['email'],
      },
      isAuthenticated: true,
      isLoading: false,
      error: 'Previous error',
    });

    await useAuthStore.getState().logout();

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().error).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('rehydrates the user and stops loading', async () => {
    apiRequestMock.mockResolvedValue({
      authenticated: true,
      user: {
        id: 'usr_123',
        display_name: 'MeetIO User',
        email: 'user@example.com',
        avatar_url: null,
        avatar_type: null,
        timezone: 'UTC',
        language: 'en',
        providers: ['email'],
      },
    });

    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().initAuth();

    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.email).toBe('user@example.com');
    expect(useAuthStore.getState().user?.user_id).toBe('usr_123');
  });

  it('treats a 401 on rehydrate as logged out', async () => {
    apiRequestMock.mockRejectedValue(new ApiError(401, 'TOKEN_INVALID', 'Unauthorized.'));

    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().initAuth();

    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('treats an anonymous session response as logged out without an error', async () => {
    apiRequestMock.mockResolvedValue({
      authenticated: false,
      user: null,
    });

    const { useAuthStore } = await import('./authStore');
    await useAuthStore.getState().initAuth();

    expect(useAuthStore.getState().isLoading).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().error).toBeNull();
  });
});
