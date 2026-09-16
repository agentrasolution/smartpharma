import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Arrear } from '@/types';

type Filter = 'all' | 'pending' | 'paid';

export default function ArrearsScreen() {
  const theme = useThemeColor();
  const [filter, setFilter] = useState<Filter>('all');
  const { data: all = [], loading, refetch } = useApi(() => api.arrears.list());

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const arrears: Arrear[] = all.filter((a) => filter === 'all' || a.status === filter);
  const pendingTotal = all.filter((a) => a.status === 'pending').reduce((s, a) => s + a.balance_due, 0);

  return (
    <Screen scroll={false} contentStyle={{ paddingTop: 0 }}>
      <View style={styles.summary}>
        <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Pending balance</Text>
          <Text style={[styles.summaryValue, { color: theme.danger, fontFamily: Fonts.mono }]}>
            {formatCurrency(pendingTotal)}
          </Text>
        </View>
      </View>

      <View style={styles.filters}>
        {(['all', 'pending', 'paid'] as Filter[]).map((f) => (
          <FilterBtn key={f} label={f} active={filter === f} onPress={() => setFilter(f)} />
        ))}
      </View>

      {loading ? (
        <Loading />
      ) : arrears.length === 0 ? (
        <EmptyState
          icon="cash-outline"
          title="No arrears found"
          subtitle={filter === 'all' ? 'Arrears will appear here' : `No ${filter} arrears`}
        />
      ) : (
        <FlatList
          data={arrears}
          keyExtractor={(a) => a.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.avatar, { backgroundColor: `${theme.danger}1A` }]}>
                <Text style={[styles.avatarText, { color: theme.danger }]}>
                  {(item.customer_name || 'C').slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, { color: theme.text, fontFamily: Fonts.sans }]} numberOfLines={1}>
                  {item.customer_name || 'Unknown'}
                </Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                  Bill {formatCurrency(item.total_bill)} · {formatDate(item.created_at)}
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={[styles.balance, { color: item.status === 'paid' ? theme.success : theme.danger, fontFamily: Fonts.mono }]}>
                  {formatCurrency(item.balance_due)}
                </Text>
                <Badge tone={item.status === 'pending' ? 'warning' : 'success'} label={item.status} />
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

function FilterBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useThemeColor();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.filterBtn,
        { borderColor: theme.border },
        active && { backgroundColor: theme.accent, borderColor: theme.accent },
      ]}>
      <Text style={[styles.filterText, { color: active ? theme.accentFg : theme.textSecondary }, active && { fontWeight: '700' }]}>
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summary: {
    paddingTop: Spacing.three,
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  filters: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  filterBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    fontSize: 11,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  balance: {
    fontSize: 14,
    fontWeight: '700',
  },
});