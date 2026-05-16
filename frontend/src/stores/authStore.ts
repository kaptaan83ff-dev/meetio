import { create } from 'zustand';

import { ApiError, apiRequest, setAuthLogoutHandler } from '@/lib/apiClient';
import * as authApi from '@/lib/authApi';

export type User = {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  avatar_type: string | null;
  timezone: string;
  language: string;
  providers: string[];
};

export type LoginChallenge = {
  requires_2fa: true;
  totp_session_id: string;
};

type AuthError = string | null;

type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: AuthError;
  login: (email: string, password: string) => Promise<LoginChallenge | void>;
  logout: () => Promise<void>;
  fetchCurrentUser: () => Promise<User | null>;
  initAuth: () => Promise<void>;
  clearAuthState: () => void;
};

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

type CurrentUserPayload = Omit<User, 'id' | 'user_id'> & {
  id?: string;
  user_id?: string;
};

let initAuthPromise: Promise<void> | null = null;
let authSyncInitialized = false;

const AUTH_SYNC_KEY = 'meetio:auth-sync';
const TAB_ID = Math.random().toString(36).slice(2);

type AuthSyncMessage = {
  type: 'login' | 'logout';
  tabId: string;
  timestamp: number;
};

function getLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.code === 'LOGIN_BAD_CREDENTIALS' || error.code === 'INVALID_CREDENTIALS') {
      return 'Invalid email or password';
    }
    if (error.message) {
      return error.message;
    }
  }

  return 'Something went wrong';
}

function isTwoFactorChallenge(result: unknown): result is LoginChallenge {
  return Boolean(
    result &&
      typeof result === 'object' &&
      'requires_2fa' in result &&
      (result as Record<string, unknown>).requires_2fa === true &&
      typeof (result as Record<string, unknown>).totp_session_id === 'string',
  );
}

function normalizeUser(user: CurrentUserPayload): User {
  const id = user.id ?? user.user_id;
  if (!id) {
    throw new Error('Authenticated user is missing an id.');
  }

  return {
    ...user,
    id,
    user_id: id,
  };
}

function broadcastAuthSync(type: AuthSyncMessage['type']) {
  if (typeof window === 'undefined') {
    return;
  }

  const message: AuthSyncMessage = {
    type,
    tabId: TAB_ID,
    timestamp: Date.now(),
  };

  window.localStorage.setItem(AUTH_SYNC_KEY, JSON.stringify(message));

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(AUTH_SYNC_KEY);
    channel.postMessage(message);
    channel.close();
  }
}

function handleAuthSyncMessage(message: AuthSyncMessage | null) {
  if (!message || message.tabId === TAB_ID) {
    return;
  }

  if (message.type === 'logout') {
    useAuthStore.getState().clearAuthState();
    return;
  }

  void useAuthStore.getState().initAuth();
}

function setupAuthSync() {
  if (authSyncInitialized || typeof window === 'undefined') {
    return;
  }

  authSyncInitialized = true;

  window.addEventListener('storage', (event) => {
    if (event.key !== AUTH_SYNC_KEY || !event.newValue) {
      return;
    }

    try {
      handleAuthSyncMessage(JSON.parse(event.newValue) as AuthSyncMessage);
    } catch {
      // Ignore malformed cross-tab sync payloads.
    }
  });

  if ('BroadcastChannel' in window) {
    const channel = new BroadcastChannel(AUTH_SYNC_KEY);
    channel.addEventListener('message', (event) => {
      handleAuthSyncMessage(event.data as AuthSyncMessage);
    });
  }
}

export const useAuthStore = create<AuthState>()((set, get) => {
  const clearAuthState = () => {
    set({
      user: null,
      isAuthenticated: false,
      error: null,
    });
  };

  setAuthLogoutHandler(clearAuthState);

  return {
    ...initialState,
    clearAuthState,
    login: async (email: string, password: string) => {
      set({ isLoading: true, error: null });

      try {
        const result = await authApi.login(email, password);
        if (isTwoFactorChallenge(result)) {
          set({
            isAuthenticated: false,
            user: null,
            error: null,
          });
          return result;
        }

        const currentUser = await get().fetchCurrentUser();
        set({
          user: currentUser,
          isAuthenticated: true,
          error: null,
        });
        return;
      } catch (error) {
        set({
          user: null,
          isAuthenticated: false,
          error: getLoginErrorMessage(error),
        });
        return;
      } finally {
        set({ isLoading: false });
      }
    },
    logout: async () => {
      set({ isLoading: true });
      try {
        await authApi.logout();
      } catch {
        // local state is cleared regardless of network failures
      } finally {
        clearAuthState();
        broadcastAuthSync('logout');
        set({ isLoading: false });
      }
    },
    fetchCurrentUser: async () => {
      try {
        const currentUser = normalizeUser(await apiRequest<CurrentUserPayload>('/v1/auth/me'));
        set({
          user: currentUser,
          isAuthenticated: true,
          error: null,
        });
        broadcastAuthSync('login');
        return currentUser;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          clearAuthState();
          return null;
        }

        throw error;
      }
    },
    initAuth: async () => {
      if (!initAuthPromise) {
        initAuthPromise = (async () => {
          set({ isLoading: true });
          try {
            const session = await authApi.getSession<CurrentUserPayload>();
            if (!session.authenticated || !session.user) {
              clearAuthState();
              return;
            }

            set({
              user: normalizeUser(session.user),
              isAuthenticated: true,
              error: null,
            });
          } catch {
            // keep the app usable even if the rehydrate call fails
          } finally {
            set({ isLoading: false });
          }
        })();
        initAuthPromise.finally(() => {
          initAuthPromise = null;
        });
      }

      await initAuthPromise;
    },
  };
});

setupAuthSync();

export type { AuthState };
