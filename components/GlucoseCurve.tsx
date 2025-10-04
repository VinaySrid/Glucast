import React from 'react';
import { View, Text } from 'react-native';
import colors from '../constants/colors';

export default function GlucoseCurve({ peak = 140, confidence = 'medium' }: { peak?: number; confidence?: 'low'|'medium'|'high'; }) {
  const mockCurve = [
    { time: 0,   value: 100 }, { time: 30,  value: 120 }, { time: 60,  value: peak },
    { time: 90,  value: peak - 10 }, { time: 120, value: 115 }, { time: 180, value: 105 }, { time: 240, value: 100 },
  ];
  const op = confidence === 'low' ? 0.6 : confidence === 'medium' ? 0.8 : 1;
  return (
    <View style={{ height: 120, marginVertical: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: '100%', paddingHorizontal: 8 }}>
        {mockCurve.map((p, i) => (
          <View key={i} style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ height: (p.value - 80)/2, width: 3, backgroundColor: colors.primary, borderRadius: 2, opacity: op }} />
            {i % 2 === 0 && <Text style={{ fontSize: 10, color: colors.text, marginTop: 4 }}>{p.time}m</Text>}
          </View>
        ))}
      </View>
      <Text style={{ textAlign: 'center', fontSize: 12, color: colors.text, marginTop: 4 }}>
        Peak: {peak} mg/dL • Confidence: {confidence}
      </Text>
    </View>
  );
}