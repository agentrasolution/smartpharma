import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Loading } from '@/components/ui/loading';
import { SearchBar } from '@/components/ui/search-bar';
import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';
import { useDebounce } from '@/hooks/use-debounce';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function InvoicesScreen() {
  const theme = useThemeColor();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search, 300);
  const { data: sales = [], loading, refetch } = useApi(() => api.sales.listAll({ search: debounced || undefined }), [
    debounced,
  ]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const statusTone = (status: string) => {
    if (status === 'paid') return 'success' as const;
    if (status === 'partial') return 'warning' as const;
    if (status === 'refunded') return 'danger' as const;
    return 'neutral' as const;
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.sans }]}>Invoices</Text>
      </View>
      <View style={styles.searchWrap}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search by invoice, customer, product" />
      </View>

      {loading ? (
        <Loading />
      ) : sales.length === 0 ? (
        <EmptyState
          icon="receipt-outline"
          title="No invoices found"
          subtitle={search ? 'Try a different search' : 'Sales will appear here'}
        />
      ) : (
        <FlatList
          data={sales}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/sale/[id]', params: { id: item.id } })}
              style={[
                styles.row,
                { backgroundColor: theme.surface, borderColor: theme.border },
                index === sales.length - 1 && { marginBottom: Spacing.six },
              ]}>
              <View style={[styles.iconWrap, { backgroundColor: `${theme.accent}1A` }]}>
                <Ionicons name="receipt-outline" size={20} color={theme.accent} />
              </View>
              <View style={styles.rowInfo}>
                <Text style={[styles.rowId, { color: theme.text, fontFamily: Fonts.mono }]}>{item.id}</Text>
                <Text style={[styles.rowMeta, { color: theme.textSecondary }]}>
                  {item.customer_name || 'Walk-in'} · {formatDateTime(item.created_at)}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.rowTotal, { color: theme.text, fontFamily: Fonts.mono }]}>
                  {formatCurrency(item.total)}
                </Text>
                <Badge tone={statusTone(item.status)} label={item.status} />
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    padding: Spacing.three,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  searchWrap: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  list: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  rowId: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowMeta: {
    fontSize: 11,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rowTotal: {
    fontSize: 14,
    fontWeight: '700',
  },
});