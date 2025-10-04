import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { router } from 'expo-router';
import TopAppBar from '../components/TopBar';
import Carousel from '../components/Carousel';
import colors from '../constants/colors';

const items = [
  { title: 'See ahead', body: 'Glucast forecasts glucose impact from your meal.' },
  { title: 'Understand why', body: 'We explain drivers behind the prediction.' },
  { title: 'Act with confidence', body: 'Simple swaps to reduce spikes.' },
];

export default function Onboarding() {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <TopAppBar title="Welcome" />
      <ScrollView contentContainerStyle={styles.container}>
        <Image source={require('../assets/images/logo.png')} style={styles.logo} />
        <Text style={styles.title}>AI foresight for better glucose control</Text>
        <View style={{ height: 16 }} />
        <Carousel items={items} />
        <View style={{ height: 24 }} />
        <Pressable onPress={() => router.replace('/login')} style={styles.primaryBtn}>
          <Text style={styles.primaryText}>Get started</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: 'center' },
  logo: { width: 80, height: 80, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center', color: '#0F172A' },
  primaryBtn: {
    backgroundColor: '#1E63F3',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  primaryText: { color: '#fff', fontWeight: '700' },
});