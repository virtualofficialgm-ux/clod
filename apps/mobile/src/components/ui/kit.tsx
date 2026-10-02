/**
 * Набор компонентов в духе Cal AI: серые плитки выбора, крупные цифры, кольца прогресса,
 * полоса дней недели, списки настроек. Стекло — только на навигации.
 */
import { motion, radii } from '@parri/ui';
import { t } from '@parri/shared';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { AppText } from '@/components/AppText';
import { usePressSpring } from '@/components/glass/usePressSpring';
import { Check, ChevronLeft, ChevronRight } from '@/components/icons';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ---------- Плитка выбора ----------
export function OptionTile({
  selected,
  onPress,
  title,
  subtitle,
  icon,
  multi,
  disabled,
  testID,
}: {
  selected?: boolean;
  onPress?: () => void;
  title: string;
  subtitle?: string;
  icon?: (color: string) => React.ReactNode;
  /** несколько вариантов (галочка) */
  multi?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const press = usePressSpring(0.98);
  const fg = selected ? colors.onInk : colors.text;
  return (
    <Animated.View style={[press.style, disabled && { opacity: 0.45 }]}>
      <Pressable
        testID={testID}
        accessibilityRole={multi ? 'checkbox' : 'radio'}
        accessibilityState={{ checked: !!selected, disabled: !!disabled }}
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
        disabled={disabled}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[styles.tile, { backgroundColor: selected ? colors.ink : colors.fill }]}
      >
        {icon ? (
          <View style={[styles.tileIcon, { backgroundColor: selected ? 'rgba(127,127,127,0.25)' : colors.cardSolid }]}>{icon(fg)}</View>
        ) : null}
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong" style={{ color: fg, fontFamily: familyByWeight['700'] }}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="callout" style={{ color: fg, opacity: selected ? 0.75 : 1 }} color={selected ? undefined : 'textSecondary'}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {multi ? (
          <View style={[styles.check, { borderColor: selected ? colors.onInk : colors.textTertiary, backgroundColor: selected ? colors.onInk : 'transparent' }]}>
            {selected ? <Check size={14} strokeWidth={3.2} color={colors.ink} /> : null}
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

// ---------- Шаги ----------
export function StepHeader({ step, total, onBack, trailing }: { step: number; total: number; onBack?: () => void; trailing?: React.ReactNode }) {
  const { colors, reduceMotion } = useTheme();
  const w = useSharedValue(step / total);
  useEffect(() => {
    w.value = reduceMotion ? step / total : withSpring(step / total, motion.spring.appear);
  }, [step, total, reduceMotion, w]);
  const bar = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.stepRow}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={onBack} hitSlop={8} style={[styles.round, { backgroundColor: colors.fill }]}>
          <ChevronLeft size={22} strokeWidth={2.6} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.round} />
      )}
      <View
        style={[styles.track, { backgroundColor: colors.fill }]}
        accessibilityRole="progressbar"
        accessibilityLabel={t('common.stepOf', { step, total })}
        accessibilityValue={{ min: 1, max: total, now: step }}
      >
        <Animated.View style={[styles.fillBar, { backgroundColor: colors.ink }, bar]} />
      </View>
      {trailing ?? <View style={{ width: 44 }} />}
    </View>
  );
}

export function StepTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <AppText variant="title2" accessibilityRole="header" style={{ fontFamily: familyByWeight['800'] }}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="body" color="textSecondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}

// ---------- Кольцо прогресса ----------
export function ProgressRing({
  value,
  size = 120,
  stroke = 10,
  color,
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  const { colors, reduceMotion } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const p = useSharedValue(reduceMotion ? v : 0);
  useEffect(() => {
    p.value = reduceMotion ? v : withSpring(v, motion.spring.appear);
  }, [v, reduceMotion, p]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors.fill} strokeWidth={stroke} />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? colors.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          animatedProps={animatedProps}
        />
      </Svg>
      {children}
    </View>
  );
}

