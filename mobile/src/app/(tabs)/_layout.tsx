import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { useThemeColor } from '@/constants/useThemeColor';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(focused: IconName, outline: IconName) {
  return ({ color, size, focused: isFocused }: { color: string; size: number; focused: boolean }) => (
    <Ionicons name={isFocused ? focused : outline} size={size} color={color} />
  );
}

export default function TabLayout() {
  const theme = useThemeColor();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.mutedFg,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="pos"
        options={{ title: 'POS', tabBarIcon: tabIcon('cart', 'cart-outline') }}
      />
      <Tabs.Screen
        name="products"
        options={{ title: 'Products', tabBarIcon: tabIcon('medkit', 'medkit-outline') }}
      />
      <Tabs.Screen
        name="customers"
        options={{ title: 'Customers', tabBarIcon: tabIcon('people', 'people-outline') }}
      />
      <Tabs.Screen
        name="invoices"
        options={{ title: 'Invoices', tabBarIcon: tabIcon('receipt', 'receipt-outline') }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: tabIcon('menu', 'menu-outline') }}
      />
    </Tabs>
  );
}