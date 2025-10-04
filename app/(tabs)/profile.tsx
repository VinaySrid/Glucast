import React, { useContext } from 'react';
import { SafeAreaView, StatusBar, ScrollView, Text, View, TouchableOpacity, TextInput } from 'react-native';
import colors from '../../constants/colors';
import Card from '../../components/Card';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useUser } from '../context/UserContext';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, setUser } = useUser();

  if (!user) {
    return (
      <SafeAreaView style={{ flex:1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>Loading...</Text>
      </SafeAreaView>
    );
  }

  const updateProfileField = async (field: string, value: string) => {
    try {
      const updates: any = {};
      if (field === 'age' || field === 'weight') {
        updates[field] = value === '' ? null : Number(value);
      } else {
        updates[field] = value;
      }
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      if (error) {
        console.error('Failed to update profile:', error);
      } else {
        setUser({ ...user, ...updates });
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
    }
  };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor: colors.background }}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:100 }}>
        <Card style={{ alignItems:'center', marginBottom:20 }}>
          <View style={{ width:80, height:80, borderRadius:40, backgroundColor:colors.primary, justifyContent:'center', alignItems:'center', marginBottom:16 }}>
            <Text style={{ color:'white', fontSize:32, fontWeight:'bold' }}>{user.first_name ? user.first_name[0] : ''}</Text>
          </View>
          <Text style={{ fontSize:20, fontWeight:'600', color: colors.text, marginBottom:4 }}>
            {user.first_name || user.last_name ? `${user.first_name} ${user.last_name}`.trim() : ''}
          </Text>
          <Text style={{ fontSize:14, color: colors.text, opacity:0.7 }}>
            {user.email}
          </Text>
        </Card>

        <Card style={{ marginBottom: 20 }}>
          <Text style={{ fontSize:16, fontWeight:'600', marginBottom:16, color: colors.text }}>Personal Info</Text>
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.text, marginBottom: 4 }}>First Name</Text>
            <TextInput
              value={user.first_name ?? ''}
              onChangeText={(text) => updateProfileField('first_name', text)}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text }}
              placeholder="First Name"
              placeholderTextColor={colors.text + '99'}
            />
          </View>
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.text, marginBottom: 4 }}>Last Name</Text>
            <TextInput
              value={user.last_name ?? ''}
              onChangeText={(text) => updateProfileField('last_name', text)}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text }}
              placeholder="Last Name"
              placeholderTextColor={colors.text + '99'}
            />
          </View>
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.text, marginBottom: 4 }}>Age</Text>
            <TextInput
              value={user.age != null ? String(user.age) : ''}
              onChangeText={(text) => updateProfileField('age', text)}
              keyboardType="numeric"
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text }}
              placeholder="Age"
              placeholderTextColor={colors.text + '99'}
            />
          </View>
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.text, marginBottom: 4 }}>Gender</Text>
            <TextInput
              value={user.gender ?? ''}
              onChangeText={(text) => updateProfileField('gender', text)}
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text }}
              placeholder="Gender"
              placeholderTextColor={colors.text + '99'}
            />
          </View>
          <View>
            <Text style={{ color: colors.text, marginBottom: 4 }}>Weight (kg)</Text>
            <TextInput
              value={user.weight != null ? String(user.weight) : ''}
              onChangeText={(text) => updateProfileField('weight', text)}
              keyboardType="numeric"
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, color: colors.text }}
              placeholder="Weight"
              placeholderTextColor={colors.text + '99'}
            />
          </View>
        </Card>

        <Card style={{ marginBottom:16 }}>
          <Text style={{ fontSize:16, fontWeight:'600', marginBottom:16, color: colors.text }}>Preferences</Text>
          <View style={{ marginBottom:16 }}>
            <Text style={{ fontSize:14, color: colors.text, marginBottom:8 }}>Units</Text>
            <View style={{ flexDirection:'row' }}>
              <TouchableOpacity style={{ backgroundColor: colors.primary, paddingHorizontal:16, paddingVertical:8, borderRadius:8, marginRight:8 }}>
                <Text style={{ color:'white', fontSize:14 }}>mg/dL</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ backgroundColor: colors.border, paddingHorizontal:16, paddingVertical:8, borderRadius:8 }}>
                <Text style={{ color: colors.text, fontSize:14 }}>mmol/L</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ marginBottom:16 }}>
            <Text style={{ fontSize:14, color: colors.text, marginBottom:8 }}>Dietary Style</Text>
            <TouchableOpacity style={{ borderWidth:1, borderColor: colors.border, borderRadius:8, padding:12, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
              <Text style={{ color: colors.text }}>None specified</Text>
              <Text style={{ color: colors.primary }}>→</Text>
            </TouchableOpacity>
          </View>

          <View>
            <Text style={{ fontSize:14, color: colors.text, marginBottom:8 }}>Target Peak</Text>
            <TouchableOpacity style={{ borderWidth:1, borderColor: colors.border, borderRadius:8, padding:12, flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
              <Text style={{ color: colors.text }}>140 mg/dL</Text>
              <Text style={{ color: colors.primary }}>→</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={{ marginBottom:16 }}>
          <Text style={{ fontSize:16, fontWeight:'600', marginBottom:16, color: colors.text }}>Data & Privacy</Text>
          <TouchableOpacity style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:12, borderBottomWidth:1, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.text }}>Export my data</Text><Text style={{ color: colors.primary }}>→</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:12 }}>
            <Text style={{ color: colors.danger }}>Delete account</Text><Text style={{ color: colors.danger }}>→</Text>
          </TouchableOpacity>
        </Card>

        <Card style={{ marginBottom:16 }}>
          <Text style={{ fontSize:16, fontWeight:'600', marginBottom:16, color: colors.text }}>Support</Text>
          {['How Glucast works','Privacy Policy','Contact Support'].map((t, i) => (
            <TouchableOpacity key={t} style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:12, borderBottomWidth: i<2?1:0, borderBottomColor: colors.border }}>
              <Text style={{ color: colors.text }}>{t}</Text><Text style={{ color: colors.primary }}>→</Text>
            </TouchableOpacity>
          ))}
        </Card>

        <TouchableOpacity
          onPress={async () => {
            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          }}
          style={{ flexDirection:'row', justifyContent:'center', alignItems:'center', paddingVertical:12, marginBottom:20 }}
        >
          <Text style={{ color: colors.danger, fontSize:16 }}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ alignItems:'center', marginTop:20, marginBottom:40 }}>
          <Text style={{ fontSize:14, color: colors.text, opacity:0.7, textAlign:'center', lineHeight:20 }}>
            "AI-powered foresight for better glucose control—private, clear, and practical."
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
