import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import colors from '../constants/colors';
import { useRouter, usePathname } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type TabKey = 'index' | 'log' | 'timeline' | 'insights' | 'profile';

export default function BottomTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  const segments = pathname.split('/');
  const current = segments[segments.length - 1];

  const tabs: { key: TabKey; title: string; icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; activeIcon: React.ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
    { key: 'index',    title: 'Home',     icon: 'home-outline',        activeIcon: 'home' },
    { key: 'log',      title: 'Log Meal', icon: 'note-edit-outline',   activeIcon: 'note-edit' },
    { key: 'timeline', title: 'Timeline', icon: 'chart-line',           activeIcon: 'chart-line' },
    { key: 'insights', title: 'Insights', icon: 'lightbulb-outline',    activeIcon: 'lightbulb-on' },
    { key: 'profile',  title: 'Profile',  icon: 'account-outline',      activeIcon: 'account' },
  ];

  return (
    <View
  style={{
    flexDirection: 'row',
    backgroundColor: '#000',
    borderTopWidth: 1,
    borderTopColor: '#222',
    height: 80, // fixed height for icons + labels
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  }}
>
      {tabs.map((t) => {
        const isActive =
          (t.key === 'index' && (current === '(tabs)' || current === 'index' || current === '')) ||
          current === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 8, minHeight: 44 }}
            onPress={() => router.replace(t.key === 'index' ? '/(tabs)' : `/(tabs)/${t.key}`)}
          >
            <View style={{ alignItems: 'center' }}>
              <MaterialCommunityIcons
                name={isActive ? t.activeIcon : t.icon}
                size={28}
                color={isActive ? 'white' : 'gray'}
              />
              <Text
                style={{
                  fontSize: 12,
                  color: isActive ? 'white' : 'gray',
                  fontWeight: isActive ? '700' as const : '400' as const,
                  marginTop: 4,
                }}
              >
                {t.title}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
