import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { useThemeColor } from '@/constants/useThemeColor';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

interface BadgeProps {
  tone?: BadgeTone;
  label: string;
  style?: StyleProp<TextStyle>;
}

export function Badge({ tone = 'neutral', label, style }: BadgeProps) {
  const theme = useThemeColor();
  const toneColor = {
    success: theme.success,
    warning: theme.warning,
    danger: theme.danger,
    info: theme.info,
    neutral: theme.textSecondary,
    accent: theme.accent,
  }[tone];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: `${toneColor}1A`,
          borderColor: `${toneColor}33`,
        },
      ]}>
      <Text style={[styles.text, { color: toneColor }, style]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});