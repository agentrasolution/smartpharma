import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { api, configureApi } from '@/lib/api';
import { runtime } from '@/lib/runtime';
import { deleteItem, getJson, setJson } from '@/lib/storage';
import type { AuthUser, RegisterInput } from '@/types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<string | null>;
  register: (input: RegisterInput) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  subscriptionBlocked: boolean;
  clearSubscriptionBlocked: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'faraz_access_token';
const REFRESH_KEY = 'faraz_refresh_token';
const USER_KEY = 'faraz_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, accessToken: null, refreshToken: null });
  const [ready, setReady] = useState(false);
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);
  const clearRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const stateRef = useRef(state);
  stateRef.current = state;

  configureApi({
    getToken: () => runtime.token,
    onUnauthorized: () => void clearRef.current(),
    onSubscriptionBlocked: () => {
      setSubscriptionBlocked(true);
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [accessToken, refreshToken, user] = await Promise.all([
        getJson<{ v: string }>(TOKEN_KEY),
        getJson<{ v: string }>(REFRESH_KEY),
        getJson<AuthUser>(USER_KEY),
      ]);
      if (cancelled) return;
      runtime.token = accessToken?.v ?? null;
      setState({
        user: user ?? null,
        accessToken: accessToken?.v ?? null,
        refreshToken: refreshToken?.v ?? null,
      });
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    runtime.token = state.accessToken;
  }, [state.accessToken]);

  const clear = useCallback(async () => {
    runtime.token = null;
    await Promise.all([deleteItem(TOKEN_KEY), deleteItem(REFRESH_KEY), deleteItem(USER_KEY)]);
    setState({ user: null, accessToken: null, refreshToken: null });
  }, []);
  clearRef.current = clear;

  const setSession = useCallback((auth: { accessToken: string; refreshToken: string; user: AuthUser }) => {
    runtime.token = auth.accessToken;
    setState({ user: auth.user, accessToken: auth.accessToken, refreshToken: auth.refreshToken });
    void setJson(TOKEN_KEY, { v: auth.accessToken });
    void setJson(REFRESH_KEY, { v: auth.refreshToken });
    void setJson(USER_KEY, auth.user);
  }, []);

  useEffect(() => {
    if (!state.refreshToken) {
      return;
    }
    const refresh = async () => {
      try {
        const res = await api.auth.refresh(stateRef.current.refreshToken!);
        setSession(res);
      } catch {
        void clear();
      }
    };
    const interval = setInterval(refresh, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, [state.refreshToken, setSession, clear]);

  const login = useCallback(
    async (username: string, password: string): Promise<string | null> => {
      try {
        const res = await api.auth.login(username, password);
        setSession(res);
        setSubscriptionBlocked(false);
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : 'Login failed';
      }
    },
    [setSession]
  );

  const register = useCallback(
    async (input: RegisterInput): Promise<string | null> => {
      try {
        const res = await api.auth.register(input);
        setSession(res);
        setSubscriptionBlocked(false);
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : 'Registration failed';
      }
    },
    [setSession]
  );

  const refreshUser = useCallback(async () => {
    if (!stateRef.current.accessToken) return;
    try {
      const user = await api.auth.me();
      setState((prev) => ({ ...prev, user }));
      void setJson(USER_KEY, user);
    } catch {}
  }, []);

  const logout = useCallback(async () => {
    try {
      if (stateRef.current.accessToken) {
        await api.auth.logout(stateRef.current.accessToken);
      }
    } catch {}
    await clear();
    setSubscriptionBlocked(false);
  }, [clear]);

  if (!ready) return null;

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshUser,
        isAuthenticated: !!state.user,
        subscriptionBlocked,
        clearSubscriptionBlocked: () => setSubscriptionBlocked(false),
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}