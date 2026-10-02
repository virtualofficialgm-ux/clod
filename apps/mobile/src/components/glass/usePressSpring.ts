import { motion } from '@parri/ui';
import { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

/** Пружинное сжатие при нажатии. Reanimated сам отключает его при «Уменьшить движение». */
export function usePressSpring(scaleTo: number = motion.pressScale) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return {
    style,
    onPressIn: () => {
      scale.value = withSpring(scaleTo, motion.spring.press);
    },
    onPressOut: () => {
      scale.value = withSpring(1, motion.spring.press);
    },
  };
}
