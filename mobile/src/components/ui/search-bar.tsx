import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Fonts, Spacing, useThemeColor } from '@/constants/useThemeColor';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  rightAction?: React.ReactNode;
  onSubmitEditing?: () => void;
}

export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search...',
  autoFocus = false,
  rightAction,
  onSubmitEditing,
}: SearchBarProps) {
  const theme = useThemeColor();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Ionicons name="search" size={18} color={theme.mutedFg} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.mutedFg}
        autoFocus={autoFocus}
        onSubmitEditing={onSubmitEditing}
        style={[styles.input, { color: theme.text, fontFamily: Fonts.sans }]}
      />
      {typeof value === 'string' && value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={theme.mutedFg} />
        </Pressable>
      ) : null}
      {rightAction}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 46,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
});