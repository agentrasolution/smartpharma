import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';

export interface InputProps extends Omit<TextInputProps, 'style'> {
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  error?: boolean;
}

export function Input({ containerStyle, inputStyle, error = false, multiline, ...rest }: InputProps) {
  const theme = useThemeColor();

  return (
    <View
      style={[
        styles.container,
        {
          borderColor: error ? theme.danger : theme.border,
          backgroundColor: theme.surface,
          minHeight: multiline ? 80 : undefined,
        },
        containerStyle,
      ]}>
      <TextInput
        multiline={multiline}
        {...rest}
        placeholderTextColor={rest.placeholderTextColor ?? theme.mutedFg}
        style={[
          styles.input,
          {
            color: theme.text,
            fontFamily: Fonts.sans,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          inputStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
  },
  input: {
    fontSize: 15,
    paddingVertical: 12,
  },
});