import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { useThemeColor } from '@/constants/useThemeColor';

export function BrandSplash() {
  const theme = useThemeColor();
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    SplashScreen.hideAsync().then(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 350,
        delay: 150,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    });
  }, [opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.overlay, { backgroundColor: theme.background, opacity }]}>
      <View style={[styles.logoWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Image
          source={require('@/assets/images/faraz-logo.png')}
          style={styles.logo}
          contentFit="cover"
        />
      </View>
      <Text style={[styles.name, { color: theme.text }]}>Faraz Pharmacy</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    zIndex: 1000,
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 64,
    height: 64,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});