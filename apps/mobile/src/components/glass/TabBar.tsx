import { t, type TranslationKey } from '@parri/shared';
import { radii } from '@parri/ui';
import { House, LayoutGrid, ListChecks, MessageCircle, Plus, type LucideIcon } from '@/components/icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { GlassSurface } from './GlassSurface';
import { usePressSpring } from './usePressSpring';

export type TabKey = 'home' | 'feed' | 'tasks' | 'messages';

const TABS: { key: TabKey; label: TranslationKey; icon: LucideIcon }[] = [
  { key: 'home', label: 'nav.dashboard', icon: House },
  { key: 'feed', label: 'nav.feed', icon: LayoutGrid },
  { key: 'tasks', label: 'nav.tasks', icon: ListChecks },
  { key: 'messages', label: 'nav.messages', icon: MessageCircle },
];

function TabItem({ tab, active, onPress }: { tab: (typeof TABS)[number]; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const press = usePressSpring();
  const Icon = tab.icon;
  const color = active ? colors.text : colors.textSecondary;
  return (
    <Animated.View style={[{ flex: 1 }, press.style]}>
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={t(tab.label)}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[styles.item, active && { backgroundColor: colors.fillStrong }]}
      >
        <Icon size={22} strokeWidth={active ? 2.6 : 2.2} color={color} />
        <AppText variant="caption" numberOfLines={1} style={{ fontSize: 11, lineHeight: 14, fontFamily: 'Manrope_700Bold', color }}>
          {t(tab.label)}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Стеклянная пилюля с вкладками и отдельная круглая кнопка «+» справа —
 * как плавающий «+» в Cal AI, но в стекле iOS 26 и с акцентом Parri.
 */
export function TabBar({ active, onChange, onCreate }: { active: TabKey | null; onChange: (k: TabKey) => void; onCreate: () => void }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const press = usePressSpring();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <GlassSurface radius={radii.pill} style={styles.bar} testID="tabbar">
        {TABS.map((tab) => (
          <TabItem key={tab.key} tab={tab} active={tab.key === active} onPress={() => onChange(tab.key)} />
        ))}
      </GlassSurface>
      <Animated.View style={press.style}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('nav.create')}
          testID="tab-create"
          onPress={onCreate}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          style={[styles.plus, { backgroundColor: colors.accent }]}
        >
          <Plus size={30} strokeWidth={2.8} color={colors.onAccent} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    zIndex: 30,
  },
  bar: { height: 64, flex: 1, maxWidth: 340, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  item: { alignItems: 'center', gap: 2, paddingVertical: 6, marginHorizontal: 2, borderRadius: 999 },
  plus: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 10px 28px rgba(255,84,40,0.45)' },
});
