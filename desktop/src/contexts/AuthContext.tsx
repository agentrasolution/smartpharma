import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { AuthUser, RegisterInput } from "@/types";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<string | null>;
  register: (input: RegisterInput) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  subscriptionBlocked: boolean;
  clearSubscriptionBlocked: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

function loadTokens() {
  return {
    accessToken: localStorage.getItem("faraz_access_token"),
    refreshToken: localStorage.getItem("faraz_refresh_token"),
  };
}

function saveTokens(accessToken: string | null, refreshToken: string | null) {
  if (accessToken) localStorage.setItem("faraz_access_token", accessToken);
  else localStorage.removeItem("faraz_access_token");
  if (refreshToken) localStorage.setItem("faraz_refresh_token", refreshToken);
  else localStorage.removeItem("faraz_refresh_token");
}

function clearTokens() {
  localStorage.removeItem("faraz_access_token");
  localStorage.removeItem("faraz_refresh_token");
  localStorage.removeItem("faraz_user");
}

function saveUser(user: AuthUser | null) {
  if (user) localStorage.setItem("faraz_user", JSON.stringify(user));
  else localStorage.removeItem("faraz_user");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const tokens = loadTokens();
    const userStr = localStorage.getItem("faraz_user");
    const user = userStr ? JSON.parse(userStr) : null;
    return { user, ...tokens };
  });
  const [subscriptionBlocked, setSubscriptionBlocked] = useState(false);

  const applyAuth = useCallback((user: AuthUser, accessToken: string, refreshToken: string) => {
    saveTokens(accessToken, refreshToken);
    saveUser(user);
    setState({ user, accessToken, refreshToken });
  }, []);

  const refreshAccessToken = useCallback(async () => {
    const stored = loadTokens().refreshToken;
    if (!stored) return false;

    try {
      const res = await api.auth.refresh(stored);
      applyAuth(res.user, res.accessToken, res.refreshToken);
      return true;
    } catch {
      clearTokens();
      setState({ user: null, accessToken: null, refreshToken: null });
      return false;
    }
  }, [applyAuth]);

  useEffect(() => {
    if (state.refreshToken) return;
    refreshAccessToken();
  }, [refreshAccessToken, state.refreshToken]);

  useEffect(() => {
    if (!state.refreshToken) return;

    const interval = setInterval(async () => {
      try {
        const res = await api.auth.refresh(state.refreshToken!);
        saveTokens(res.accessToken, res.refreshToken);
        saveUser(res.user);
        setState((prev) => ({ ...prev, accessToken: res.accessToken }));
      } catch {
        clearTokens();
        setState({ user: null, accessToken: null, refreshToken: null });
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [state.refreshToken]);

  useEffect(() => {
    const onBlocked = () => setSubscriptionBlocked(true);
    window.addEventListener("subscription:blocked", onBlocked);
    return () => window.removeEventListener("subscription:blocked", onBlocked);
  }, []);

  const login = async (username: string, password: string): Promise<string | null> => {
    try {
      const res = await api.auth.login(username, password);
      applyAuth(res.user, res.accessToken, res.refreshToken);
      setSubscriptionBlocked(false);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Login failed";
    }
  };

  const register = async (input: RegisterInput): Promise<string | null> => {
    try {
      const res = await api.auth.register(input);
      applyAuth(res.user, res.accessToken, res.refreshToken);
      setSubscriptionBlocked(false);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Registration failed";
    }
  };

  const refreshUser = async () => {
    if (!state.accessToken) return;
    try {
      const user = await api.auth.me();
      saveUser(user);
      setState((prev) => ({ ...prev, user }));
    } catch {}
  };

  const logout = async () => {
    try {
      if (state.accessToken) {
        await api.auth.logout(state.accessToken);
      }
    } catch {}
    clearTokens();
    setState({ user: null, accessToken: null, refreshToken: null });
    setSubscriptionBlocked(false);
  };

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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}