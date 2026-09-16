import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/card';
import { ListRow } from '@/components/ui/list-row';
import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';
import { useAuth } from '@/contexts/AuthContext';
import { useServerSettings } from '@/contexts/ServerSettingsContext';

export default function MoreScreen() {
  const theme = useThemeColor();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { baseUrl } = useServerSettings();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text, fontFamily: Fonts.sans }]}>More</Text>
      </View>

      <View style={styles.userCard}>
        <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
          <Text style={[styles.avatarText, { color: theme.accentFg }]}>{user?.username?.[0]?.toUpperCase() ?? 'U'}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={[styles.userName, { color: theme.text, fontFamily: Fonts.sans }]}>
            {user?.username ?? 'User'}
          </Text>
          <Text style={[styles.userRole, { color: theme.textSecondary }]}>
            {user?.role ?? 'pharmacist'} · {baseUrl}
          </Text>
        </View>
      </View>

      <Card>
        <ListRow
          icon="cube-outline"
          iconColor={theme.info}
          title="Stock Purchases"
          subtitle="Record and review stock purchases"
          onPress={() => router.push('/stock')}
        />
        <ListRow
          icon="cash-outline"
          iconColor={theme.warning}
          title="Arrears"
          subtitle="Outstanding customer payments"
          onPress={() => router.push('/arrears')}
        />
        <ListRow
          icon="server-outline"
          iconColor={theme.accent}
          title="Server URL"
          subtitle={baseUrl}
          onPress={() => router.push('/settings')}
        />
        <ListRow
          icon="settings-outline"
          iconColor={theme.textSecondary}
          title="Settings"
          subtitle="Server and account"
          onPress={() => router.push('/settings')}
          last
        />
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
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
  },
  userRole: {
    fontSize: 12,
  },
});