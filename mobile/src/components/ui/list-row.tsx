import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';

interface ListRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  last?: boolean;
}

export function ListRow({ icon, iconColor, title, subtitle, right, onPress, chevron, last }: ListRowProps) {
  const theme = useThemeColor();
  const iconBg = iconColor ? `${iconColor}1A` : theme.surface2;

  const body = (
    <>
      {icon ? (
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={iconColor ?? theme.accent} />
        </View>
      ) : null}
      <View style={styles.textWrap}>
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.sans }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
      {chevron && !right ? <Ionicons name="chevron-forward" size={18} color={theme.mutedFg} /> : null}
    </>
  );

  const content = (
    <View style={[styles.row, !last && { borderBottomWidth: 1, borderBottomColor: theme.border }]}>{body}</View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12,
  },
  right: {
    alignItems: 'flex-end',
  },
});