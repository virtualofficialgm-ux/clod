import { t, type TranslationKey } from '@parri/shared';
import { radii } from '@parri/ui';
import { House, ListChecks, Plus, User, Wallet, type LucideIcon } from '@/components/icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components/AppText';
import { useTheme } from '@/theme/ThemeProvider';
import { GlassSurface } from './GlassSurface';
import { usePressSpring } from './usePressSpring';

export type TabKey = 'feed' | 'tasks' | 'create' | 'balance' | 'account';

const TABS: { key: TabKey; label: TranslationKey; icon: LucideIcon }[] = [
  { key: 'feed', label: 'nav.feed', icon: House },
  { key: 'tasks', label: 'nav.tasks', icon: ListChecks },
  { key: 'create', label: 'nav.create', icon: Plus },
  { key: 'balance', label: 'nav.balance', icon: Wallet },
  { key: 'account', label: 'nav.account', icon: User },
];

function TabItem({ tab, active, onPress }: { tab: (typeof TABS)[number]; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const press = usePressSpring();
  const Icon = tab.icon;
  if (tab.key === 'create') {
    return (
      <Animated.View style={press.style}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(tab.label)}
          onPress={onPress}
          onPressIn={press.onPressIn}
          onPressOut={press.onPressOut}
          style={[styles.plus, { backgroundColor: colors.accent }]}
        >
          <Icon size={26} strokeWidth={2.6} color={colors.onAccent} />
        </Pressable>
      </Animated.View>
    );
  }
  const color = active ? colors.accentText : colors.textSecondary;
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={styles.item}
      >
        <Icon size={22} strokeWidth={active ? 2.6 : 2.2} color={color} />
        <AppText variant="caption" style={{ fontSize: 11, lineHeight: 14, fontFamily: 'Manrope_700Bold', color }}>
          {t(tab.label)}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

/** Плавающий стеклянный таб-бар-пилюля: Лента, Задачи, «+», Баланс, Аккаунт. */
export function TabBar({ active, onChange }: { active: TabKey; onChange: (k: TabKey) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <GlassSurface radius={radii.pill} style={styles.bar} testID="tabbar">
        {TABS.map((tab) => (
          <TabItem key={tab.key} tab={tab} active={tab.key === active} onPress={() => onChange(tab.key)} />
        ))}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 16, zIndex: 30 },
  bar: { height: 64, width: '100%', maxWidth: 420, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  item: { width: 64, alignItems: 'center', gap: 2, paddingVertical: 6 },
  plus: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 6px 18px rgba(255,84,40,0.4)' },
});
