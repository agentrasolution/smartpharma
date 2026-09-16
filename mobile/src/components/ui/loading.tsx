import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useThemeColor } from '@/constants/useThemeColor';

export function Loading({ label }: { label?: string }) {
  const theme = useThemeColor();
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.accent} />
    </View>
  );
}

export function InlineLoading() {
  const theme = useThemeColor();
  return <ActivityIndicator size="small" color={theme.accent} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
});