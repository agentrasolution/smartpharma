import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartItem } from '@/components/pos/cart-item';
import { ProductCard } from '@/components/pos/product-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { SearchBar } from '@/components/ui/search-bar';
import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';
import { useCart } from '@/hooks/use-cart';
import { useDebounce } from '@/hooks/use-debounce';
import { api } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import type { Customer, Product, ProductPrice, Sale } from '@/types';

type Mode = 'products' | 'cart';

export default function PosScreen() {
  const theme = useThemeColor();
  const cart = useCart();

  const [mode, setMode] = useState<Mode>('products');
  const [search, setSearch] = useState('');
  const [browse, setBrowse] = useState<Product[]>([]);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const debounced = useDebounce(search, 250);

  const [tierProduct, setTierProduct] = useState<Product | null>(null);
  const [customerModal, setCustomerModal] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerLoading, setCustomerLoading] = useState(false);

  const [amountPaid, setAmountPaid] = useState('');
  const [checkoutError, setCheckoutError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [lastChange, setLastChange] = useState(0);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const numPaid = Number(amountPaid) || 0;
  const change = Math.max(0, numPaid - cart.total);
  const isPartial = numPaid > 0 && numPaid < cart.total;
  const canPay =
    cart.items.length > 0 &&
    (numPaid >= cart.total || (isPartial && !!cart.customerId && cart.addToArrears));

  const loadBrowse = useCallback(async () => {
    setBrowseLoading(true);
    try {
      const page = await api.products.list({ pageSize: 100 });
      setBrowse(page.data);
    } catch {
      setBrowse([]);
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounced.trim()) {
      setSearching(true);
      api.products
        .search(debounced.trim())
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    } else {
      void loadBrowse();
    }
  }, [debounced, loadBrowse]);

  useFocusEffect(
    useCallback(() => {
      void loadBrowse();
    }, [loadBrowse])
  );

  const displayProducts = debounced.trim() ? results : browse;

  function handleBarcodeOrAdd(product: Product) {
    if (product.stock_qty === 0) {
      setCheckoutError(`${product.name} is out of stock`);
      return;
    }
    const tiers = (product as Product).prices as ProductPrice[] | undefined;
    if (tiers && tiers.length > 0) {
      setTierProduct(product);
      return;
    }
    cart.addProduct(product, product.sale_price);
    setMode('cart');
  }

  function openCustomerModal() {
    setCustomerQuery('');
    setCustomerModal(true);
    setCustomerLoading(true);
    api.customers
      .list()
      .then(setCustomers)
      .catch(() => setCustomers([]))
      .finally(() => setCustomerLoading(false));
  }

  async function handleCheckout() {
    if (!canPay) return;
    setProcessing(true);
    setCheckoutError('');
    try {
      const sale = await api.sales.create({
        customerId: cart.customerId,
        items: cart.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          barcode: item.barcode,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
        })),
        subtotal: cart.subtotal,
        discount: cart.discount,
        total: cart.total,
        amountPaid: numPaid,
      });
      setLastSale(sale);
      setLastChange(change);
      setReceiptOpen(true);
      cart.clearCart();
      setAmountPaid('');
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.sans }]}>Point of Sale</Text>
        <Pressable onPress={cart.clearCart} disabled={cart.items.length === 0} style={styles.newSaleBtn}>
          <Ionicons
            name="add-circle-outline"
            size={17}
            color={cart.items.length === 0 ? theme.mutedFg : theme.accent}
          />
          <Text style={[styles.newSaleText, { color: cart.items.length === 0 ? theme.mutedFg : theme.accent }]}>
            New Sale
          </Text>
        </Pressable>
      </View>

      <View style={styles.segmented}>
        <SegBtn
          active={mode === 'products'}
          label="Products"
          icon="grid-outline"
          badge={browseLoading ? undefined : displayProducts.length}
          onPress={() => setMode('products')}
        />
        <SegBtn
          active={mode === 'cart'}
          label="Cart"
          icon="cart-outline"
          badge={cart.items.length}
          onPress={() => setMode('cart')}
        />
      </View>

      {mode === 'products' ? (
        <>
          <SearchBar
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or barcode"
            autoFocus={false}
            onSubmitEditing={() => {
              if (displayProducts.length === 1) handleBarcodeOrAdd(displayProducts[0]);
            }}
          />
          {searching || browseLoading ? (
            <Loading />
          ) : displayProducts.length === 0 ? (
            <EmptyState
              icon="medkit-outline"
              title={debounced ? 'No products found' : 'No products yet'}
              subtitle={debounced ? 'Try a different search term' : 'Add products from the Products tab'}
            />
          ) : (
            <FlatList
              data={displayProducts}
              keyExtractor={(p) => p.id}
              numColumns={2}
              columnWrapperStyle={styles.gridRow}
              contentContainerStyle={styles.grid}
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => <ProductCard product={item} onAdd={handleBarcodeOrAdd} />}
            />
          )}
        </>
      ) : (
        <FlatList
          data={cart.items}
          keyExtractor={(i) => i.productId}
          contentContainerStyle={styles.cartList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            cart.items.length === 0 ? (
              <EmptyState
                icon="cart-outline"
                title="Cart is empty"
                subtitle="Switch to Products and tap items to add"
              />
            ) : null
          }
          renderItem={({ item }) => (
            <CartItem
              item={item}
              onUpdateQuantity={cart.updateQuantity}
              onIncrementBy={cart.incrementBy}
              onRemove={cart.removeItem}
            />
          )}
          ListFooterComponent={
            cart.items.length > 0 ? (
              <View style={styles.checkout}>
                <Pressable onPress={openCustomerModal} style={[styles.customerPicker, { borderColor: theme.border }]}>
                  <Ionicons name="person-outline" size={18} color={theme.accent} />
                  <Text style={[styles.customerText, { color: theme.text }]}>
                    {cart.customerName || 'Select customer (optional)'}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.mutedFg} />
                </Pressable>

                <View style={styles.rowBetween}>
                  <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Subtotal</Text>
                  <Text style={[styles.rowValue, { color: theme.text, fontFamily: Fonts.mono }]}>
                    {formatCurrency(cart.subtotal)}
                  </Text>
                </View>
                <View style={styles.discountRow}>
                  <Pressable onPress={cart.toggleDiscountType} style={[styles.typeBtn, { backgroundColor: theme.surface2, borderColor: theme.border }]}>
                    <Text style={[styles.typeBtnText, { color: theme.textSecondary }]}>
                      {cart.discountType === 'pkr' ? 'PKR' : '%'}
                    </Text>
                  </Pressable>
                  <TextInput
                    value={cart.discountValue ? String(cart.discountValue) : ''}
                    onChangeText={(t) => cart.setDiscountValue(Number(t) || 0)}
                    placeholder="Discount"
                    placeholderTextColor={theme.mutedFg}
                    keyboardType="numeric"
                    style={[styles.discountInput, { borderColor: theme.border, color: theme.text, fontFamily: Fonts.mono }]}
                  />
                </View>
                {cart.discount > 0 && (
                  <View style={styles.rowBetween}>
                    <Text style={[styles.rowLabel, { color: theme.success }]}>Discount</Text>
                    <Text style={[styles.rowValue, { color: theme.success, fontFamily: Fonts.mono }]}>
                      -{formatCurrency(cart.discount)}
                    </Text>
                  </View>
                )}
                <View style={styles.totalRow}>
                  <Text style={[styles.totalLabel, { color: theme.text, fontFamily: Fonts.sans }]}>Total</Text>
                  <Text style={[styles.totalValue, { color: theme.text, fontFamily: Fonts.mono }]}>
                    {formatCurrency(cart.total)}
                  </Text>
                </View>

                <TextInput
                  value={amountPaid}
                  onChangeText={setAmountPaid}
                  placeholder="Amount paid"
                  placeholderTextColor={theme.mutedFg}
                  keyboardType="numeric"
                  style={[styles.paidInput, { borderColor: theme.border, color: theme.text, fontFamily: Fonts.mono }]}
                />

                {change > 0 && (
                  <Text style={[styles.changeText, { color: theme.success }]}>
                    Change: {formatCurrency(change)}
                  </Text>
                )}

                {isPartial && (
                  <Pressable style={styles.arrearsRow} onPress={() => cart.setAddToArrears(!cart.addToArrears)}>
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: cart.addToArrears ? theme.accent : theme.border },
                        cart.addToArrears && { backgroundColor: theme.accent },
                      ]}>
                      {cart.addToArrears && <Ionicons name="checkmark" size={13} color={theme.accentFg} />}
                    </View>
                    <Text style={[styles.arrearsLabel, { color: theme.textSecondary }]}>
                      Add remaining to arrears
                    </Text>
                  </Pressable>
                )}

                {isPartial && !cart.customerId && (
                  <Text style={[styles.hint, { color: theme.danger }]}>Select a customer for partial payment</Text>
                )}

                {checkoutError ? (
                  <Text style={[styles.hint, { color: theme.danger }]}>{checkoutError}</Text>
                ) : null}

                <Button
                  fullWidth
                  size="lg"
                  disabled={!canPay}
                  loading={processing}
                  onPress={handleCheckout}
                  variant={canPay ? 'primary' : 'secondary'}>
                  {canPay ? `Pay ${formatCurrency(cart.total)}` : 'Enter payment to checkout'}
                </Button>
              </View>
            ) : null
          }
        />
      )}

      <Modal visible={!!tierProduct} transparent animationType="fade" onRequestClose={() => setTierProduct(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setTierProduct(null)} />
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.text, fontFamily: Fonts.sans }]}>Select Price Tier</Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              {tierProduct?.name} has multiple price tiers.
            </Text>
            <Pressable
              onPress={() => {
                if (tierProduct) {
                  cart.addProduct(tierProduct, tierProduct.sale_price);
                  setMode('cart');
                }
                setTierProduct(null);
              }}
              style={[styles.tierRow, { borderColor: theme.border }]}>
              <Text style={[styles.tierLabel, { color: theme.text }]}>Standard</Text>
              <Text style={[styles.tierPrice, { color: theme.accent, fontFamily: Fonts.mono }]}>
                {formatCurrency(tierProduct?.sale_price ?? 0)}
              </Text>
            </Pressable>
            {(tierProduct?.prices ?? []).map((tier) => (
              <Pressable
                key={tier.id}
                onPress={() => {
                  if (tierProduct) {
                    cart.addProduct(tierProduct, tier.salePrice);
                    setMode('cart');
                  }
                  setTierProduct(null);
                }}
                style={[styles.tierRow, { borderColor: theme.border }]}>
                <Text style={[styles.tierLabel, { color: theme.text }]}>{tier.label || 'Untitled'}</Text>
                <Text style={[styles.tierPrice, { color: theme.accent, fontFamily: Fonts.mono }]}>
                  {formatCurrency(tier.salePrice)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <Modal visible={customerModal} transparent animationType="slide" onRequestClose={() => setCustomerModal(false)}>
        <View style={styles.customerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCustomerModal(false)} />
          <View style={[styles.customerSheet, { backgroundColor: theme.surface }]}>
            <View style={styles.customerHeader}>
              <Text style={[styles.customerSheetTitle, { color: theme.text, fontFamily: Fonts.sans }]}>
                Select Customer
              </Text>
              <Pressable onPress={() => setCustomerModal(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>
            <SearchBar value={customerQuery} onChangeText={setCustomerQuery} placeholder="Search customers" />
            {customerLoading ? (
              <Loading />
            ) : (
              <FlatList
                data={customers.filter(
                  (c) =>
                    !customerQuery ||
                    c.name.toLowerCase().includes(customerQuery.toLowerCase()) ||
                    c.phone?.toLowerCase().includes(customerQuery.toLowerCase())
                )}
                keyExtractor={(c) => c.id}
                renderItem={({ item, index }) => (
                  <Pressable
                    onPress={() => {
                      cart.setCustomer(item.id, item.name);
                      setCustomerModal(false);
                    }}
                    style={[
                      styles.customerRow,
                      { borderBottomColor: theme.border },
                      index === 0 && styles.customerRowFirst,
                    ]}>
                    <View style={[styles.customerAvatar, { backgroundColor: `${theme.accent}1A` }]}>
                      <Text style={[styles.customerAvatarText, { color: theme.accent }]}>
                        {item.name.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.customerInfo}>
                      <Text style={[styles.customerName, { color: theme.text }]}>{item.name}</Text>
                      <Text style={[styles.customerPhone, { color: theme.textSecondary }]}>
                        {item.phone || 'No phone'}
                        {item.outstanding_arrear ? ` · Arrear: ${formatCurrency(item.outstanding_arrear)}` : ''}
                      </Text>
                    </View>
                    {cart.customerId === item.id && (
                      <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
                    )}
                  </Pressable>
                )}
                ListEmptyComponent={
                  <EmptyState icon="people-outline" title="No customers found" subtitle="Add customers from the Customers tab" />
                }
              />
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={receiptOpen} transparent animationType="fade" onRequestClose={() => setReceiptOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setReceiptOpen(false)} />
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={[styles.successIcon, { backgroundColor: `${theme.success}1A` }]}>
              <Ionicons name="checkmark-circle" size={44} color={theme.success} />
            </View>
            <Text style={[styles.receiptTitle, { color: theme.text, fontFamily: Fonts.sans }]}>Sale Completed</Text>
            {lastSale && (
              <>
                <Text style={[styles.receiptMeta, { color: theme.textSecondary }]}>Invoice #{lastSale.id}</Text>
                <Text style={[styles.receiptMeta, { color: theme.textSecondary }]}>
                  {formatDateTime(lastSale.created_at)}
                </Text>
              </>
            )}
            <View style={styles.receiptTotals}>
              <View style={styles.rowBetween}>
                <Text style={[styles.rowLabel, { color: theme.textSecondary }]}>Total</Text>
                <Text style={[styles.receiptTotal, { color: theme.text, fontFamily: Fonts.mono }]}>
                  {formatCurrency(lastSale?.total ?? 0)}
                </Text>
              </View>
              {lastChange > 0 && (
                <View style={styles.rowBetween}>
                  <Text style={[styles.rowLabel, { color: theme.success }]}>Change</Text>
                  <Text style={[styles.rowValue, { color: theme.success, fontFamily: Fonts.mono }]}>
                    {formatCurrency(lastChange)}
                  </Text>
                </View>
              )}
            </View>
            <Button fullWidth onPress={() => setReceiptOpen(false)}>
              Done
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SegBtn({
  active,
  label,
  icon,
  badge,
  onPress,
}: {
  active: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: number | string;
  onPress: () => void;
}) {
  const theme = useThemeColor();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segBtn,
        { borderColor: theme.border },
        active && { backgroundColor: theme.accent, borderColor: theme.accent },
      ]}>
      <Ionicons name={icon} size={16} color={active ? theme.accentFg : theme.textSecondary} />
      <Text style={[styles.segText, { color: active ? theme.accentFg : theme.textSecondary }]}>{label}</Text>
      {typeof badge === 'number' && badge > 0 ? (
        <View style={[styles.segBadge, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : theme.accent }]}>
          <Text style={[styles.segBadgeText, { color: theme.accentFg }]}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    paddingBottom: Spacing.two,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  newSaleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newSaleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  segmented: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
  },
  segText: {
    fontSize: 14,
    fontWeight: '600',
  },
  segBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  segBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  grid: {
    padding: Spacing.three,
    paddingTop: 0,
    gap: Spacing.two,
  },
  gridRow: {
    gap: Spacing.two,
  },
  cartList: {
    padding: Spacing.three,
    paddingTop: 0,
    paddingBottom: Spacing.six,
  },
  checkout: {
    gap: Spacing.three,
    paddingTop: Spacing.four,
  },
  customerPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
  },
  customerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 14,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  discountRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  typeBtn: {
    height: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  discountInput: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
  },
  paidInput: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  arrearsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrearsLabel: {
    fontSize: 13,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    alignItems: 'stretch',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 13,
    textAlign: 'center',
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.three,
  },
  tierLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  tierPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  receiptTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  receiptMeta: {
    fontSize: 13,
    textAlign: 'center',
  },
  receiptTotals: {
    gap: Spacing.two,
  },
  receiptTotal: {
    fontSize: 18,
    fontWeight: '800',
  },
  customerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  customerSheet: {
    height: '75%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.three,
    paddingBottom: 32,
    gap: Spacing.three,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customerSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
  },
  customerRowFirst: {
    paddingTop: Spacing.two,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  customerInfo: {
    flex: 1,
    gap: 2,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '600',
  },
  customerPhone: {
    fontSize: 12,
  },
});