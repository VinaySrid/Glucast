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
        {parsedMeal.items && parsedMeal.items.map((it: any, idx: number) => (
          <Text key={idx} style={{ fontSize:16, marginBottom:4 }}>
            • {it.name} - {it.amount} ({it.carbs} carbs, {it.protein} protein, {it.fat} fat)
          </Text>
        ))}
      </Card>
    </ScrollView>
  );
}
