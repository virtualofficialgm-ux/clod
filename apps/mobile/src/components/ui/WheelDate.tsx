import { useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { AppText } from '@/components/AppText';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

const ITEM = 44;
const VISIBLE = 5;

function Wheel({ items, value, onChange, label, flex = 1 }: { items: { value: number; label: string }[]; value: number; onChange: (v: number) => void; label: string; flex?: number }) {
  const { colors } = useTheme();
  const ref = useRef<ScrollView>(null);
  const index = Math.max(0, items.findIndex((i) => i.value === value));
  useEffect(() => {
    ref.current?.scrollTo({ y: index * ITEM, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.min(items.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.y / ITEM)));
    if (items[i] && items[i].value !== value) onChange(items[i].value);
  };
  return (
    <View style={{ flex, height: ITEM * VISIBLE }} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: items[index]?.label }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const next = items[index + (e.nativeEvent.actionName === 'increment' ? 1 : -1)];
        if (next) {
          onChange(next.value);
          ref.current?.scrollTo({ y: items.indexOf(next) * ITEM });
        }
      }}
    >
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM}
        decelerationRate="fast"
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: ITEM * 2 }}
      >
        {items.map((it) => {
          const active = it.value === value;
          return (
            <View key={it.value} style={styles.item}>
              <AppText
                variant="title3"
                style={{ fontFamily: familyByWeight[active ? '800' : '600'], color: active ? colors.text : colors.textTertiary, opacity: active ? 1 : 0.6 }}
              >
                {it.label}
              </AppText>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Дата рождения «колёсиками», как в Cal AI. value — YYYY-MM-DD */
export function WheelDate({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  const now = new Date();
  const [y, m, d] = (value || `${now.getFullYear() - 20}-01-01`).split('-').map(Number) as [number, number, number];
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(new Date(2000, i, 1)) })),
    [],
  );
  const years = useMemo(() => Array.from({ length: 90 }, (_, i) => ({ value: now.getFullYear() - 10 - i, label: String(now.getFullYear() - 10 - i) })), []); // eslint-disable-line react-hooks/exhaustive-deps
  const daysIn = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysIn }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
  const set = (ny: number, nm: number, nd: number) => {
    const max = new Date(ny, nm, 0).getDate();
    onChange(`${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(nd, max)).padStart(2, '0')}`);
  };
  useEffect(() => {
    if (!value) set(y, m, d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <View style={[styles.wrap, { backgroundColor: colors.fill }]}>
      <View pointerEvents="none" style={[styles.band, { backgroundColor: colors.cardSolid }]} />
      <Wheel label="День" items={days} value={d} onChange={(v) => set(y, m, v)} flex={0.7} />
      <Wheel label="Месяц" items={months} value={m} onChange={(v) => set(y, v, d)} flex={1.6} />
      <Wheel label="Год" items={years} value={y} onChange={(v) => set(v, m, d)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: 24, paddingHorizontal: 8, overflow: 'hidden' },
  band: { position: 'absolute', left: 8, right: 8, top: ITEM * 2, height: ITEM, borderRadius: 14 },
  item: { height: ITEM, alignItems: 'center', justifyContent: 'center' },
});
