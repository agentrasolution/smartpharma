import { StyleSheet, Text, View } from 'react-native';

import { useThemeColor } from '@/constants/useThemeColor';

interface RevenueBarsProps {
  data?: { day: string; revenue: number }[];
}

export function RevenueBars({ data = [] }: RevenueBarsProps) {
  const theme = useThemeColor();
  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <View style={styles.container}>
      {data.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textSecondary }]}>No revenue data yet</Text>
      ) : (
        data.map((item, i) => {
          const height = Math.max((item.revenue / max) * 120, 4);
          const isToday = i === data.length - 1;
          return (
            <View key={item.day + i} style={styles.col}>
              <Text style={[styles.value, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.revenue > 0 ? compact(item.revenue) : ''}
              </Text>
              <View
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor: isToday ? theme.accent : `${theme.accent}66`,
                  },
                ]}
              />
              <Text style={[styles.day, { color: theme.textSecondary }]} numberOfLines={1}>
                {item.day.slice(0, 3)}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

function compact(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    minHeight: 160,
    paddingTop: 10,
  },
  col: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  bar: {
    width: '100%',
    maxWidth: 34,
    borderRadius: 6,
  },
  value: {
    fontSize: 9,
  },
  day: {
    fontSize: 10,
    fontWeight: '600',
  },
  empty: {
    fontSize: 13,
    textAlign: 'center',
    width: '100%',
  },
});