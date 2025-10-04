import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import TopBar from '../../components/TopBar';
import { Card } from '../../components/Card';
import GlucoseChart from '../../components/GlucoseCurve';
import MacroChips from '../../components/Chip';
import SuggestionList from '../../components/SuggestionList';
import { Link } from 'expo-router';

export default function MealDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <TopBar title={`Meal #${id}`} />
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.h1}>Meal details</Text>
          <Text style={styles.p}>Placeholder information for meal {id}.</Text>
          <View style={{ height: 10 }} />
          <GlucoseChart />
        </Card>

        <Card style={{ marginBottom: 16 }}>
          <Text style={styles.h2}>Nutrition</Text>
          <View style={{ height: 8 }} />
          <MacroChips carbs={60} fiber={5} protein={22} fat={15} />
        </Card>

        <Card>
          <Text style={styles.h2}>Suggestions</Text>
          <View style={{ height: 8 }} />
          <SuggestionList
            items={[
              { text: 'Reduce portion 20% (−10 mg/dL)', impact: -10 },
              { text: 'Add veggies/fiber (−8 mg/dL)', impact: -8 },
            ]}
          />
          <View style={{ height: 12 }} />
          <Link href="/(tabs)/insights" asChild>
            <Pressable style={styles.primaryBtn}>
              <Text style={styles.primaryText}>See insights</Text>
            </Pressable>
          </Link>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  h2: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  p: { color: '#475569', marginTop: 6 },
  primaryBtn: { backgroundColor: '#0A66FF', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700' },
});
