import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SuggestionList({ items }: { items: { text: string; impact?: number }[] }) {
  return (
    <View style={{ gap: 10 }}>
      {items.map((it, idx) => (
        <View key={idx} style={styles.row}>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          <Text style={styles.text}>
            {it.text}
            {!!it.impact && <Text style={{ color: '#0A66FF', fontWeight: '700' }}> ({it.impact > 0 ? '+' : ''}{it.impact} mg/dL)</Text>}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { color: '#0F172A' },
});