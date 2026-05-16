import { env } from '@/config/env';

export type ApiMeta = {
  timestamp: string;
  request_id: string;
};

export type ApiErrorPayload = {
  code: string;
  message: string;
  field?: string | null;
};

type ApiSuccessEnvelope<T> = {
  success: true;
  data: T;
  error: null;
  meta: ApiMeta;
};

type ApiFailureEnvelope = {
  success: false;
  data: null;
  error: ApiErrorPayload;
  meta: ApiMeta;
};

type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiFailureEnvelope;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly field?: string | null;
  readonly meta?: ApiMeta;

  constructor(
    status: number,
    code: string,
    message: string,
    field?: string | null,
    meta?: ApiMeta,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
    this.meta = meta;
  }
}

export type LogoutHandler = () => void | Promise<void>;

let refreshPromise: Promise<boolean> | null = null;
let logoutHandler: LogoutHandler | null = null;

export function setAuthLogoutHandler(handler: LogoutHandler | null): void {
  logoutHandler = handler;
}

function buildUrl(path: string): string {
  return new URL(path, env.apiUrl).toString();
}

function buildHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);
  if (!merged.has('Accept')) {
    merged.set('Accept', 'application/json');
  }
  return merged;
}

function asRequestInit(options: RequestInit | undefined, extra?: RequestInit): RequestInit {
  return {
    credentials: 'include',
    ...options,
    ...extra,
    headers: buildHeaders(extra?.headers ?? options?.headers),
  };
}

async function readJsonEnvelope<T>(response: Response): Promise<ApiEnvelope<T> | undefined> {
  if (response.status === 204) {
    return undefined;
  }

  const text = await response.text();
  if (!text) {
    return undefined;
  }

  return JSON.parse(text) as ApiEnvelope<T>;
}

function toApiError(status: number, payload: unknown): ApiError {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const envelope = payload as ApiFailureEnvelope;
    return new ApiError(
      status,
      envelope.error.code,
      envelope.error.message,
      envelope.error.field,
      envelope.meta,
    );
  }

  return new ApiError(status, 'INVALID_RESPONSE', 'Unexpected response from server.');
}

async function refreshSession(): Promise<boolean> {
  const response = await fetch(buildUrl('/v1/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: buildHeaders(),
  });

  return response.ok || response.status === 204;
}

async function runLogoutHandler(): Promise<void> {
  if (logoutHandler) {
    await logoutHandler();
  }
}

async function sendRequest<T>(
  path: string,
  options?: RequestInit,
  alreadyRetried = false,
): Promise<T> {
  const response = await fetch(buildUrl(path), asRequestInit(options));

  if (response.ok) {
    const envelope = await readJsonEnvelope<T>(response);
    if (!envelope || !envelope.success) {
      return undefined as T;
    }
    return envelope.data;
  }

  const parsed = await readJsonEnvelope<T>(response);

  if (response.status === 401 && !alreadyRetried) {
    if (refreshPromise === null) {
      refreshPromise = refreshSession()
        .catch(() => false)
        .finally(() => {
          refreshPromise = null;
        });
    }

    const refreshed = await refreshPromise;
    if (!refreshed) {
      await runLogoutHandler().catch(() => undefined);
      throw toApiError(response.status, parsed);
    }

    const retriedResponse = await fetch(buildUrl(path), asRequestInit(options));
    if (retriedResponse.ok) {
      const retriedEnvelope = await readJsonEnvelope<T>(retriedResponse);
      if (!retriedEnvelope || !retriedEnvelope.success) {
        return undefined as T;
      }
      return retriedEnvelope.data;
    }

    if (retriedResponse.status === 401) {
      await runLogoutHandler().catch(() => undefined);
    }

    const retriedParsed = await readJsonEnvelope<T>(retriedResponse);
    throw toApiError(retriedResponse.status, retriedParsed);
  }

  throw toApiError(response.status, parsed);
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  return sendRequest<T>(path, options);
}
