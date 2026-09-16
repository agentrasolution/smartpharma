import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';

export type StatTone = 'accent' | 'danger' | 'warning' | 'info' | 'success';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: StatTone;
  subtitle?: string;
  onPress?: () => void;
}

export function StatCard({ title, value, icon, tone = 'accent', subtitle, onPress }: StatCardProps) {
  const theme = useThemeColor();
  const toneColor = theme[tone === 'accent' ? 'accent' : tone];

  const body = (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${toneColor}1A` }]}>
          <Ionicons name={icon} size={18} color={toneColor} />
        </View>
      </View>
      <Text style={[styles.value, { color: theme.text, fontFamily: Fonts.mono }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.title, { color: theme.textSecondary }]} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.mutedFg }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {body}
      </Pressable>
    );
  }
  return body;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
  },
  title: {
    fontSize: 12,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 11,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});