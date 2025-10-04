import React from 'react';
import { TouchableOpacity } from 'react-native';
import colors from '../constants/colors';

export default function Card({ children, style, onPress }: any) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.95 : 1}
      onPress={onPress}
      style={[{
        backgroundColor: colors.card, borderRadius: 12, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 3, elevation: 2, marginVertical: 4
      }, style]}
    >
      {children}
    </TouchableOpacity>
  );
}