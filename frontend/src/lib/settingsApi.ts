import { apiRequest } from '@/lib/apiClient';

export type TwoFactorAction = 'enable' | 'disable';

export type TwoFactorActionResponse = {
  totp_secret?: string;
  qr_code_url?: string;
  message?: string;
};

export type SettingsPayload = Record<string, unknown>;

export async function enable2FA(): Promise<TwoFactorActionResponse> {
  return apiRequest<TwoFactorActionResponse>('/v1/settings/2fa', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'enable' satisfies TwoFactorAction }),
  });
}

export async function disable2FA(): Promise<TwoFactorActionResponse> {
  return apiRequest<TwoFactorActionResponse>('/v1/settings/2fa', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'disable' satisfies TwoFactorAction }),
  });
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest('/v1/settings/password', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

export async function updateSettings(payload: SettingsPayload) {
  return apiRequest('/v1/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

export async function getSettings() {
  return apiRequest('/v1/settings');
}

export async function getLinkedAccounts() {
  return apiRequest('/v1/settings/linked-accounts');
}

export async function deleteLinkedAccount(provider: string) {
  return apiRequest(`/v1/settings/linked-accounts/${encodeURIComponent(provider)}`, {
    method: 'DELETE',
  });
}
