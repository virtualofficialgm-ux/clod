import { useState } from 'react';
import { RefreshControl, StyleSheet, View, type ScrollViewProps } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurTargetProvider } from '@/components/glass/BlurTarget';
import { Header } from '@/components/glass/Header';
import { MeshBackground } from '@/components/glass/MeshBackground';
import { useTheme } from '@/theme/ThemeProvider';

interface ScreenProps {
  title: string;
  children: React.ReactNode;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  /** Шторки и плавающие элементы поверх контента */
  overlay?: React.ReactNode;
  /** Отступ снизу под таб-бар (true на вкладках) */
  tabBar?: boolean;
  onRefresh?: () => Promise<unknown>;
  scrollProps?: ScrollViewProps;
  footer?: React.ReactNode;
}

/** Экран: живой фон, прокрутка, прозрачная шапка, которая становится стеклом при скролле */
export function Screen({ title, children, leading, actions, overlay, tabBar, onRefresh, scrollProps, footer }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const scrollY = useSharedValue(0);
  const [refreshing, setRefreshing] = useState(false);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  return (
    <View style={styles.flex}>
      <BlurTargetProvider>
        <MeshBackground />
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 72, paddingBottom: insets.bottom + (tabBar ? 112 : footer ? 120 : 32) },
          ]}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                tintColor={colors.accent}
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await onRefresh().catch(() => {});
                  setRefreshing(false);
                }}
              />
            ) : undefined
          }
          {...scrollProps}
        >
          {children}
        </Animated.ScrollView>
      </BlurTargetProvider>
      <Header title={title} scrollY={scrollY} leading={leading} actions={actions} />
      {footer}
      {overlay}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 24 },
});
