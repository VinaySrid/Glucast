import React, { useState, useCallback } from 'react';
import { SafeAreaView, StatusBar, View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import colors from '../../constants/colors';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Meal = {
  id: string;
  user_id?: string;
  name?: string;
  context?: string;
  items?: any[];
  date: string;
  photo_url?: string;
  synced?: boolean;
  description?: string;
};

export default function TimelineScreen() {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState<'All'|'Day'|'Week'|'Month'>('Day');
  const [meals, setMeals] = useState<Meal[]>([]);

  const handleDeleteMeal = async (id: string) => {
    // Regex for UUID v4 (loosely: 8-4-4-4-12 hex digits)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    let supabaseError = null;
    try {
      if (uuidRegex.test(id)) {
        // Only attempt Supabase deletion if id is a UUID
        const { error } = await supabase.from('meals').delete().eq('id', id);
        if (error) {
          supabaseError = error;
          console.error('Supabase delete failed:', error.message, error);
        }
      }
      // Always update local state and storage
      const updatedMeals = meals.filter(m => m.id !== id);
      setMeals(updatedMeals);
      await AsyncStorage.setItem("meals", JSON.stringify(updatedMeals));
      if (supabaseError) {
        // Supabase deletion failed, but local deletion succeeded
        // Optionally show user a message here
      }
    } catch (error) {
      // This error is likely from local update/AsyncStorage
      console.error('Failed to delete meal locally', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const loadMeals = async () => {
        try {
          const localMealsJson = await AsyncStorage.getItem("meals");
          let unsyncedLocalMeals: Meal[] = [];
          if (localMealsJson) {
            const localMeals: Meal[] = JSON.parse(localMealsJson);
            unsyncedLocalMeals = localMeals.filter(m => m.synced === false);
          }

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            setMeals([]);
            return;
          }
          const { data: supabaseMeals, error } = await supabase
            .from('meals')
            .select('*')
            .eq('user_id', user.id)
            .order('date', { ascending: false });
          if (error) {
            console.error('Failed to load meals from Supabase', error);
            if (!localMealsJson) {
              setMeals([]);
            }
          } else {
            // Merge meals for display, removing duplicates by id, but only persist unsynced meals to AsyncStorage
            const mergedMeals = [...supabaseMeals, ...unsyncedLocalMeals];
            const uniqueMeals = mergedMeals.filter(
              (meal, index, self) => index === self.findIndex(m => m.id === meal.id)
            );
            setMeals(uniqueMeals);
            // Only persist unsynced meals to AsyncStorage
            await AsyncStorage.setItem("meals", JSON.stringify(unsyncedLocalMeals));
          }
        } catch (error) {
          console.error('Failed to load meals', error);
          setMeals([]);
        }
      };
      loadMeals();
    }, [])
  );

  const now = new Date();
  let filteredMeals = meals;
  if (selectedPeriod === 'All') {
    filteredMeals = meals;
  } else if (selectedPeriod === 'Day') {
    filteredMeals = meals.filter(m => {
      const d = new Date(m.date);
      return d.toDateString() === now.toDateString();
    });
  } else if (selectedPeriod === 'Week') {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    filteredMeals = meals.filter(m => {
      const d = new Date(m.date);
      const isInWeek = d >= sevenDaysAgo && d < now;
      const isSameDay = d.toDateString() === now.toDateString();
      return isInWeek && !isSameDay;
    });
  } else if (selectedPeriod === 'Month') {
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    filteredMeals = meals.filter(m => {
      const d = new Date(m.date);
      const isSameMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      const isSameDay = d.toDateString() === now.toDateString();
      const isPastSevenDays = d >= sevenDaysAgo && d < now;
      return isSameMonth && !isSameDay && !isPastSevenDays;
    });
  }

  return (
    <SafeAreaView style={{ flex:1, backgroundColor: colors.background }}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <View style={{ flex:1 }}>
        <View style={{ flexDirection:'row', backgroundColor: colors.card, margin:16, borderRadius:12, padding:4 }}>
          {(['Day','Week','Month','All'] as const).map(p => (
            <TouchableOpacity key={p} onPress={() => setSelectedPeriod(p)}
              style={{ flex:1, paddingVertical:12, alignItems:'center', backgroundColor: selectedPeriod===p? colors.primary:'transparent', borderRadius:8 }}>
              <Text style={{ color: selectedPeriod===p? 'white': colors.text, fontWeight: selectedPeriod===p? '600':'400' }}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
          <Text style={{ fontSize:18, fontWeight:'600', color: colors.text, marginBottom:16 }}>Today</Text>

          {filteredMeals.map(m => {
            return (
              <Card key={m.id} style={{ marginBottom:12 }}>
                <TouchableOpacity onPress={() => router.push({ pathname: '/mealDetail', params: { meal: JSON.stringify(m) } })}>
                  <View style={{ flexDirection:'row', alignItems:'center' }}>
                    <TouchableOpacity onPress={() => handleDeleteMeal(m.id)} style={{ paddingHorizontal: 8, paddingVertical:4, marginRight:8 }}>
                      <Ionicons name="trash-outline" size={22} color="red" />
                    </TouchableOpacity>
                    {m.photo_url ? (
                      <Image source={{ uri: m.photo_url }} style={{ width:50, height:50, borderRadius:8, marginRight:16 }} />
                    ) : (
                      <Text style={{ fontSize:32, marginRight:16 }}>🍽️</Text>
                    )}
                    <View style={{ flex:1 }}>
                      <Text style={{ fontSize:16, fontWeight:'500', color: colors.text }}>
                        {m.name || m.description || 'Meal'}
                      </Text>
                      <Text style={{ fontSize:14, color: colors.text, opacity:0.7, marginTop:2 }}>
                        {new Date(m.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {new Date(m.date).toLocaleTimeString()}
                      </Text>
                    </View>
                    <Text style={{ fontSize:16, color: colors.primary }}>→</Text>
                  </View>
                </TouchableOpacity>
              </Card>
            )
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}
