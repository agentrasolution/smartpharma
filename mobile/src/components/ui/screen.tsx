import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColor } from '@/constants/useThemeColor';
import { Spacing } from '@/constants/theme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
}

export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
  keyboardShouldPersistTaps = 'handled',
}: ScreenProps) {
  const theme = useThemeColor();

  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }, style]} edges={['top']}>
        <View style={[styles.content, contentStyle]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }, style]} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.content, contentStyle]}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
});