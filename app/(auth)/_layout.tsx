import { useEffect } from 'react';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { UserProvider } from '../context/UserContext';

SplashScreen.preventAutoHideAsync();

export default function AuthLayout() {
  useEffect(() => {
    // hide splash once layout is ready
    SplashScreen.hideAsync();
  }, []);

  return (
    <UserProvider>
      <Slot />
    </UserProvider>
  );
}