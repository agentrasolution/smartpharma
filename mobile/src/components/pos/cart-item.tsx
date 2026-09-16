import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';
import { formatCurrency } from '@/lib/utils';
import type { CartItemData } from '@/hooks/use-cart';

interface CartItemProps {
  item: CartItemData;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onIncrementBy: (productId: string, amount: number) => void;
  onRemove: (productId: string) => void;
}

export function CartItem({ item, onUpdateQuantity, onIncrementBy, onRemove }: CartItemProps) {
  const theme = useThemeColor();
  const packSize = item.packSize;
  const quickBtns = [5, 10, 20];

  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.text, fontFamily: Fonts.sans }]} numberOfLines={1}>
          {item.productName}
        </Text>
        <Text style={[styles.meta, { color: theme.textSecondary }]}>
          {formatCurrency(item.unitPrice)} each{packSize > 1 ? ` · ${packSize}/pack` : ''}
        </Text>
        <View style={styles.quickRow}>
          {quickBtns.map((n) => (
            <Pressable
              key={n}
              onPress={() => onIncrementBy(item.productId, n)}
              style={[styles.quickBtn, { backgroundColor: theme.surface2 }]}>
              <Text style={[styles.quickBtnText, { color: theme.textSecondary }]}>+{n}</Text>
            </Pressable>
          ))}
          {packSize > 1 && (
            <Pressable
              onPress={() => onIncrementBy(item.productId, packSize)}
              style={[styles.quickBtn, { backgroundColor: `${theme.accent}1A` }]}>
              <Text style={[styles.quickBtnText, { color: theme.accent }]}>+Pack</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.qtyRow}>
          <Pressable
            onPress={() => onUpdateQuantity(item.productId, item.quantity - 1)}
            disabled={item.quantity <= 1}
            style={[styles.qtyBtn, { borderColor: theme.border, opacity: item.quantity <= 1 ? 0.35 : 1 }]}>
            <Ionicons name="remove" size={14} color={theme.text} />
          </Pressable>
          <Text style={[styles.qty, { color: theme.text, fontFamily: Fonts.mono }]}>{item.quantity}</Text>
          <Pressable
            onPress={() => onUpdateQuantity(item.productId, item.quantity + 1)}
            style={[styles.qtyBtn, { borderColor: theme.border }]}>
            <Ionicons name="add" size={14} color={theme.text} />
          </Pressable>
        </View>
        <Text style={[styles.subtotal, { color: theme.text, fontFamily: Fonts.mono }]}>
          {formatCurrency(item.subtotal)}
        </Text>
        <Pressable onPress={() => onRemove(item.productId)} hitSlop={6}>
          <Ionicons name="trash-outline" size={16} color={theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    gap: Spacing.three,
  },
  info: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  meta: {
    fontSize: 11,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  quickBtn: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  quickBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  controls: {
    alignItems: 'flex-end',
    gap: 8,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qty: {
    fontSize: 13,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },
  subtotal: {
    fontSize: 13,
    fontWeight: '700',
  },
});