import { env } from '@/config/env';

export function getGoogleOAuthAuthorizeUrl() {
  return `${env.apiUrl}/v1/auth/google/authorize`;
}
