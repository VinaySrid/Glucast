import React from 'react';
import { supabase } from '../../lib/supabase'; // Adjust the import path as needed
import { useUser } from '../context/UserContext';
import { Redirect, Tabs } from 'expo-router';
import TopAppBar from '../../components/TopBar';
import BottomTabBar from '../../components/BottomTabBar';

export default function TabsLayout() {
  const { user } = useUser();

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs initialRouteName="index" tabBar={() => <BottomTabBar />}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          header: () => <TopAppBar showProfile={true} />,
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          header: () => <TopAppBar showProfile={true} />,
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: 'Timeline',
          header: () => <TopAppBar showProfile={true} />,
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          header: () => <TopAppBar showProfile={true} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          header: () => <TopAppBar showProfile={true} />,
        }}
      />
    </Tabs>
  );
}