import React, { useEffect, useState } from 'react';
import { SafeAreaView, StatusBar, ScrollView, View, Text, TouchableOpacity, Image } from 'react-native';
import colors from '../../constants/colors';
import Card from '../../components/Card';
import PrimaryButton from '../../components/PrimaryButton';
import Chip from '../../components/Chip';
import GlucoseCurve from '../../components/GlucoseCurve';
import { useRouter } from 'expo-router';
import { useUser } from '../context/UserContext';
import { supabase } from '../../lib/supabase';

export default function HomeScreen() {
  const router = useRouter();
  const { user, setUser } = useUser();
  const [recentMeals, setRecentMeals] = useState<any[]>([]);

  useEffect(() => {
    const fetchRecentMeals = async () => {
      if (!user) return;
      const { data, error } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(3);
      if (!error && data) setRecentMeals(data);
    };
    fetchRecentMeals();
  }, [user]);

  return (
    <SafeAreaView style={{ flex:1, backgroundColor: colors.background }}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        <Text style={{ fontSize:24, fontWeight:'600', color: colors.text, marginBottom:20 }}>
          Good afternoon, {user?.first_name} 👋
        </Text>

        <Card style={{ marginBottom:20, alignItems:'center' }}>
          <Text style={{ fontSize:18, fontWeight:'600', marginBottom:16, color: colors.text }}>Log a meal</Text>
          <View style={{ width:60, height:60, borderRadius:30, backgroundColor: colors.primary, justifyContent:'center', alignItems:'center', marginBottom:16 }}>
            <Text style={{ fontSize:30 }}>📸</Text>
          </View>
          <PrimaryButton title="Take Photo" onPress={() => router.push('/(tabs)/log')} />
        </Card>

        <Card style={{ marginBottom:20 }}>
          <Text style={{ fontSize:16, fontWeight:'600', marginBottom:8, color: colors.text }}>Today at a glance</Text>
          <View style={{ flexDirection:'row', alignItems:'center', marginBottom:12 }}>
            <Chip text="+48 mg/dL predicted" color={colors.warning} />
            <Text style={{ marginLeft:12, color: colors.text, opacity:0.7 }}>peak in 75m</Text>
          </View>
          <GlucoseCurve peak={148} confidence="high" />
        </Card>

        <Text style={{ fontSize:16, fontWeight:'600', marginBottom:12, color: colors.text }}>Recent meals</Text>
        {recentMeals.map(m => (
          <Card key={m.id} style={{ marginBottom:12 }}>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              {m.photo_url ? (
                <Image
                  source={{ uri: m.photo_url }}
                  style={{ width: 50, height: 50, borderRadius: 8, marginRight: 12 }}
                  resizeMode="cover"
                />
              ) : (
                <Text style={{ fontSize:24, marginRight:12 }}>🍽️</Text>
              )}
              <View style={{ flex:1 }}>
                <Text style={{ fontSize:16, fontWeight:'500', color: colors.text }}>{m.name}</Text>
                <Text style={{ fontSize:14, color: colors.text, opacity:0.7, marginTop:2 }}>
                  {new Date(m.date).toLocaleString()}
                </Text>
              </View>
              <View style={{ alignItems:'flex-end' }}>
                <Chip text={`-- g carbs`} color={colors.border} textColor={colors.text} />
                <Text style={{ fontSize:12, color: colors.text, opacity:0.7, marginTop:4 }}>Peak: -- mg/dL</Text>
              </View>
            </View>
          </Card>
        ))}

        <Card style={{ backgroundColor: colors.primary, marginTop:20, marginBottom:40 }}>
          <Text style={{ color:'white', fontSize:14, fontWeight:'500', textAlign:'center' }}>
            💡 Adding fiber or a short walk often flattens the curve
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
