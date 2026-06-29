import { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { theme } from '@/theme';

/**
 * A minimal continuous slider built on PanResponder — no native dependency, so
 * it runs anywhere Expo does. Reports a clamped, step-quantized value as the
 * thumb is dragged or the track is tapped.
 */
export function Slider({
  value,
  min,
  max,
  step = 0,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);

  const valueFromX = (x: number): number => {
    const w = widthRef.current || 1;
    const ratio = Math.min(1, Math.max(0, x / w));
    let v = min + ratio * (max - min);
    if (step) v = Math.round(v / step) * step;
    return Number(Math.min(max, Math.max(min, v)).toFixed(4));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => onChange(valueFromX(e.nativeEvent.locationX)),
      onPanResponderMove: (e) => onChange(valueFromX(e.nativeEvent.locationX)),
    }),
  ).current;

  const pct = max > min ? (value - min) / (max - min) : 0;

  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        setWidth(e.nativeEvent.layout.width);
      }}
      style={{ height: 40, justifyContent: 'center' }}
    >
      <View style={{ height: 6, borderRadius: 3, backgroundColor: theme.colors.surfaceAlt }}>
        <View
          style={{
            height: 6,
            borderRadius: 3,
            width: `${pct * 100}%`,
            backgroundColor: theme.colors.accent,
          }}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          left: Math.max(0, Math.min(width - 24, pct * width - 12)),
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: theme.colors.accent,
          borderWidth: 2,
          borderColor: '#fff',
        }}
      />
    </View>
  );
}
