import React, { useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export type CarouselItem = { title: string; body: string };

export default function Carousel({ items }: { items: CarouselItem[] }) {
  const ref = useRef<ScrollView>(null);

  return (
    <View style={styles.wrap}>
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'stretch' }}
      >
        {items.map((it, idx) => (
          <View key={idx} style={[styles.card, { width: width - 48 }]}>
            <Text style={styles.title}>{it.title}</Text>
            <Text style={styles.body}>{it.body}</Text>
          </View>
        ))}
      </ScrollView>
      {/* Dots */}
      <View style={styles.dots}>
        {items.map((_, i) => (
          <View key={i} style={styles.dot} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
  card: {
    marginHorizontal: 8,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E5E7EB',
  },
  title: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  body: { fontSize: 14, color: '#334155' },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 6 },
  dot: {
    width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1',
  },
});