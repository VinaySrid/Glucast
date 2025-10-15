import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, View, Text, TextInput, Alert, TouchableOpacity } from 'react-native';
import GlucasLogo from '../../components/GlucasLogo';
import { supabase } from '../../lib/supabase';
import { Picker } from '@react-native-picker/picker';

export default function Questions() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [weight, setWeight] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();

  const handleSubmit = async () => {
    console.log("Submit button pressed");
    console.log('handleSubmit triggered');

    // Input validation
    if (firstName.trim() === '') {
      Alert.alert('Validation Error', 'First Name is required.');
      return;
    }
    if (lastName.trim() === '') {
      Alert.alert('Validation Error', 'Last Name is required.');
      return;
    }
    const ageNumber = parseInt(age, 10);
    if (isNaN(ageNumber) || ageNumber <= 0) {
      Alert.alert('Validation Error', 'Age must be a valid number greater than 0.');
      return;
    }
    const weightNumber = parseFloat(weight);
    if (isNaN(weightNumber) || weightNumber <= 0) {
      Alert.alert('Validation Error', 'Weight must be a valid number greater than 0.');
      return;
    }

    try {
      setSubmitting(true);
      // Get the current authenticated user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('Unable to get user:', userError);
        Alert.alert('Error', userError?.message || 'Unable to get user information. Please sign in again.');
        return;
      }

      // Upsert into profiles table
      const { data, error } = await supabase
        .from('profiles')
        .upsert([
          {
            id: user.id,
            first_name: firstName,
            last_name: lastName,
            age: ageNumber,
            gender: gender,
            weight: weightNumber,
          }
        ], { onConflict: 'id' });

      console.log("Upsert result:", { data, error });

      if (error) {
        console.error('Failed to upsert profile:', error);
        Alert.alert('Error', error.message || 'Failed to save profile information.');
        return;
      }

      // Navigate to the home tab explicitly
      router.replace('../(tabs)/index');
    } finally {
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = firstName.trim() === '';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior="never"
      >
        <View style={{ alignItems: 'center', marginBottom: 40 }}>
          <GlucasLogo />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text>First Name</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text>Last Name</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text>Age</Text>
          <TextInput
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }}
          />
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text>Gender</Text>
          <View style={{
            borderWidth: 1,
            borderColor: '#ccc',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            <Picker
              selectedValue={gender}
              onValueChange={(itemValue) => setGender(itemValue)}
              style={{ height: 48, width: '100%' }}
            >
              <Picker.Item label="Male" value="Male" />
              <Picker.Item label="Female" value="Female" />
              <Picker.Item label="Prefer not to say" value="Prefer not to say" />
            </Picker>
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text>Weight</Text>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            keyboardType="numeric"
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }}
          />
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitDisabled || submitting}
          style={{ padding: 16, backgroundColor: (isSubmitDisabled || submitting) ? '#7aa7ff' : 'blue', marginTop: 20, alignItems: 'center', borderRadius: 8 }}
        >
          <Text style={{ color: 'white' }}>{submitting ? 'Saving…' : 'Submit'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
