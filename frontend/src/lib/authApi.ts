import { apiRequest } from '@/lib/apiClient';

export type LoginResult = {
  message?: string;
  requires_2fa?: boolean;
  totp_session_id?: string;
};

export type AuthSession<TUser = unknown> = {
  authenticated: boolean;
  user: TUser | null;
};

export async function register(email: string, password: string, displayName: string) {
  return apiRequest('/v1/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      display_name: displayName,
    }),
  });
}

export async function login(email: string, password: string): Promise<LoginResult> {
  return apiRequest<LoginResult>('/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      username: email,
      password,
    }),
  });
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/v1/auth/logout', {
    method: 'POST',
  });
}

export async function getSession<TUser = unknown>(): Promise<AuthSession<TUser>> {
  return apiRequest<AuthSession<TUser>>('/v1/auth/session');
}

export async function forgotPassword(email: string) {
  return apiRequest('/v1/auth/forgot-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string) {
  return apiRequest('/v1/auth/reset-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token, password }),
  });
}

export async function verifyEmail(token: string) {
  return apiRequest('/v1/auth/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token }),
  });
}

export async function requestVerifyToken(email: string) {
  return apiRequest('/v1/auth/request-verify-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
}

export async function refreshToken() {
  return apiRequest('/v1/auth/refresh', {
    method: 'POST',
  });
}

export async function verify2FA(totpSessionId: string, code: string) {
  return apiRequest('/v1/auth/2fa/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      totp_session_id: totpSessionId,
      code,
    }),
  });
}
