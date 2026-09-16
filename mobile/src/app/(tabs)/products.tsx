import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Loading } from '@/components/ui/loading';
import { SearchBar } from '@/components/ui/search-bar';
import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';
import { useDebounce } from '@/hooks/use-debounce';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Product } from '@/types';

export default function ProductsScreen() {
  const theme = useThemeColor();
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const debounced = useDebounce(search, 250);

  const [detail, setDetail] = useState<Product | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    barcode: '',
    purchasePrice: '',
    salePrice: '',
    packSize: '1',
    category: '',
    location: '',
  });
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (debounced.trim()) {
        setProducts(await api.products.search(debounced.trim()));
      } else {
        const page = await api.products.list({ pageSize: 100 });
        setProducts(page.data);
      }
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  function openAdd() {
    setForm({ name: '', barcode: '', purchasePrice: '', salePrice: '', packSize: '1', category: '', location: '' });
    setFormError('');
    setAddOpen(true);
  }

  async function handleSave() {
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Product name is required');
      return;
    }
    const purchasePrice = Number(form.purchasePrice) || 0;
    const salePrice = Number(form.salePrice) || purchasePrice;
    setSaving(true);
    try {
      await api.products.create({
        name: form.name.trim(),
        barcode: form.barcode.trim() || `PD${Date.now().toString().slice(-8)}`,
        purchasePrice,
        salePrice,
        packSize: Number(form.packSize) || 1,
        category: form.category.trim() || undefined,
        location: form.location.trim() || undefined,
      });
      setAddOpen(false);
      void load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.sans }]}>Products</Text>
        <Pressable onPress={openAdd} style={[styles.addBtn, { backgroundColor: theme.accent }]}>
          <Ionicons name="add" size={18} color={theme.accentFg} />
          <Text style={[styles.addBtnText, { color: theme.accentFg }]}>Add</Text>
        </Pressable>
      </View>
      <View style={styles.searchWrap}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search products" />
      </View>

      {loading ? (
        <Loading />
      ) : products.length === 0 ? (
        <EmptyState
          icon="medkit-outline"
          title="No products found"
          subtitle={search ? 'Try a different search' : 'Add your first product'}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const low = item.stock_qty <= 5;
            const out = item.stock_qty === 0;
            return (
              <Pressable
                onPress={() => setDetail(item)}
                style={[
                  styles.row,
                  { backgroundColor: theme.surface, borderColor: theme.border },
                  index === products.length - 1 && { marginBottom: Spacing.six },
                ]}>
                <View style={[styles.rowIcon, { backgroundColor: `${theme.accent}1A` }]}>
                  <Ionicons name="medical" size={20} color={theme.accent} />
                </View>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, { color: theme.text, fontFamily: Fonts.sans }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.barcode} · {item.company || '—'}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={[styles.rowPrice, { color: theme.text, fontFamily: Fonts.mono }]}>
                    {formatCurrency(item.sale_price)}
                  </Text>
                  <Badge tone={out ? 'danger' : low ? 'warning' : 'neutral'} label={`${item.stock_qty} in stock`} />
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDetail(null)} />
          <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {detail && (
              <>
                <Text style={[styles.modalName, { color: theme.text, fontFamily: Fonts.sans }]}>{detail.name}</Text>
                <View style={styles.detailGrid}>
                  <DetailItem label="Barcode" value={detail.barcode} />
                  <DetailItem label="Company" value={detail.company || '—'} />
                  <DetailItem label="Category" value={detail.category || '—'} />
                  <DetailItem label="Location" value={detail.location || '—'} />
                  <DetailItem label="Stock" value={`${detail.stock_qty} units`} />
                  <DetailItem label="Pack size" value={detail.pack_size > 1 ? `${detail.pack_size}/pack` : '1x'} />
                  <DetailItem label="Purchase" value={formatCurrency(detail.purchase_price)} />
                  <DetailItem label="Sale price" value={formatCurrency(detail.sale_price)} />
                  <DetailItem label="Markup" value={`${detail.markup_percent ?? 0}%`} />
                  <DetailItem label="Expiry" value={detail.expiry ? formatDate(detail.expiry) : '—'} />
                </View>
                {detail.prices && detail.prices.length > 0 ? (
                  <View style={[styles.prices, { borderTopColor: theme.border }]}>
                    <Text style={[styles.pricesTitle, { color: theme.textSecondary }]}>Price tiers</Text>
                    {detail.prices.map((t) => (
                      <View key={t.id} style={styles.priceRow}>
                        <Text style={[styles.priceLabel, { color: theme.text }]}>{t.label || 'Untitled'}</Text>
                        <Text style={[styles.priceVal, { color: theme.accent, fontFamily: Fonts.mono }]}>
                          {formatCurrency(t.salePrice)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAddOpen(false)} />
          <View style={[styles.formSheet, { backgroundColor: theme.surface }]}>
            <Text style={[styles.formTitle, { color: theme.text, fontFamily: Fonts.sans }]}>Add Product</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.formScroll}>
              <FormField label="Name" required>
                <Input value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Product name" />
              </FormField>
              <FormField label="Barcode">
                <Input value={form.barcode} onChangeText={(t) => setForm({ ...form, barcode: t })} placeholder="Barcode (optional)" />
              </FormField>
              <FormField label="Purchase price">
                <Input
                  value={form.purchasePrice}
                  onChangeText={(t) => setForm({ ...form, purchasePrice: t })}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </FormField>
              <FormField label="Sale price">
                <Input
                  value={form.salePrice}
                  onChangeText={(t) => setForm({ ...form, salePrice: t })}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </FormField>
              <FormField label="Pack size">
                <Input
                  value={form.packSize}
                  onChangeText={(t) => setForm({ ...form, packSize: t })}
                  placeholder="1"
                  keyboardType="numeric"
                />
              </FormField>
              <FormField label="Category">
                <Input value={form.category} onChangeText={(t) => setForm({ ...form, category: t })} placeholder="Category" />
              </FormField>
              <FormField label="Location">
                <Input value={form.location} onChangeText={(t) => setForm({ ...form, location: t })} placeholder="Shelf location" />
              </FormField>
            </ScrollView>
            {formError ? <Text style={[styles.formError, { color: theme.danger }]}>{formError}</Text> : null}
            <Button fullWidth size="lg" loading={saving} disabled={!form.name.trim()} onPress={handleSave}>
              Save Product
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  const theme = useThemeColor();
  return (
    <View style={styles.detailItem}>
      <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  const theme = useThemeColor();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
        {label} {required ? <Text style={{ color: theme.danger }}>*</Text> : null}
      </Text>
      {children}
    </View>
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
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: 8,
  },
  addBtnText: {
    fontSize: 13,
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
  rowIcon: {
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
  rowName: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 11,
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rowPrice: {
    fontSize: 14,
    fontWeight: '700',
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
    maxWidth: 380,
    borderRadius: 18,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalName: {
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  detailItem: {
    width: '28%',
    minWidth: 90,
    gap: 2,
  },
  detailLabel: {
    fontSize: 11,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  prices: {
    gap: Spacing.two,
    borderTopWidth: 1,
    paddingTop: Spacing.three,
  },
  pricesTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: 13,
  },
  priceVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  formSheet: {
    height: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  formScroll: {
    flexGrow: 0,
  },
  field: {
    gap: 6,
    marginBottom: Spacing.three,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  formError: {
    fontSize: 13,
    textAlign: 'center',
  },
});