import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BrandSplash } from '@/components/brand-splash';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ServerSettingsProvider } from '@/contexts/ServerSettingsContext';
import { AppTheme } from '@/constants/theme';
import { useThemeColor } from '@/constants/useThemeColor';

function RootNavigator() {
  const { isAuthenticated } = useAuth();
  const theme = useThemeColor();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.accent,
        headerTitleStyle: { color: theme.text, fontSize: 15, fontWeight: '700' },
        headerShadowVisible: false,
      }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="sale/[id]" options={{ headerShown: true, title: 'Sale Detail' }} />
        <Stack.Screen name="customer/[id]" options={{ headerShown: true, title: 'Customer' }} />
        <Stack.Screen name="stock" options={{ headerShown: true, title: 'Stock Purchases' }} />
        <Stack.Screen name="arrears" options={{ headerShown: true, title: 'Arrears' }} />
        <Stack.Screen name="settings" options={{ headerShown: true, title: 'Settings' }} />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ServerSettingsProvider>
          <AuthProvider>
            <ThemeProvider value={colorScheme === 'dark' ? AppTheme.dark : AppTheme.light}>
              <StatusBar style="auto" />
              <BrandSplash />
              <RootNavigator />
            </ThemeProvider>
          </AuthProvider>
        </ServerSettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}