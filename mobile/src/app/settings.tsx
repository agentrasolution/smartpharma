import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ListRow } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { Spacing, useThemeColor } from '@/constants/useThemeColor';
import { useAuth } from '@/contexts/AuthContext';
import { useServerSettings } from '@/contexts/ServerSettingsContext';

function statusTone(status?: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch ((status ?? '').toUpperCase()) {
    case 'ACTIVE':
      return 'success';
    case 'TRIAL':
      return 'info';
    case 'PAST_DUE':
      return 'warning';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'danger';
    default:
      return 'neutral';
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

export default function SettingsScreen() {
  const theme = useThemeColor();
  const { baseUrl, setBaseUrl } = useServerSettings();
  const { user, logout, refreshUser, subscriptionBlocked, clearSubscriptionBlocked } = useAuth();

  const [url, setUrl] = useState(baseUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const save = useCallback(async () => {
    setSaving(true);
    await setBaseUrl(url);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [url, setBaseUrl]);

  const refreshBilling = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      clearSubscriptionBlocked();
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser, clearSubscriptionBlocked]);

  const subscription = user?.subscription;

  return (
    <Screen contentStyle={{ paddingTop: Spacing.two }}>
      <Card>
        <ListRow
          icon="person-circle-outline"
          iconColor={theme.accent}
          title={user?.name || (user?.username ?? 'User')}
          subtitle={`Role: ${user?.roleName ?? user?.role ?? '—'} · Signed in`}
          last
        />
        <ListRow
          icon="business-outline"
          iconColor={theme.accent}
          title={user?.pharmacyName ?? 'Pharmacy'}
          subtitle={user?.branchName ? `Branch: ${user.branchName}` : 'All branches'}
          last
        />
      </Card>

      <Card>
        <View style={styles.billingHeader}>
          <Text style={[styles.billingTitle, { color: theme.text }]}>Subscription & Billing</Text>
          <Badge tone={statusTone(subscription?.status)} label={subscription?.status ?? 'Unknown'} />
        </View>
        <ListRow
          icon="card-outline"
          iconColor={theme.accent}
          title="Plan"
          subtitle={subscription?.plan ? String(subscription.plan) : '—'}
          last
        />
        <ListRow
          icon="cash-outline"
          iconColor={theme.accent}
          title="Monthly price"
          subtitle={subscription?.price != null ? `Rs ${subscription.price}` : '—'}
          last
        />
        <ListRow
          icon="calendar-outline"
          iconColor={theme.accent}
          title="Renews"
          subtitle={formatDate(subscription?.renewsAt)}
          last
        />
        {subscriptionBlocked ? (
          <View
            style={[
              styles.blockedBox,
              { backgroundColor: `${theme.danger}12`, borderColor: `${theme.danger}30` },
            ]}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
            <Text style={[styles.blockedText, { color: theme.danger }]}>
              Your subscription has expired. Contact the SmartPharma admin to renew it.
            </Text>
          </View>
        ) : null}
        <Button variant="outline" fullWidth loading={refreshing} onPress={() => void refreshBilling()}>
          Refresh billing status
        </Button>
      </Card>

      <Card>
        <ListRow
          icon="server-outline"
          iconColor={theme.accent}
          title="Server URL"
          subtitle="Where the SmartPharma server runs"
          last
        />
        <Input
          value={url}
          onChangeText={(t) => {
            setUrl(t);
            setSaved(false);
          }}
          placeholder="http://192.168.1.10:3001"
          autoCapitalize="none"
          autoCorrect={false}
          containerStyle={{ marginBottom: Spacing.three }}
        />
        <Button fullWidth loading={saving} onPress={save}>
          {saved ? 'Saved' : 'Save Server URL'}
        </Button>
        <Button
          variant="outline"
          fullWidth
          onPress={() => {
            setUrl(baseUrl);
            setSaved(false);
          }}>
          Reset
        </Button>
      </Card>

      <Card>
        <ListRow
          icon="log-out-outline"
          iconColor={theme.danger}
          title="Log out"
          subtitle="Sign out of this device"
          onPress={() => void logout()}
          last
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  billingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  billingTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  blockedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  blockedText: {
    flex: 1,
    fontSize: 13,
  },
});