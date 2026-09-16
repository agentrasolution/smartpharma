import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RevenueBars } from '@/components/dashboard/revenue-bars';
import { ListRow } from '@/components/ui/list-row';
import { Loading } from '@/components/ui/loading';
import { StatCard } from '@/components/ui/stat-card';
import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';
import { useAuth } from '@/contexts/AuthContext';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function DashboardScreen() {
  const theme = useThemeColor();
  const router = useRouter();
  const { user } = useAuth();
  const { data: stats, loading, refetch } = useApi(() => api.dashboard.stats());

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const { data: recentSales = [] } = useApi(() => api.sales.listRecent(5));

  const firstName = user?.username?.[0]?.toUpperCase() ?? 'U';

  return (
    <ScrollView
      style={{ backgroundColor: theme.background, flex: 1 }}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.greeting}>
          <Text style={[styles.hello, { color: theme.textSecondary }]}>Faraz Pharmacy</Text>
          <Text style={[styles.welcome, { color: theme.text, fontFamily: Fonts.sans }]}>Dashboard</Text>
        </View>
        <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
          <Text style={[styles.avatarText, { color: theme.accentFg }]}>{firstName}</Text>
        </View>
      </View>

      {loading ? (
        <Loading />
      ) : (
        <View style={styles.statsGrid}>
          <StatCard
            title="Today's Revenue"
            value={formatCurrency(stats?.todayRevenue ?? 0)}
            icon="trending-up"
            tone="accent"
            subtitle="View invoices"
            onPress={() => router.push('/invoices')}
          />
          <StatCard
            title="Outstanding Arrears"
            value={formatCurrency(stats?.totalArrears ?? 0)}
            icon="alert-circle"
            tone="danger"
            subtitle="Collect payments"
            onPress={() => router.push('/arrears')}
          />
          <StatCard
            title="Low Stock Items"
            value={stats?.lowStockCount ?? 0}
            icon="cube"
            tone="warning"
            subtitle="Restock needed"
            onPress={() => router.push('/products')}
          />
          <StatCard
            title="Expiring Soon"
            value={stats?.expiringSoonCount ?? 0}
            icon="time"
            tone="info"
            subtitle="Check inventory"
            onPress={() => router.push('/products')}
          />
        </View>
      )}

      <View style={styles.quickGrid}>
        <QuickAction icon="cart" label="New Sale" tone="accent" onPress={() => router.push('/pos')} />
        <QuickAction icon="medkit" label="Products" tone="info" onPress={() => router.push('/products')} />
        <QuickAction icon="people" label="Customers" tone="success" onPress={() => router.push('/customers')} />
        <QuickAction icon="cash" label="Arrears" tone="warning" onPress={() => router.push('/arrears')} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.text, fontFamily: Fonts.sans }]}>Revenue Trend</Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Last 7 days</Text>
        </View>
        <RevenueBars data={stats?.weekRevenue} />
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: theme.text, fontFamily: Fonts.sans }]}>Recent Sales</Text>
          <Pressable onPress={() => router.push('/invoices')}>
            <Text style={[styles.link, { color: theme.accent }]}>View all</Text>
          </Pressable>
        </View>
        {recentSales.length === 0 ? (
          <Text style={[styles.empty, { color: theme.textSecondary }]}>No sales yet</Text>
        ) : (
          recentSales.map((sale, i) => (
            <ListRow
              key={sale.id}
              icon="receipt-outline"
              iconColor={theme.accent}
              title={sale.id}
              subtitle={`${sale.customer_name || 'Walk-in'} · ${formatDateTime(sale.created_at)}`}
              right={
                <Text style={[styles.rowValue, { color: theme.text, fontFamily: Fonts.mono }]}>
                  {formatCurrency(sale.total)}
                </Text>
              }
              onPress={() => router.push({ pathname: '/sale/[id]', params: { id: sale.id } })}
              last={i === recentSales.length - 1}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function QuickAction({
  icon,
  label,
  tone,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone: 'accent' | 'info' | 'success' | 'warning';
  onPress: () => void;
}) {
  const theme = useThemeColor();
  const color = theme[tone];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.quick,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.quickIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.quickLabel, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  greeting: {
    gap: 2,
  },
  hello: {
    fontSize: 13,
    fontWeight: '600',
  },
  welcome: {
    fontSize: 24,
    fontWeight: '700',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  quick: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 12,
  },
  link: {
    fontSize: 13,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  empty: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});