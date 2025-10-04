import React from 'react';
import { Image, View } from 'react-native';

export default function GlucasLogo({ size = 120 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        alignSelf: 'center',
      }}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Image
          source={require('../assets/images/logo.png')}
          style={{ width: size, height: size, resizeMode: 'contain' }}
        />
      </View>
    </View>
  );
}