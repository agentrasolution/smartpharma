import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { api } from "@/lib/api";

interface User {
  id: string;
  username: string;
  role: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const tokens = loadTokens();
    const userStr = localStorage.getItem("faraz_user");
    const user = userStr ? JSON.parse(userStr) : null;
    return { user, ...tokens };
  });

  const refreshAccessToken = useCallback(async () => {
    const stored = loadTokens().refreshToken;
    if (!stored) return false;

    try {
      const res = await api.auth.refresh(stored);
      saveTokens(res.accessToken, res.refreshToken);
      localStorage.setItem("faraz_user", JSON.stringify(res.user));
      setState({ user: res.user, accessToken: res.accessToken, refreshToken: res.refreshToken });
      return true;
    } catch {
      clearTokens();
      setState({ user: null, accessToken: null, refreshToken: null });
      return false;
    }
  }, []);

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
        localStorage.setItem("faraz_user", JSON.stringify(res.user));
        setState((prev) => ({ ...prev, accessToken: res.accessToken }));
      } catch {
        clearTokens();
        setState({ user: null, accessToken: null, refreshToken: null });
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [state.refreshToken]);

  const login = async (username: string, password: string): Promise<string | null> => {
    try {
      const res = await api.auth.login(username, password);
      saveTokens(res.accessToken, res.refreshToken);
      localStorage.setItem("faraz_user", JSON.stringify(res.user));
      setState({ user: res.user, accessToken: res.accessToken, refreshToken: res.refreshToken });
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Login failed";
    }
  };

  const logout = async () => {
    try {
      if (state.accessToken) {
        await api.auth.logout(state.accessToken);
      }
    } catch {}
    clearTokens();
    setState({ user: null, accessToken: null, refreshToken: null });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, isAuthenticated: !!state.user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
