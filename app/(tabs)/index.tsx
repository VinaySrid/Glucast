import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { router } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  interpolate,
  runOnJS
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import Colors from '@/constants/Colors';
import GradientButton from '@/components/GradientButton';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
  const fadeAnim = useSharedValue(0);
  const slideAnim = useSharedValue(50);
  const scaleAnim = useSharedValue(1);
  const lottieRef = useRef<LottieView>(null);

  useEffect(() => {
    // Start animations when component mounts
    fadeAnim.value = withTiming(1, { duration: 1000 });
    slideAnim.value = withTiming(0, { duration: 800, easing: (t) => t });
    
    // Start Lottie animation
    if (lottieRef.current) {
      lottieRef.current.play();
    }
  }, []);

  const handleGetStarted = () => {
    scaleAnim.value = withSpring(0.95, {}, () => {
      scaleAnim.value = withSpring(1);
    });
    router.push('/meal-input');
  };

  const fadeInStyle = useAnimatedStyle(() => {
    return {
      opacity: fadeAnim.value,
    };
  });

  const slideUpStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: slideAnim.value }],
    };
  });

  const buttonScaleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scaleAnim.value }],
    };
  });

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <Animated.View style={[styles.heroSection, fadeInStyle, slideUpStyle]}>
        <Text style={styles.appName}>Glucast</Text>
        <Text style={styles.tagline}>AI-powered foresight for better glucose control</Text>
        <Text style={styles.subtext}>
          Glucast predicts how meals affect blood sugar, helping you make smarter choices every day.
        </Text>
      </Animated.View>

      {/* Middle Section - Animation */}
      <Animated.View style={[styles.animationSection, fadeInStyle, slideUpStyle]}>
        <View style={styles.animationContainer}>
          <LottieView
            ref={lottieRef}
            source={require('../../assets/animations/health-pulse.json')}
            style={styles.lottieAnimation}
            autoPlay
            loop
            speed={0.8}
          />
        </View>
      </Animated.View>

      {/* Bottom Section - Action */}
      <Animated.View style={[styles.actionSection, fadeInStyle, slideUpStyle]}>
        <Animated.View style={buttonScaleStyle}>
          <GradientButton
            title="Get Started"
            onPress={handleGetStarted}
            style={styles.getStartedButton}
          />
        </Animated.View>

        {/* Trust Indicators */}
        <View style={styles.trustIndicators}>
          <View style={styles.trustItem}>
            <Text style={styles.checkmark}>✅</Text>
            <Text style={styles.trustText}>AI-powered predictions</Text>
          </View>
          <View style={styles.trustItem}>
            <Text style={styles.checkmark}>✅</Text>
            <Text style={styles.trustText}>Clear explanations</Text>
          </View>
          <View style={styles.trustItem}>
            <Text style={styles.checkmark}>✅</Text>
            <Text style={styles.trustText}>Personalized guidance</Text>
          </View>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  appName: {
    fontSize: 42,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 20,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 28,
  },
  subtext: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  animationSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  animationContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 100,
    shadowColor: '#3b82f6',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  lottieAnimation: {
    width: 120,
    height: 120,
  },
  actionSection: {
    alignItems: 'center',
  },
  getStartedButton: {
    marginBottom: 32,
  },
  trustIndicators: {
    alignItems: 'center',
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  checkmark: {
    fontSize: 16,
    marginRight: 8,
  },
  trustText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
});
