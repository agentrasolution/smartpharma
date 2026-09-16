import { useColorScheme } from 'react-native';

import { Colors, Fonts, Spacing, type ColorsType } from '@/constants/theme';

export function useThemeColor(): ColorsType {
  const scheme = useColorScheme();
  return Colors[scheme === 'dark' ? 'dark' : 'light'] as ColorsType;
}

export { Fonts, Spacing };