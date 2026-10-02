import { motion } from '@parri/ui';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

/** Мягкое пятно: радиальный градиент к прозрачности (кроссплатформенная замена CSS blur) */
function Blob({ color, opacity, size }: { color: string; opacity: number; size: number }) {
  const id = `b${color.replace('#', '')}`;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.55} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect width={size} height={size} fill={`url(#${id})`} />
    </Svg>
  );
}

const PLACEMENT = [
  { top: -0.3, left: -0.45, dx: 0.12, dy: 0.08 },
  { top: 0.12, left: 0.35, dx: -0.1, dy: 0.1 },
  { top: 0.55, left: -0.2, dx: 0.14, dy: -0.08 },
] as const;

/** Живой фон: три медленно дрейфующих пятна. Замирает при «Уменьшить движение». */
export function MeshBackground() {
  const { colors, reduceMotion } = useTheme();
  const { width, height } = useWindowDimensions();
  const size = Math.max(width, height) * 1.1;
  const p = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(p);
      p.value = 0;
      return;
    }
    p.value = withRepeat(
      withTiming(1, { duration: motion.blobCycleMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(p);
  }, [reduceMotion, p]);

  const s0 = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * PLACEMENT[0].dx * width }, { translateY: p.value * PLACEMENT[0].dy * height }],
  }));
  const s1 = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * PLACEMENT[1].dx * width }, { translateY: p.value * PLACEMENT[1].dy * height }],
  }));
  const s2 = useAnimatedStyle(() => ({
    transform: [{ translateX: p.value * PLACEMENT[2].dx * width }, { translateY: p.value * PLACEMENT[2].dy * height }],
  }));
  const animated = [s0, s1, s2];

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, overflow: 'hidden' }]}>
      {colors.blobs.map((c, i) => (
        <Animated.View
          key={i}
          style={[
            { position: 'absolute', top: PLACEMENT[i]!.top * height, left: PLACEMENT[i]!.left * width },
            animated[i],
          ]}
        >
          <Blob color={c} opacity={colors.blobOpacity} size={size} />
        </Animated.View>
      ))}
    </View>
  );
}
