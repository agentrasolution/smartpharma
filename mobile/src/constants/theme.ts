import '@/global.css';

import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F5F7F9',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#64748B',
    surface: '#FFFFFF',
    surface2: '#F8FAFC',
    accent: '#0D9488',
    accentHover: '#0F766E',
    accentFg: '#FFFFFF',
    danger: '#DC2626',
    success: '#16A34A',
    warning: '#D97706',
    info: '#2563EB',
    border: '#E2E8F0',
    borderStrong: '#CBD5E1',
    muted: '#F8FAFC',
    mutedFg: '#94A3B8',
  },
  dark: {
    text: '#F8FAFC',
    background: '#0F172A',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#94A3B8',
    surface: '#111827',
    surface2: '#1E293B',
    accent: '#14B8A6',
    accentHover: '#2DD4BF',
    accentFg: '#0F172A',
    danger: '#EF4444',
    success: '#22C55E',
    warning: '#F59E0B',
    info: '#3B82F6',
    border: '#334155',
    borderStrong: '#475569',
    muted: '#1E293B',
    mutedFg: '#94A3B8',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light;

export const AppTheme: { light: Theme; dark: Theme } = {
  light: {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: Colors.light.accent,
      background: Colors.light.background,
      card: Colors.light.surface,
      text: Colors.light.text,
      border: Colors.light.border,
      notification: Colors.light.danger,
    },
  },
  dark: {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: Colors.dark.accent,
      background: Colors.dark.background,
      card: Colors.dark.surface,
      text: Colors.dark.text,
      border: Colors.dark.border,
      notification: Colors.dark.danger,
    },
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export type ColorsType = typeof Colors.light;
