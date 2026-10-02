import { motion, radii } from '@parri/ui';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { GlassSurface } from './GlassSurface';

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}

/** Стеклянный переключатель вкладок с пружинным индикатором. */
export function Segmented<T extends string>({ value, onChange, options }: SegmentedProps<T>) {
  const { colors } = useTheme();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const active = layouts[value];

  const indicator = useAnimatedStyle(() => ({
    opacity: active ? 1 : 0,
    width: withSpring(active?.width ?? 0, motion.spring.press),
    transform: [{ translateX: withSpring(active?.x ?? 0, motion.spring.press) }],
  }));

  const onLayout = (key: T) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => ({ ...prev, [key]: { x, width } }));
  };

  return (
    <GlassSurface radius={radii.pill} style={styles.wrap}>
      <View style={styles.row} accessibilityRole="tablist">
        <Animated.View style={[styles.indicator, { backgroundColor: colors.text }, indicator]} />
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onLayout={onLayout(o.value)}
              onPress={() => onChange(o.value)}
              style={styles.item}
            >
              <AppText variant="callout" style={{ fontFamily: 'Manrope_700Bold' }} color={selected ? 'background' : 'text'}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', padding: 4 },
  row: { flexDirection: 'row', gap: 4 },
  item: { height: 40, paddingHorizontal: 16, justifyContent: 'center', borderRadius: radii.pill },
  indicator: { position: 'absolute', top: 0, left: 0, height: 40, borderRadius: radii.pill },
});