// ---------- Маленькая карточка показателя ----------
export function StatTile({
  value,
  label,
  ring,
  color,
  icon,
  onPress,
}: {
  value: string | number;
  label: string;
  ring?: number;
  color?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
}) {
  const press = usePressSpring(0.97);
  return (
    <Animated.View style={[{ flex: 1 }, press.style]}>
      <Pressable accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${value} ${label}`} onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut}>
        <Card style={{ padding: 14, gap: 10 }}>
          <View>
            <AppText variant="title3" tabular numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: familyByWeight['800'] }}>
              {value}
            </AppText>
            <AppText variant="caption" color="textSecondary" numberOfLines={2}>
              {label}
            </AppText>
          </View>
          {ring != null ? (
            <ProgressRing value={ring} size={56} stroke={6} color={color}>
              {icon}
            </ProgressRing>
          ) : (
            icon
          )}
        </Card>
      </Pressable>
    </Animated.View>
  );
}

// ---------- Полоса дней ----------
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function WeekStrip({ marks, selected, onSelect }: { marks: Set<string>; selected: string; onSelect: (d: string) => void }) {
  const { colors } = useTheme();
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 2 + i);
    return d;
  });
  const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'short' });
  return (
    <View style={styles.week} accessibilityRole="tablist" accessibilityLabel={t('dashboard.deadlines')}>
      {days.map((d) => {
        const key = dayKey(d);
        const active = key === selected;
        const marked = marks.has(key);
        const isToday = key === dayKey(today);
        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(key)}
            style={[styles.day, active && { backgroundColor: colors.cardSolid, boxShadow: `0px 4px 16px ${colors.cardShadow}` }]}
          >
            <AppText variant="caption" color={isToday ? 'text' : 'textSecondary'} style={{ textTransform: 'capitalize' }}>
              {wd.format(d).replace('.', '')}
            </AppText>
            <View
              style={[
                styles.dayNum,
                {
                  borderColor: marked ? colors.accent : colors.textTertiary,
                  borderStyle: marked ? 'solid' : 'dashed',
                  backgroundColor: isToday && marked ? colors.accent : 'transparent',
                  opacity: marked ? 1 : 0.7,
                },
              ]}
            >
              <AppText variant="callout" tabular style={{ fontFamily: familyByWeight['800'], color: isToday && marked ? colors.onAccent : colors.text }}>
                {d.getDate()}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------- Карточка ----------
export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  const { colors, reduceTransparency } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: reduceTransparency ? colors.cardSolid : colors.card,
          borderColor: colors.cardBorder,
          boxShadow: `0px 6px 24px ${colors.cardShadow}`,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <AppText variant="title3" accessibilityRole="header">
        {title}
      </AppText>
      {action}
    </View>
  );
}

// ---------- Списки настроек ----------
export function ListGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  const items = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  return (
    <View style={{ gap: 8 }}>
      {title ? (
        <AppText variant="callout" color="textSecondary" style={{ fontFamily: familyByWeight['700'], paddingHorizontal: 4 }}>
          {title}
        </AppText>
      ) : null}
      <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
        {items.map((child, i) => (
          <View key={i} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator } : undefined}>
            {child}
          </View>
        ))}
      </Card>
    </View>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  trailing,
  danger,
  testID,
}: {
  icon?: (color: string) => React.ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  trailing?: React.ReactNode;
  danger?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const fg = danger ? colors.danger : colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.fill }]}
    >
      {icon ? <View style={[styles.rowIcon, { backgroundColor: colors.fill }]}>{icon(fg)}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <AppText variant="bodyStrong" numberOfLines={1} style={{ color: fg }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="callout" color="textSecondary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="callout" color="textSecondary" style={{ fontFamily: familyByWeight['600'] }}>
          {value}
        </AppText>
      ) : null}
      {trailing ?? (onPress ? <ChevronRight size={20} color={colors.textTertiary} /> : null)}
    </Pressable>
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { colors } = useTheme();
  return (
    <Switch
      accessibilityLabel={label}
      value={value}
      onValueChange={onChange}
      trackColor={{ true: colors.accent, false: colors.fillStrong }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={colors.fillStrong}
    />
  );
}

// ---------- Крупная цифра ----------
export function BigNumber({ value, label }: { value: string; label?: string }) {
  return (
    <View>
      <AppText variant="number" tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      {label ? (
        <AppText variant="callout" color="textSecondary" style={{ fontFamily: familyByWeight['600'] }}>
          {label}
        </AppText>
      ) : null}
    </View>
  );
}

export function ProgressBar({ value, color, label }: { value: number; color?: string; label?: string }) {
  const { colors } = useTheme();
  const v = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.bar, { backgroundColor: colors.fill }]} accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(v * 100) }}>
      <View style={{ width: `${v * 100}%`, height: '100%', borderRadius: 99, backgroundColor: color ?? colors.accent }} />
    </View>
  );
}

export function QuickAction({ icon, label, onPress }: { icon: (color: string) => React.ReactNode; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const press = usePressSpring();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <Animated.View style={[styles.quick, { backgroundColor: colors.fill }, press.style]}>{icon(colors.text)}</Animated.View>
      <AppText variant="caption" numberOfLines={2} style={{ textAlign: 'center' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Маленькая пилюля-кнопка (Пополнить, Вывести) */
export function PillButton({ label, onPress, icon, tone = 'ink' }: { label: string; onPress: () => void; icon?: (c: string) => React.ReactNode; tone?: 'ink' | 'fill' | 'accent' }) {
  const { colors } = useTheme();
  const press = usePressSpring();
  const bg = tone === 'ink' ? colors.ink : tone === 'accent' ? colors.accent : colors.fill;
  const fg = tone === 'ink' ? colors.onInk : tone === 'accent' ? colors.onAccent : colors.text;
  return (
    <Animated.View style={press.style}>
      <Pressable accessibilityRole="button" onPress={onPress} onPressIn={press.onPressIn} onPressOut={press.onPressOut} style={[styles.pill, { backgroundColor: bg }]}>
        {icon?.(fg)}
        <AppText variant="callout" style={{ color: fg, fontFamily: familyByWeight['700'] }}>
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tile: { minHeight: 64, borderRadius: radii.md, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 14 },
  tileIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 6, borderRadius: 99, overflow: 'hidden' },
  fillBar: { height: '100%', borderRadius: 99 },
  week: { flexDirection: 'row', justifyContent: 'space-between', gap: 2 },
  day: { flex: 1, maxWidth: 56, alignItems: 'center', gap: 6, paddingVertical: 8, borderRadius: 999 },
  dayNum: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radii.lg, borderWidth: 1, padding: 20, gap: 12 },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bar: { height: 8, borderRadius: 99, overflow: 'hidden' },
  quick: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  pill: { height: 40, paddingHorizontal: 16, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6 },
});

// ---------- Столбчатый график ----------
export function BarChart({ data, format, label }: { data: { label: string; value: number }[]; format: (v: number) => string; label: string }) {
  const { colors } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View accessible accessibilityLabel={`${label}: ${data.map((d) => `${d.label} ${format(d.value)}`).join(', ')}`} style={{ gap: 8 }}>
      <View style={{ height: 130, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
        {data.map((d, i) => (
          <View key={d.label} style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center', gap: 4 }}>
            {d.value > 0 ? (
              <AppText variant="caption" color="textSecondary" style={{ fontSize: 10 }} numberOfLines={1}>
                {format(d.value)}
              </AppText>
            ) : null}
            <View
              style={{
                width: '100%',
                maxWidth: 36,
                height: `${Math.max(4, (d.value / max) * 100)}%`,
                borderRadius: 10,
                backgroundColor: i === data.length - 1 ? colors.accent : d.value > 0 ? colors.ink : colors.fill,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {data.map((d) => (
          <AppText key={d.label} variant="caption" color="textSecondary" style={{ flex: 1, textAlign: 'center', fontSize: 10 }} numberOfLines={1}>
            {d.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

export function SoonBadge() {
  const { colors } = useTheme();
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: colors.fillStrong, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 2 }}>
      <AppText variant="caption" color="textSecondary">
        {t('common.soon')}
      </AppText>
    </View>
  );
}
