/**
 * Frontend environment configuration.
 * Single source of truth for all VITE_ prefixed environment variables.
 */

export const env = {
  apiUrl: import.meta.env.VITE_API_URL as string,
  wsUrl: import.meta.env.VITE_WS_URL as string,
  livekitUrl: import.meta.env.VITE_LIVEKIT_URL as string,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string,
  appEnv: (import.meta.env.VITE_APP_ENV || 'development') as 'development' | 'staging' | 'production' | 'test',
  sentryDsn: import.meta.env.VITE_SENTRY_DSN as string,
} as const;

// Runtime validation
if (import.meta.env.MODE !== 'test' && (env.appEnv === 'development' || env.appEnv === 'staging')) {
  if (!env.apiUrl || !env.wsUrl || !env.googleClientId) {
    console.error('Environment Error: VITE_API_URL, VITE_WS_URL, and VITE_GOOGLE_CLIENT_ID must be set.');
  }
}

export default env;
