import { LinearGradient } from 'expo-linear-gradient';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { MeshBackground } from '@/components/glass/MeshBackground';
import { useTheme } from '@/theme/ThemeProvider';
import { StepHeader } from './kit';

/**
 * Экран шага в стиле Cal AI: сверху «назад» и полоса прогресса, контент прокручивается,
 * большая кнопка прибита к низу и поднимается над клавиатурой.
 */
export function StepScreen({
  stepKey,
  step,
  total,
  phase,
  onBack,
  children,
  footer,
}: {
  stepKey: string;
  step?: number;
  total?: number;
  phase?: string;
  onBack?: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors, reduceMotion } = useTheme();
  return (
    <View style={styles.flex}>
      <MeshBackground />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, gap: 10 }}>
          {phase ? (
            <AppText variant="caption" color="textSecondary" style={{ textAlign: 'center', textTransform: 'uppercase' }}>
              {phase}
            </AppText>
          ) : null}
          {step != null && total != null ? <StepHeader step={step} total={total} onBack={onBack} /> : null}
        </View>
        <Animated.View
          key={stepKey}
          entering={reduceMotion ? FadeIn : SlideInRight.springify().damping(26)}
          exiting={reduceMotion ? FadeOut : SlideOutLeft.duration(160)}
          style={styles.flex}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            {children}
          </ScrollView>
        </Animated.View>
        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {/* Плавный переход от контента к кнопкам, без резкой границы поверх живого фона */}
            <LinearGradient pointerEvents="none" colors={[`${colors.background}00`, colors.background]} locations={[0, 0.35]} style={StyleSheet.absoluteFill} />
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32, gap: 20 },
  footer: { paddingHorizontal: 16, paddingTop: 28, marginTop: -16, gap: 8 },
});
