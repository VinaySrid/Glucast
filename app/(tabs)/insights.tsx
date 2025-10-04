import React from 'react';
import { SafeAreaView, StatusBar, ScrollView, Text, View } from 'react-native';
import colors from '../../constants/colors';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import { mockMeals, mockSuggestions } from '../../lib/mock';
import { useRouter } from 'expo-router';

export default function InsightsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex:1, backgroundColor: colors.background }}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        <Text style={{ fontSize:20, fontWeight:'600', color: colors.text, marginBottom:20 }}>Your glucose patterns</Text>

        <Card style={{ marginBottom:16 }}>
          <Text style={{ fontSize:16, fontWeight:'600', marginBottom:12, color: colors.text }}>Suggestions to Optimize</Text>
          {mockSuggestions.slice(0,2).map((s, i) => (
            <View key={i} style={{ backgroundColor: colors.background, padding:12, borderRadius:8, marginBottom:8, borderLeftWidth:3, borderLeftColor: colors.success }}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <Text style={{ fontSize:14, fontWeight:'500', color: colors.text, flex:1 }}>{s.title}</Text>
                <Chip text={`${s.delta} mg/dL`} color={colors.success} />
              </View>
              <Text style={{ fontSize:12, color: colors.text, opacity:0.7, marginTop:4 }}>{s.rationale}</Text>
            </View>
          ))}
        </Card>

        <Card style={{ marginBottom:16 }}>
          <Text style={{ fontSize:16, fontWeight:'600', marginBottom:12, color: colors.text }}>🔥 Top Spikers This Week</Text>
          {[
            { food: 'White bread toast', avgPeak: 172 },
            { food: 'Orange juice',     avgPeak: 158 },
            { food: 'Instant oatmeal',  avgPeak: 145 },
          ].map((it, i) => (
            <View key={i} style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:8, borderBottomWidth: i<2?1:0, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.text }}>{it.food}</Text>
              <Chip text={`${it.avgPeak} mg/dL`} color={colors.danger} />
            </View>
          ))}
        </Card>

        <Card style={{ marginBottom:16 }}>
          <Text style={{ fontSize:16, fontWeight:'600', marginBottom:12, color: colors.text }}>✅ Well Tolerated</Text>
          {[
            { food: 'Greek yogurt + berries', avgPeak: 108 },
            { food: 'Grilled chicken salad',  avgPeak: 105 },
            { food: 'Almonds (handful)',      avgPeak: 102 },
          ].map((it, i) => (
            <View key={i} style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:8, borderBottomWidth: i<2?1:0, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.text }}>{it.food}</Text>
              <Chip text={`${it.avgPeak} mg/dL`} color={colors.success} />
            </View>
          ))}
        </Card>

        <Card style={{ marginBottom:16 }}>
          <Text style={{ fontSize:16, fontWeight:'600', marginBottom:12, color: colors.text }}>📊 Weekly Improvement</Text>
          <View style={{ alignItems:'center', marginVertical:16 }}>
            <Text style={{ fontSize:32, fontWeight:'bold', color: colors.success }}>-12 mg/dL</Text>
            <Text style={{ fontSize:14, color: colors.text, opacity:0.7 }}>Average peak reduction</Text>
          </View>
          <Text style={{ fontSize:12, color: colors.text, textAlign:'center', opacity:0.7 }}>This week: 132 mg/dL • Last week: 144 mg/dL</Text>
        </Card>

        <Card style={{ marginBottom:16 }}>
          <Text style={{ fontSize:16, fontWeight:'600', marginBottom:12, color: colors.text }}>⏰ Timing Patterns</Text>
          <Text style={{ fontSize:14, color: colors.text, marginBottom:8 }}>Your glucose responds differently throughout the day:</Text>
          <View style={{ flexDirection:'row', justifyContent:'space-between', marginTop:12 }}>
            <View style={{ alignItems:'center' }}><Text style={{ fontSize:12, color: colors.text, opacity:0.7 }}>Breakfast</Text><Text style={{ fontSize:16, fontWeight:'600', color: colors.warning }}>142 mg/dL</Text></View>
            <View style={{ alignItems:'center' }}><Text style={{ fontSize:12, color: colors.text, opacity:0.7 }}>Lunch</Text><Text style={{ fontSize:16, fontWeight:'600', color: colors.success }}>125 mg/dL</Text></View>
            <View style={{ alignItems:'center' }}><Text style={{ fontSize:12, color: colors.text, opacity:0.7 }}>Dinner</Text><Text style={{ fontSize:16, fontWeight:'600', color: colors.primary }}>135 mg/dL</Text></View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
