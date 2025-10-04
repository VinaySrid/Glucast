import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import colors from '../constants/colors';
import GlucasLogo from './GlucasLogo';
import { useRouter } from 'expo-router';
import { useUser } from '../app/context/UserContext';

const MemoizedGlucasLogo = () => {
  return React.useMemo(() => <GlucasLogo size={28} />, []);
};

export default function TopAppBar({ title, onLogoPress, showProfile = false }: { title?: string; onLogoPress?: () => void; showProfile?: boolean; }) {
  const router = useRouter();
  const { user } = useUser();
  const handleLogoPress = onLogoPress ?? (() => router.replace('/(tabs)'));
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.card }}>
      <View style={{
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2
      }}>
        <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.8}><MemoizedGlucasLogo /></TouchableOpacity>
        {title ? <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>{title}</Text> : <View />}
        <View style={{ width: 32 }}>
          {showProfile && (
            <TouchableOpacity onPress={() => router.push('/profile')} activeOpacity={0.7}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>{user?.first_name?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
