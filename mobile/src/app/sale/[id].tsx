import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Loading } from '@/components/ui/loading';
import { Screen } from '@/components/ui/screen';
import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';
import { useApi } from '@/hooks/use-api';
import { api } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';

export default function SaleDetailScreen() {
  const theme = useThemeColor();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: sale, loading } = useApi(() => api.sales.getById(id));

  if (loading || !sale) return <Loading />;

  const statusTone = sale.status === 'paid' ? 'success' : sale.status === 'partial' ? 'warning' : 'neutral';

  return (
    <Screen contentStyle={{ paddingTop: Spacing.two }}>
      <Card style={{ gap: Spacing.two }}>
        <View style={styles.topRow}>
          <Text style={[styles.invoiceId, { color: theme.text, fontFamily: Fonts.mono }]}>{sale.id}</Text>
          <Badge tone={statusTone} label={sale.status} />
        </View>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>{formatDateTime(sale.created_at)}</Text>
        <Text style={[styles.customer, { color: theme.text, fontFamily: Fonts.sans }]}>
          {sale.customer_name || 'Walk-in customer'}
        </Text>
      </Card>

      <Card>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: theme.text, fontFamily: Fonts.sans }]}>Items</Text>
          <Text style={[styles.meta, { color: theme.textSecondary }]}>{sale.items?.length ?? 0} items</Text>
        </View>
        {(sale.items ?? []).map((item, index) => (
          <View key={item.id || item.product_id + index} style={[styles.itemRow, index > 0 && { borderTopWidth: 1, borderTopColor: theme.border }]}>
            <View style={styles.itemInfo}>
              <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
                {item.product_name}
              </Text>
              <Text style={[styles.meta, { color: theme.textSecondary }]}>
                {item.quantity} × {formatCurrency(item.unit_price)}
              </Text>
            </View>
            <Text style={[styles.itemSubtotal, { color: theme.text, fontFamily: Fonts.mono }]}>
              {formatCurrency(item.subtotal)}
            </Text>
          </View>
        ))}
      </Card>

      <Card>
        <Row label="Subtotal" value={formatCurrency(sale.subtotal)} />
        {sale.discount > 0 && <Row label="Discount" value={`-${formatCurrency(sale.discount)}`} valueColor={theme.success} />}
        <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: theme.border }]}>
          <Text style={[styles.totalLabel, { color: theme.text, fontFamily: Fonts.sans }]}>Total</Text>
          <Text style={[styles.totalValue, { color: theme.text, fontFamily: Fonts.mono }]}>
            {formatCurrency(sale.total)}
          </Text>
        </View>
        <Row label="Amount paid" value={formatCurrency(sale.amount_paid)} />
        <Row label="Change" value={formatCurrency(sale.change)} />
      </Card>
    </Screen>
  );
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const theme = useThemeColor();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor ?? theme.text, fontFamily: Fonts.mono }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  invoiceId: {
    fontSize: 16,
    fontWeight: '800',
  },
  meta: {
    fontSize: 12,
  },
  customer: {
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemSubtotal: {
    fontSize: 14,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
  },
  rowLabel: {
    fontSize: 14,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
    marginTop: Spacing.one,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
  },
});