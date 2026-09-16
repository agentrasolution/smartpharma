import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function StockScreen() {
  const theme = useThemeColor();
  const { data: stock = [], loading, refetch } = useApi(() => api.stock.list());

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (loading) return <Loading />;

  return (
    <Screen scroll={false}>
      {stock.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="No stock purchases"
          subtitle="Stock purchases will appear here"
        />
      ) : (
        <FlatList
          data={stock}
          keyExtractor={(s) => s.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: Spacing.two, paddingBottom: Spacing.six }}
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.iconWrap, { backgroundColor: `${theme.info}1A` }]}>
                <Text style={[styles.iconText, { color: theme.info }]}>{item.quantity}</Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.name, { color: theme.text, fontFamily: Fonts.sans }]} numberOfLines={1}>
                  {item.product_name || 'Unknown product'}
                </Text>
                <Text style={[styles.meta, { color: theme.textSecondary }]}>
                  {item.invoice_number || 'No invoice'} · {item.distributor_name || '—'} · {formatDate(item.created_at)}
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={[styles.total, { color: theme.text, fontFamily: Fonts.mono }]}>
                  {formatCurrency(item.total_value)}
                </Text>
                {item.expiry ? <Text style={[styles.meta, { color: theme.textSecondary }]}>Exp {formatDate(item.expiry)}</Text> : null}
              </View>
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: 16,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  meta: {
    fontSize: 11,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  total: {
    fontSize: 13,
    fontWeight: '700',
  },
});