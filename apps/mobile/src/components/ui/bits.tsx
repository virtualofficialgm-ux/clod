import { t, type FullTaskStatus, type TranslationKey } from '@parri/shared';
import { radii } from '@parri/ui';
import { createContext, useCallback, useContext, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

/** Карточка контента (белая, мягкая тень) — общая с kit */
import { Card } from './kit';
export { Card };

export function PageTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="title1" accessibilityRole="header">
        {children}
        <AppText variant="title1" style={{ color: colors.accent }}>
          .
        </AppText>
      </AppText>
      {subtitle ? (
        <AppText variant="body" color="textSecondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <AppText variant="title3" accessibilityRole="header">
      {children}
    </AppText>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <AppText variant="callout" color="textSecondary" style={{ fontFamily: familyByWeight['700'] }}>
      {children}
    </AppText>
  );
}

export function Row({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.wrapRow, style]}>{children}</View>;
}

export function Center() {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" accessibilityLabel={t('common.loading')} />
    </View>
  );
}

const TONES: Record<FullTaskStatus, [string, 'text' | 'textSecondary' | 'accentText']> = {
  open: ['rgba(255,84,40,0.14)', 'accentText'],
  in_progress: ['rgba(127,127,140,0.16)', 'text'],
  review: ['rgba(251,191,36,0.2)', 'text'],
  disputed: ['rgba(196,43,28,0.16)', 'text'],
  completed: ['rgba(74,222,128,0.2)', 'text'],
  archived: ['rgba(127,127,140,0.14)', 'textSecondary'],
};

export function StatusBadge({ status }: { status: FullTaskStatus }) {
  const [bg, color] = TONES[status];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <AppText variant="caption" color={color}>
        {t(`status.${status}` as TranslationKey)}
      </AppText>
    </View>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.separator }]}>
      <AppText variant="caption" color="textSecondary">
        {children}
      </AppText>
    </View>
  );
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: string; action?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
      {icon}
      <AppText variant="title3" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {text ? (
        <AppText variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
          {text}
        </AppText>
      ) : null}
      {action}
    </Card>
  );
}

export function Avatar({ name, url, size = 44 }: { name: string; url?: string | null; size?: number }) {
  const { colors } = useTheme();
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(255,84,40,0.15)', alignItems: 'center', justifyContent: 'center' }}
    >
      <AppText variant="bodyStrong" style={{ color: colors.accentText, fontFamily: familyByWeight['800'], fontSize: size * 0.38 }}>
        {initials || '•'}
      </AppText>
    </View>
  );
}

// ---------- Тосты ----------
const ToastContext = createContext<(text: string, tone?: 'info' | 'error') => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [items, setItems] = useState<{ id: number; text: string; tone: 'info' | 'error' }[]>([]);
  const push = useCallback((text: string, tone: 'info' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p, { id, text, tone }]);
    setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <View pointerEvents="none" style={[styles.toasts, { top: insets.top + 8 }]}>
        {items.map((it) => (
          <Animated.View key={it.id} entering={FadeInUp.springify()} exiting={FadeOutUp}>
            <GlassSurface radius={radii.pill} style={{ paddingHorizontal: 20, paddingVertical: 12 }}>
              <AppText
                variant="callout"
                accessibilityLiveRegion="polite"
                style={{ fontFamily: familyByWeight['600'], color: it.tone === 'error' ? colors.danger : colors.text }}
              >
                {it.text}
              </AppText>
            </GlassSurface>
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 1, padding: 20, gap: 12 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  center: { paddingVertical: 48, alignItems: 'center', justifyContent: 'center' },
  badge: { alignSelf: 'flex-start', borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 4 },
  toasts: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 8, zIndex: 100 },
});
