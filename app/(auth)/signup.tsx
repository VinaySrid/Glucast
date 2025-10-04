import React, { useState } from 'react';
import { SafeAreaView, ScrollView, View, Text, TextInput, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard, TouchableWithoutFeedback } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import GlucasLogo from '../../components/GlucasLogo';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

export default function Signup() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);


  const handleSignUp = async () => {
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      let { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (!session) {
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        console.log("Sign in after signup:", signInData, signInError);
        session = signInData.session;
      }
      console.log("Session it still says  signup/signin:", session);
      // Log the full response for debugging
      console.log('Supabase signUp response:', { data, error });
      if (error) {
        Alert.alert('Error', error.message);
        setErrorMessage(error.message);
      } else if (data?.user) {
        // Insert or upsert profile data
        const { user } = data;
        console.log("Supabase user object:", user);
        console.log("Supabase user.id being used for profile:", user?.id);
        // Guarantee safe values and always include id
        let safeAge: number | null = null;
        if (age === '') {
          safeAge = null;
        } else if (!isNaN(Number(age))) {
          safeAge = parseInt(age, 10);
        }
        let safeWeight: number | null = null;
        if (weight === '') {
          safeWeight = null;
        } else if (!isNaN(Number(weight))) {
          safeWeight = parseFloat(weight);
        }
        const profileData = {
          id: user.id,
          first_name: firstName ?? '',
          last_name: lastName ?? '',
          age: safeAge,
          gender: gender ?? '',
          weight: safeWeight,
        };
        console.log("Final profileData:", profileData);
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(profileData);
        if (profileError) {
          Alert.alert('Profile Error', profileError.message);
          setErrorMessage(profileError.message);
          return;
        }
        Alert.alert('Success', 'User created successfully!');
        router.replace('/(tabs)');
      } else if (data?.session || data) {
        Alert.alert('Notice', `Session or data returned: ${JSON.stringify(data)}`);
      } else {
        Alert.alert('Unknown', 'Signup completed, but no user or error returned.');
      }
    } catch (e: any) {
      Alert.alert('Exception', e?.message || String(e));
      setErrorMessage(e?.message || String(e));
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={80} // adjust as needed for header spacing
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}
            onScroll={(e) => {
              if (e.nativeEvent.contentOffset.y <= 0) {
                Keyboard.dismiss();
              }
            }}
            scrollEventThrottle={16}
          >
        <View style={{ position: 'absolute', top: 50, left: 20, zIndex: 1 }}>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
        </View>
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <GlucasLogo />
        </View>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, marginBottom: 8 }}>First Name</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 16,
            }}
          />
        </View>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, marginBottom: 8 }}>Last Name</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 16,
            }}
          />
        </View>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, marginBottom: 8 }}>Age</Text>
          <TextInput
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 16,
            }}
          />
        </View>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, marginBottom: 8 }}>Gender</Text>
          <TextInput
            value={gender}
            onChangeText={setGender}
            autoCapitalize="words"
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 16,
            }}
          />
        </View>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, marginBottom: 8 }}>Weight</Text>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 16,
            }}
          />
        </View>
        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, marginBottom: 8 }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 16,
            }}
          />
        </View>
        <View style={{ marginBottom: 40 }}>
          <Text style={{ fontSize: 16, marginBottom: 8 }}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              fontSize: 16,
            }}
          />
        </View>
        <TouchableOpacity
          onPress={handleSignUp}
          style={{
            backgroundColor: '#007bff',
            paddingVertical: 12,
            borderRadius: 8,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontSize: 16 }}>Sign Up</Text>
        </TouchableOpacity>
            {errorMessage ? (
              <Text style={{ color: 'red', marginTop: 12, textAlign: 'center' }}>
                {errorMessage}
              </Text>
            ) : null}
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
