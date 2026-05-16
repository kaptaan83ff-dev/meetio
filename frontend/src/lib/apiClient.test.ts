import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

vi.mock('@/config/env', () => ({
  env: {
    apiUrl: 'http://api.test',
    wsUrl: 'ws://ws.test',
    livekitUrl: '',
    googleClientId: '',
    appEnv: 'test',
    sentryDsn: '',
  },
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => server.close());

function envelope<T>(data: T) {
  return HttpResponse.json({
    success: true,
    data,
    error: null,
    meta: {
      timestamp: '2026-05-16T00:00:00Z',
      request_id: 'req_test',
    },
  });
}

function failure(code: string, message: string, status = 401) {
  return HttpResponse.json(
    {
      success: false,
      data: null,
      error: { code, message, field: null },
      meta: {
        timestamp: '2026-05-16T00:00:00Z',
        request_id: 'req_test',
      },
    },
    { status },
  );
}

describe('apiRequest', () => {
  it('refreshes once and retries a 401 response', async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;

    server.use(
      http.get('http://api.test/v1/protected', () => {
        protectedCalls += 1;
        if (protectedCalls === 1) {
          return failure('TOKEN_INVALID', 'Token expired.');
        }
        return envelope({ ok: true });
      }),
      http.post('http://api.test/v1/auth/refresh', () => {
        refreshCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { apiRequest } = await import('./apiClient');
    const result = await apiRequest<{ ok: boolean }>('/v1/protected');

    expect(result).toEqual({ ok: true });
    expect(protectedCalls).toBe(2);
    expect(refreshCalls).toBe(1);
  });

  it('uses a single refresh mutex for concurrent 401s', async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;

    server.use(
      http.get('http://api.test/v1/protected-concurrent', () => {
        protectedCalls += 1;
        if (protectedCalls <= 4) {
          return failure('TOKEN_INVALID', 'Token expired.');
        }
        return envelope({ ok: true });
      }),
      http.post('http://api.test/v1/auth/refresh', () => {
        refreshCalls += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { apiRequest } = await import('./apiClient');
    const results = await Promise.all(
      Array.from({ length: 4 }, () => apiRequest<{ ok: boolean }>('/v1/protected-concurrent')),
    );

    expect(results).toEqual([
      { ok: true },
      { ok: true },
      { ok: true },
      { ok: true },
    ]);
    expect(protectedCalls).toBe(8);
    expect(refreshCalls).toBe(1);
  });

  it('calls the logout handler on a persistent 401', async () => {
    const logoutHandler = vi.fn();

    server.use(
      http.get('http://api.test/v1/protected-logout', () => failure('TOKEN_INVALID', 'Invalid token.')),
      http.post('http://api.test/v1/auth/refresh', () => new HttpResponse(null, { status: 204 })),
    );

    const { apiRequest, setAuthLogoutHandler } = await import('./apiClient');
    setAuthLogoutHandler(logoutHandler);

    await expect(apiRequest('/v1/protected-logout')).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
      status: 401,
    });
    expect(logoutHandler).toHaveBeenCalledTimes(1);
  });

  it('does not retry original request when refresh fails', async () => {
    let protectedCalls = 0;
    const logoutHandler = vi.fn();

    server.use(
      http.get('http://api.test/v1/protected-refresh-fail', () => {
        protectedCalls += 1;
        return failure('TOKEN_INVALID', 'Invalid token.');
      }),
      http.post('http://api.test/v1/auth/refresh', () => failure('TOKEN_INVALID', 'Refresh failed.')),
    );

    const { apiRequest, setAuthLogoutHandler } = await import('./apiClient');
    setAuthLogoutHandler(logoutHandler);

    await expect(apiRequest('/v1/protected-refresh-fail')).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
      status: 401,
    });
    expect(protectedCalls).toBe(1);
    expect(logoutHandler).toHaveBeenCalledTimes(1);
  });
});
