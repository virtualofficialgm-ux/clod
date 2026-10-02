import { motion, radii } from '@parri/ui';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, useAnimatedReaction, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { AppText } from '@/components/AppText';
import { GlassSurface } from './GlassSurface';

interface HeaderProps {
  title: string;
  scrollY: SharedValue<number>;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}

/** Прозрачная шапка; после начала прокрутки становится стеклянной пилюлей с компактным заголовком. */
export function Header({ title, scrollY, leading, actions }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const [scrolled, setScrolled] = useState(false);

  useAnimatedReaction(
    () => scrollY.value > motion.headerScrollThreshold,
    (now, prev) => {
      if (now !== prev) scheduleOnRN(setScrolled, now);
    },
  );

  const content = (
    <View style={styles.row}>
      <View style={styles.side}>{leading}</View>
      <View style={styles.center}>
        {scrolled && (
          <Animated.View entering={FadeInDown.springify()} exiting={FadeOutDown}>
            <AppText variant="bodyStrong" numberOfLines={1} style={{ fontFamily: 'Manrope_700Bold' }}>
              {title}
            </AppText>
          </Animated.View>
        )}
      </View>
      <View style={[styles.side, styles.end]}>{actions}</View>
    </View>
  );

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingTop: insets.top + 8 }]} testID="header">
      {scrolled ? (
        <GlassSurface radius={radii.pill} testID="header-glass">
          {content}
        </GlassSurface>
      ) : (
        content
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, paddingHorizontal: 16 },
  row: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, gap: 8 },
  side: { minWidth: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  end: { justifyContent: 'flex-end' },
  center: { flex: 1, alignItems: 'center' },
});
