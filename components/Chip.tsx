import React from 'react';
import { View, Text } from 'react-native';
import colors from '../constants/colors';

export default function Chip({ text, color = colors.primary, textColor = 'white' }: { text: string; color?: string; textColor?: string; }) {
  return (
    <View style={{ backgroundColor: color, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, alignSelf: 'flex-start' }}>
      <Text style={{ color: textColor, fontSize: 12, fontWeight: '500' }}>{text}</Text>
    </View>
  );
}