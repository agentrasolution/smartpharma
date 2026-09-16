import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, useThemeColor } from '@/constants/useThemeColor';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon = 'file-tray-outline', title, subtitle, children }: EmptyStateProps) {
  const theme = useThemeColor();
  return (
    <View style={styles.container}>
      <View style={[styles.iconWrap, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
        <Ionicons name={icon} size={28} color={theme.mutedFg} />
      </View>
      <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.sans }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 8,
    paddingHorizontal: 24,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
});