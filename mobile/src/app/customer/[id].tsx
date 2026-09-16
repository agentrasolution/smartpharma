import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Loading } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function CustomerDetailScreen() {
  const theme = useThemeColor();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: customer, loading, refetch } = useApi(() => api.customers.getById(id));

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  if (loading || !customer) return <Loading />;

  const purchases = customer.purchases ?? [];
  const arrears = customer.arrears ?? [];

  return (
    <Screen contentStyle={{ paddingTop: Spacing.two }}>
      <View style={styles.hero}>
        <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
          <Text style={[styles.avatarText, { color: theme.accentFg }]}>{customer.name.slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text style={[styles.name, { color: theme.text, fontFamily: Fonts.sans }]}>{customer.name}</Text>
        {customer.phone ? <Text style={[styles.meta, { color: theme.textSecondary }]}>{customer.phone}</Text> : null}
        {customer.address ? <Text style={[styles.meta, { color: theme.textSecondary }]}>{customer.address}</Text> : null}
      </View>

      <View style={styles.statsRow}>
        <Stat label="Total purchases" value={formatCurrency(customer.total_purchases ?? 0)} color={theme.accent} />
        <Stat label="Outstanding" value={formatCurrency(customer.outstanding_arrear ?? 0)} color={theme.danger} />
        <Stat label="Last purchase" value={customer.last_purchase ? formatDateTime(customer.last_purchase) : '—'} color={theme.text} />
      </View>

      {arrears.length > 0 && (
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: Fonts.sans }]}>Arrears</Text>
          {arrears.map((a, i) => (
            <ListRow
              key={a.id}
              icon="cash-outline"
              iconColor={theme.danger}
              title={`Bill ${formatCurrency(a.total_bill)}`}
              subtitle={`Paid ${formatCurrency(a.amount_paid)} · ${formatDateTime(a.created_at)}`}
              right={
                <Badge tone={a.status === 'pending' ? 'warning' : 'success'} label={formatCurrency(a.balance_due)} />
              }
              last={i === arrears.length - 1}
            />
          ))}
        </Card>
      )}

      <Card>
        <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: Fonts.sans }]}>Purchase History</Text>
        {purchases.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textSecondary }]}>No purchases yet</Text>
        ) : (
          purchases.map((sale, i) => (
            <ListRow
              key={sale.id}
              icon="receipt-outline"
              iconColor={theme.accent}
              title={sale.id}
              subtitle={formatDateTime(sale.created_at)}
              right={
                <Text style={[styles.saleTotal, { color: theme.text, fontFamily: Fonts.mono }]}>
                  {formatCurrency(sale.amount_paid)}
                </Text>
              }
              onPress={() => router.push({ pathname: '/sale/[id]', params: { id: sale.id } })}
              last={i === purchases.length - 1}
            />
          ))
        )}
      </Card>
    </Screen>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const theme = useThemeColor();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color, fontFamily: Fonts.mono }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.two,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    gap: 4,
    backgroundColor: 'transparent',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  empty: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  saleTotal: {
    fontSize: 13,
    fontWeight: '700',
  },
});