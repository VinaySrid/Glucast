import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import colors from '../../constants/colors';
import Card from '../../components/Card';

export default function MealDetailScreen() {
  const { meal } = useLocalSearchParams();
  const parsedMeal = meal ? JSON.parse(meal as string) : null;
  const router = useRouter();
  const [imageLoaded, setImageLoaded] = React.useState(false);

  if (!parsedMeal) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center' }}>
        <Text>No meal data available.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      key={parsedMeal.id}
      style={{ flex:1, padding:16, backgroundColor: colors.background }}
    >
      <TouchableOpacity onPress={() => router.push('/timeline')} style={{ marginBottom: 16 }}>
        <Text style={{ color: colors.primary, fontSize: 16 }}>← Back to Timeline</Text>
      </TouchableOpacity>
      <Card style={{ padding:16 }}>
        {parsedMeal.photo_url && (
          <View style={{ width: '100%', height: 200, marginBottom: 16 }}>
            {!imageLoaded && (
              <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#f0f0f0', borderRadius:8 }}>
                <Text>Loading image...</Text>
              </View>
            )}
            <Image
              source={parsedMeal.photo_url}
              style={{ width:'100%', height:'100%', borderRadius:8 }}
              cachePolicy="disk"
              onLoadEnd={() => setImageLoaded(true)}
            />
          </View>
        )}
        <Text style={{ fontSize:20, fontWeight:'600', marginBottom:8 }}>
          {parsedMeal.description || 'Meal'}
        </Text>
        <Text style={{ fontSize:16, marginBottom:16 }}>
          {new Date(parsedMeal.date).toLocaleString()}
        </Text>

        <Text style={{ fontSize:18, fontWeight:'600', marginBottom:8 }}>Ingredients:</Text>
        {parsedMeal.items && parsedMeal.items.map((it: any, idx: number) => {
          // Compose ingredient line with name, amount, name_user/unit_name, and total grams if present
          let ingredientLine = `• ${it.name}`;
          if (it.amount !== undefined && it.amount !== null) {
            ingredientLine += ` - ${it.amount}`;
          }
          if (it.name_user) {
            ingredientLine += ` ${it.name_user}`;
          } else if (it.unit_name) {
            ingredientLine += ` ${it.unit_name}`;
          }
          if (it.total_grams !== undefined && it.total_grams !== null) {
            ingredientLine += ` (${it.total_grams} g)`;
          }
          return (
            <Text key={idx} style={{ fontSize:16, marginBottom:4 }}>
              {ingredientLine}
            </Text>
          );
        })}
      </Card>
      {parsedMeal.total_macros && (
        <View
          style={{
            marginTop: 24,
            paddingHorizontal: 0,
            borderRadius: 16,
            backgroundColor: '#f8f9fa',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
            elevation: 2,
            padding: 18,
            marginHorizontal: 4,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
              color: colors.primary,
              marginBottom: 18,
              textAlign: 'center',
              letterSpacing: 0.2,
            }}
          >
            Total Macros
          </Text>
          {[
            { label: 'Calories', value: parsedMeal.total_macros.calories, unit: 'kcal' },
            { label: 'Protein', value: parsedMeal.total_macros.protein, unit: 'g' },
            { label: 'Carbs', value: parsedMeal.total_macros.carbs, unit: 'g' },
            { label: 'Fat', value: parsedMeal.total_macros.fat, unit: 'g' },
            { label: 'Fiber', value: parsedMeal.total_macros.fiber, unit: 'g' },
            { label: 'Sugar', value: parsedMeal.total_macros.sugar, unit: 'g' },
          ].map((macro, idx) => (
            <View
              key={macro.label}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingVertical: 10,
                paddingHorizontal: 8,
                backgroundColor: idx % 2 === 0 ? '#f8f9fa' : '#eef2f3',
                borderRadius: 8,
                marginBottom: idx === 5 ? 0 : 4,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '500', color: '#222' }}>{macro.label}</Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '500',
                  color: '#222',
                  textAlign: 'right',
                  minWidth: 70,
                }}
              >
                {macro.value !== undefined ? `${macro.value.toFixed(1)} ${macro.unit}` : 'N/A'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
