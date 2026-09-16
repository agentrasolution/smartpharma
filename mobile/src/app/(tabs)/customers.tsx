import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
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
import { formatCurrency } from '@/lib/utils';
import type { Customer } from '@/types';

export default function CustomersScreen() {
  const theme = useThemeColor();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const debounced = useDebounce(search, 250);

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', address: '', fatherName: '', fatherPhone: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (debounced.trim()) {
        setCustomers(await api.customers.search(debounced.trim()));
      } else {
        setCustomers(await api.customers.list());
      }
    } catch {
      setCustomers([]);
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
    setForm({ name: '', phone: '', address: '', fatherName: '', fatherPhone: '' });
    setFormError('');
    setAddOpen(true);
  }

  async function handleSave() {
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Customer name is required');
      return;
    }
    setSaving(true);
    try {
      await api.customers.create({
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        fatherName: form.fatherName.trim() || undefined,
        fatherPhone: form.fatherPhone.trim() || undefined,
      });
      setAddOpen(false);
      void load();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.sans }]}>Customers</Text>
        <Pressable onPress={openAdd} style={[styles.addBtn, { backgroundColor: theme.accent }]}>
          <Ionicons name="add" size={18} color={theme.accentFg} />
          <Text style={[styles.addBtnText, { color: theme.accentFg }]}>Add</Text>
        </Pressable>
      </View>
      <View style={styles.searchWrap}>
        <SearchBar value={search} onChangeText={setSearch} placeholder="Search customers" />
      </View>

      {loading ? (
        <Loading />
      ) : customers.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No customers found"
          subtitle={search ? 'Try a different search' : 'Add your first customer'}
        />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/customer/[id]', params: { id: item.id } })}
              style={[
                styles.row,
                { backgroundColor: theme.surface, borderColor: theme.border },
                index === customers.length - 1 && { marginBottom: Spacing.six },
              ]}>
              <View style={[styles.avatar, { backgroundColor: `${theme.accent}1A` }]}>
                <Text style={[styles.avatarText, { color: theme.accent }]}>
                  {item.name.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, { color: theme.text, fontFamily: Fonts.sans }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.rowMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                  {item.phone || 'No phone'} · Purchases {formatCurrency(item.total_purchases ?? 0)}
                </Text>
              </View>
              {item.outstanding_arrear ? (
                <Badge tone="danger" label={formatCurrency(item.outstanding_arrear)} />
              ) : (
                <Ionicons name="chevron-forward" size={16} color={theme.mutedFg} />
              )}
            </Pressable>
          )}
        />
      )}

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAddOpen(false)} />
          <View style={[styles.formSheet, { backgroundColor: theme.surface }]}>
            <Text style={[styles.formTitle, { color: theme.text, fontFamily: Fonts.sans }]}>Add Customer</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.formScroll}>
              <FormField label="Name" required>
                <Input value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Customer name" />
              </FormField>
              <FormField label="Phone">
                <Input
                  value={form.phone}
                  onChangeText={(t) => setForm({ ...form, phone: t })}
                  placeholder="Phone number"
                  keyboardType="phone-pad"
                />
              </FormField>
              <FormField label="Father name">
                <Input value={form.fatherName} onChangeText={(t) => setForm({ ...form, fatherName: t })} placeholder="Father name" />
              </FormField>
              <FormField label="Father phone">
                <Input
                  value={form.fatherPhone}
                  onChangeText={(t) => setForm({ ...form, fatherPhone: t })}
                  placeholder="Father phone"
                  keyboardType="phone-pad"
                />
              </FormField>
              <FormField label="Address">
                <Input value={form.address} onChangeText={(t) => setForm({ ...form, address: t })} placeholder="Address" />
              </FormField>
            </ScrollView>
            {formError ? <Text style={[styles.formError, { color: theme.danger }]}>{formError}</Text> : null}
            <Button fullWidth size="lg" loading={saving} disabled={!form.name.trim()} onPress={handleSave}>
              Save Customer
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  formSheet: {
    height: '78%',
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