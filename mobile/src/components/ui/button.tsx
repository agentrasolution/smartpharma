import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children: React.ReactNode;
}

const SIZE_HEIGHTS: Record<ButtonSize, number> = {
  sm: 36,
  md: 44,
  lg: 52,
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  style,
  textStyle,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const theme = useThemeColor();

  const styles = StyleSheet.create({
    base: {
      height: SIZE_HEIGHTS[size],
      borderRadius: 10,
      paddingHorizontal: size === 'sm' ? Spacing.three : Spacing.four,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: Spacing.two,
    },
    variantPrimary: { backgroundColor: theme.accent },
    variantSecondary: { backgroundColor: theme.surface2, borderWidth: 1, borderColor: theme.border },
    variantOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.accent },
    variantGhost: { backgroundColor: 'transparent' },
    variantDanger: { backgroundColor: theme.danger },
    disabled: { opacity: 0.5 },
    fullWidth: { width: '100%' },
    textPrimary: { color: theme.accentFg, fontSize: 15, fontWeight: '600' },
    textSecondary: { color: theme.text, fontSize: 15, fontWeight: '600' },
    textOutline: { color: theme.accent, fontSize: 15, fontWeight: '600' },
    textGhost: { color: theme.accent, fontSize: 15, fontWeight: '600' },
    textDanger: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    textSm: { fontSize: 13 },
  });

  const variantTextMap: Record<ButtonVariant, keyof typeof styles> = {
    primary: 'textPrimary',
    secondary: 'textSecondary',
    outline: 'textOutline',
    ghost: 'textGhost',
    danger: 'textDanger',
  };

  return (
    <Pressable
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        styles[variant === 'primary' ? 'variantPrimary' : variant === 'secondary' ? 'variantSecondary' : variant === 'outline' ? 'variantOutline' : variant === 'danger' ? 'variantDanger' : 'variantGhost'],
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        pressed && !(disabled || loading) && { opacity: 0.85 },
        style,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator size="small" color={variant === 'primary' || variant === 'danger' ? '#fff' : theme.accent} />
      ) : (
        <>
          {leftIcon}
          <Text
            style={[
              styles[variantTextMap[variant]],
              size === 'sm' && styles.textSm,
              { fontFamily: Fonts.sans },
              textStyle,
            ]}>
            {children}
          </Text>
        </>
      )}
    </Pressable>
  );
}