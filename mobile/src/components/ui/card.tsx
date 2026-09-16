import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

interface SectionTitleProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Card({ children, style, padded = true }: CardProps) {
  const theme = useThemeColor();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        padded && styles.padded,
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionTitle({ title, subtitle, action }: SectionTitleProps) {
  const theme = useThemeColor();
  return (
    <View style={styles.titleRow}>
      <View style={styles.titleText}>
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.sans }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
  },
  padded: {
    padding: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  titleText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
});