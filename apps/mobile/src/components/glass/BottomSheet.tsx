import { t } from '@parri/shared';
import { motion } from '@parri/ui';
import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { GlassSurface } from './GlassSurface';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Стеклянная шторка снизу: пружина при появлении, закрытие свайпом, по фону и кнопкой «Назад». */
export function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(open);
  const y = useSharedValue(height);
  const fade = useSharedValue(0);

  useEffect(() => {
    if (open) {
      setMounted(true);
      y.value = withSpring(0, motion.spring.sheet);
      fade.value = withTiming(1, { duration: 200 });
    } else if (mounted) {
      fade.value = withTiming(0, { duration: 200 });
      y.value = withSpring(height, { ...motion.spring.sheet, overshootClamping: true }, (done) => {
        if (done) scheduleOnRN(setMounted, false);
      });
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [open, onClose]);

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      y.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 600) scheduleOnRN(onClose);
      else y.value = withSpring(0, motion.spring.sheet);
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (!mounted) return null;

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('common.close')} />
      </Animated.View>
      <Animated.View style={[styles.sheetWrap, sheetStyle]}>
        <GlassSurface radius={32} style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]} testID="sheet">
          <GestureDetector gesture={pan}>
            <View>
              <View style={[styles.grabber, { backgroundColor: colors.textTertiary }]} />
              <View style={styles.titleRow}>
                <AppText variant="title3" accessibilityRole="header">
                  {title}
                </AppText>
                <Button
                  variant="glass"
                  size="icon"
                  accessibilityLabel={t('common.close')}
                  icon={<X size={20} strokeWidth={2.6} color={colors.text} />}
                  onPress={onClose}
                />
              </View>
            </View>
          </GestureDetector>
          <ScrollView style={{ maxHeight: height * 0.55 }} contentContainerStyle={styles.scroll}>
            {children}
          </ScrollView>
          {footer ? <View style={{ marginTop: 20 }}>{footer}</View> : null}
        </GlassSurface>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 50, elevation: 50 },
  backdrop: { backgroundColor: 'rgba(0,0,0,0.3)' },
  sheetWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: { paddingHorizontal: 20, paddingTop: 8, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  grabber: { alignSelf: 'center', width: 40, height: 6, borderRadius: 3, opacity: 0.4, marginBottom: 12 },
  // Место под тени стеклянных плашек, чтобы ScrollView их не обрезал
  scroll: { gap: 24, paddingVertical: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
});
