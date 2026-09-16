import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      typeof localStorage !== 'undefined' && localStorage.setItem(key, value);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      typeof localStorage !== 'undefined' && localStorage.removeItem(key);
    } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setJson(key: string, value: unknown): Promise<void> {
  await setItem(key, JSON.stringify(value));
}