import React, { useEffect, useRef, useState } from 'react';
import { StatusBar, ScrollView, View, Text, TextInput, Dimensions, Alert, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../../constants/colors';
import TopBar from '../../components/TopBar';
import PrimaryButton from '../../components/PrimaryButton';
import Card from '../../components/Card';
import GlucasLogo from '../../components/GlucasLogo';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase'; 

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputContainerRef = useRef<View>(null);
  const router = useRouter();

  const slides = [
    { title: 'Accurate predictions', subtitle: 'See your expected glucose curve for the next 3–4 hours.', icon: '📊' },
    { title: 'Clear explanations',   subtitle: 'Understand why: carbs, fiber, timing, activity, and context.', icon: '💡' },
    { title: 'Personalized tweaks',  subtitle: 'Swap, resize, or walk 10 min to trim the spike.', icon: '⚡' },
    { title: 'Private by design',    subtitle: 'Data encrypted. You stay in control.', icon: '🔒' },
  ];

  useEffect(() => {
    const id = setInterval(() => {
      const next = (currentSlide + 1) % slides.length;
      setCurrentSlide(next);
      scrollRef.current?.scrollTo({ x: next * (SCREEN_WIDTH * 0.85 + 16), animated: true });
    }, 4000);
    return () => clearInterval(id);
  }, [currentSlide]);


  // Keyboard-aware scrolling
  useEffect(() => {
    const keyboardShowListener = Keyboard.addListener('keyboardDidShow', (e) => {
      const keyboardHeight = e.endCoordinates?.height || 0;
      scrollViewRef.current?.scrollTo({ y: keyboardHeight, animated: true });
    });
    const keyboardHideListener = Keyboard.addListener('keyboardDidHide', () => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });
    return () => {
      keyboardShowListener.remove();
      keyboardHideListener.remove();
    };
  }, []);

  const handleContinue = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMessage(error.message);
    } else {
      setErrorMessage(null);
      router.replace('/(tabs)');
    }
  };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor: colors.background }}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
        showHideTransition="fade"
      />
      <StatusBar
        barStyle="dark-content"
        backgroundColor={colors.background}
        showHideTransition="fade"
      />
      <TopBar title="" />
      <KeyboardAvoidingView
        style={{ flex:1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ flexGrow:1, padding:20, paddingBottom:80 }}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            if (e.nativeEvent.contentOffset.y <= 0) {
              Keyboard.dismiss();
            }
          }}
          scrollEventThrottle={16}
        >
        <View style={{ alignItems:'center', marginVertical:40 }}>
          <Text style={{ fontSize:32, fontWeight:'bold', color: colors.text, marginTop:16, textAlign:'center' }}>Glucast</Text>
          <Text style={{ fontSize:18, color: colors.text, opacity:0.7, marginTop:8, textAlign:'center' }}>See your meals more clearly</Text>
        </View>

        <GlucasLogo />

        {/* carousel */}
        <View style={{ height:160, marginVertical:20 }}>
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={SCREEN_WIDTH * 0.85 + 16}
            decelerationRate="fast"
            contentContainerStyle={{ paddingLeft: SCREEN_WIDTH * 0.01, paddingRight: SCREEN_WIDTH * 0.055 }}
            scrollEnabled={false}
          >
            {slides.map((s, i) => (
              <Card key={i} style={{ width: SCREEN_WIDTH * 0.85, marginHorizontal:8, alignItems:'center', justifyContent:'center' }}>
                <Text style={{ fontSize:40, marginBottom:12 }}>{s.icon}</Text>
                <Text style={{ fontSize:18, fontWeight:'600', color: colors.text, textAlign:'center', marginBottom:8 }}>{s.title}</Text>
                <Text style={{ fontSize:14, color: colors.text, opacity:0.7, textAlign:'center', lineHeight:20 }}>{s.subtitle}</Text>
              </Card>
            ))}
          </ScrollView>
          <View style={{ flexDirection:'row', justifyContent:'center', marginTop:16 }}>
            {slides.map((_, i) => (
              <View key={i} style={{ width:8, height:8, borderRadius:4, backgroundColor: i===currentSlide? colors.primary: colors.border, marginHorizontal:4 }} />
            ))}
          </View>
        </View>

        {/* auth */}
        <View style={{ marginTop:20 }} ref={inputContainerRef}>
          <View style={{ flexDirection:'row', alignItems:'center', marginVertical:16 }}>
            <View style={{ flex:1, height:1, backgroundColor: colors.border }} />
            <Text style={{ marginHorizontal:16, color: colors.text, opacity:0.6 }}>or</Text>
            <View style={{ flex:1, height:1, backgroundColor: colors.border }} />
          </View>

          <View>
            <TextInput
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{ borderWidth:1, borderColor: colors.border, borderRadius:12, padding:16, fontSize:16, marginBottom:12, backgroundColor: colors.card }}
            />
            <TextInput
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={{ borderWidth:1, borderColor: colors.border, borderRadius:12, padding:16, fontSize:16, marginBottom:16, backgroundColor: colors.card }}
            />
          </View>
          <PrimaryButton title="Sign In" onPress={handleContinue} disabled={!email || !password} />
          {errorMessage ? (
            <Text style={{ color: 'red', marginTop: 8, textAlign: 'center' }}>{errorMessage}</Text>
          ) : null}
          <TouchableOpacity onPress={() => router.push('/(auth)/signup')} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ color: colors.primary }}>Don’t have an account? Sign Up</Text>
          </TouchableOpacity>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}