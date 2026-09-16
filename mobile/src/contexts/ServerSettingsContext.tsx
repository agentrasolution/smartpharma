import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { runtime } from '@/lib/runtime';
import { deleteItem, getJson, setJson } from '@/lib/storage';

interface ServerSettingsValue {
  baseUrl: string;
  isLoading: boolean;
  setBaseUrl: (url: string) => Promise<void>;
}

const ServerSettingsContext = createContext<ServerSettingsValue | null>(null);

const STORAGE_KEY = 'faraz_server_url';
const DEFAULT_URL = 'http://localhost:3001';

function resolveDefaultUrl(): string {
  if (Platform.OS === 'web') return DEFAULT_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:3001`;
  return DEFAULT_URL;
}

function isLocalHostname(url: string): boolean {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url);
}

function resolveEffectiveUrl(stored?: string): string {
  if (!stored) return resolveDefaultUrl();
  if (Platform.OS !== 'web' && isLocalHostname(stored)) return resolveDefaultUrl();
  return stored;
}

export function ServerSettingsProvider({ children }: { children: ReactNode }) {
  const [baseUrl, setBaseUrlState] = useState(resolveDefaultUrl());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getJson<{ url: string }>(STORAGE_KEY)
      .then((saved) => {
        const url = resolveEffectiveUrl(saved?.url?.trim());
        runtime.baseUrl = url;
        setBaseUrlState(url);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const setBaseUrl = async (url: string) => {
    const clean = url.trim().replace(/\/+$/, '');
    runtime.baseUrl = clean;
    setBaseUrlState(clean);
    await setJson(STORAGE_KEY, { url: clean });
  };

  return (
    <ServerSettingsContext.Provider value={{ baseUrl, isLoading, setBaseUrl }}>
      {children}
    </ServerSettingsContext.Provider>
  );
}

export function useServerSettings() {
  const ctx = useContext(ServerSettingsContext);
  if (!ctx) throw new Error('useServerSettings must be used within ServerSettingsProvider');
  return ctx;
}