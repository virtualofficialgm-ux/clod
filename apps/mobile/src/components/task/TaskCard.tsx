import { formatDistance, formatMoney, t, type ShowcaseTask } from '@parri/shared';
import { radii } from '@parri/ui';
import { Clock, Globe, GraduationCap, MapPin } from '@/components/icons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { usePressSpring } from '@/components/glass/usePressSpring';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';
import { categoryIcon } from './categoryIcon';

export type TaskCardData = ShowcaseTask;

/**
 * Карточка задачи в стиле Cal AI: белая, мягкая тень, иконка категории в круге,
 * крупная цена и срок отдельной плашкой.
 */
export function TaskCard({
  task,
  onPress,
  footer,
  actions,
}: {
  task: TaskCardData;
  onPress?: () => void;
  footer?: string;
  actions?: React.ReactNode;
}) {
  const { colors, reduceTransparency } = useTheme();
  const press = usePressSpring(0.98);
  const KindIcon = task.kind === 'online' ? Globe : task.kind === 'nearby' ? MapPin : GraduationCap;
  const CatIcon = categoryIcon(task.category);
  const kindLabel =
    task.kind === 'nearby' && task.distanceM != null
      ? formatDistance(task.distanceM)
      : task.kind === 'campus' && task.campusName
        ? task.campusName
        : t(`kind.${task.kind}`);

  return (
    <Animated.View
      style={[
        press.style,
        styles.card,
        {
          backgroundColor: reduceTransparency ? colors.cardSolid : colors.card,
          borderColor: colors.cardBorder,
          boxShadow: `0px 6px 24px ${colors.cardShadow}`,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${task.title}, ${formatMoney(task.rewardCents)}`}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{ gap: 14 }}
      >
        <View style={styles.head}>
          <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
            <CatIcon size={20} strokeWidth={2.4} color={colors.accentText} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="callout" numberOfLines={1} style={{ fontFamily: familyByWeight['700'] }}>
              {t(`category.${task.category}`)}
            </AppText>
            <View style={styles.kind}>
              <KindIcon size={13} strokeWidth={2.6} color={colors.textSecondary} />
              <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                {kindLabel}
              </AppText>
            </View>
          </View>
        </View>
        <AppText variant="title3" numberOfLines={3}>
          {task.title}
        </AppText>
        <View style={styles.bottom}>
          <AppText variant="price" tabular>
            {formatMoney(task.rewardCents)}
          </AppText>
          <View style={[styles.deadline, { backgroundColor: colors.fill }]}>
            <Clock size={14} strokeWidth={2.6} color={colors.text} />
            <AppText variant="caption">{t(`deadline.${task.deadline}`)}</AppText>
          </View>
        </View>
        {footer ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={4}>
            {footer}
          </AppText>
        ) : null}
      </Pressable>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 1, padding: 20, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  deadline: { height: 32, paddingHorizontal: 12, borderRadius: 999, flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: 8 },
});
