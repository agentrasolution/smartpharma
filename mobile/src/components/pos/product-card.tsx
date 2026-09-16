import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product) => void;
}

export function ProductCard({ product, onAdd }: ProductCardProps) {
  const theme = useThemeColor();
  const lowStock = product.stock_qty <= 5;
  const outOfStock = product.stock_qty === 0;

  return (
    <Pressable
      onPress={() => !outOfStock && onAdd(product)}
      disabled={outOfStock}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: outOfStock ? `${theme.danger}40` : theme.border,
          opacity: outOfStock ? 0.5 : 1,
        },
        pressed && !outOfStock && { transform: [{ scale: 0.98 }] },
      ]}>
      <View style={styles.stockRow}>
        <View
          style={[
            styles.dot,
            { backgroundColor: outOfStock ? theme.danger : lowStock ? theme.warning : theme.success },
          ]}
        />
        <Text style={[styles.stockLabel, { color: theme.textSecondary }]}>
          {outOfStock ? 'OUT OF STOCK' : lowStock ? `Only ${product.stock_qty} left` : 'In Stock'}
        </Text>
      </View>
      <Text style={[styles.name, { color: theme.text, fontFamily: Fonts.sans }]} numberOfLines={2}>
        {product.name}
      </Text>
      <Text style={[styles.company, { color: theme.textSecondary }]} numberOfLines={1}>
        {product.company}
      </Text>
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Text style={[styles.price, { color: theme.text, fontFamily: Fonts.mono }]}>
          {formatCurrency(product.sale_price)}
        </Text>
        <Text style={[styles.pack, { color: theme.textSecondary }]}>
          {product.pack_size > 1 ? `${product.pack_size}/pack` : '1x'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
    gap: 4,
  },
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  stockLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  company: {
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: Spacing.two,
    marginTop: Spacing.two,
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
  },
  pack: {
    fontSize: 11,
    fontWeight: '500',
  },
});