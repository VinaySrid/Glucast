import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import colors from '../constants/colors';

export default function PrimaryButton({
  title,
  onPress,
  disabled,
  style,
  loading,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
  <TouchableOpacity
  onPress={onPress}
  disabled={isDisabled}
  style={[styles.button, isDisabled && styles.disabled, style]}
>
  <Text style={styles.text}>{loading ? "Loading..." : title}</Text>
</TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});