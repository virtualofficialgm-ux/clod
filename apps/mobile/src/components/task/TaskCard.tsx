import { formatDistance, formatMoney, t, type ShowcaseTask } from '@parri/shared';
import { radii } from '@parri/ui';
import { Clock, Globe, GraduationCap, MapPin } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { usePressSpring } from '@/components/glass/usePressSpring';
import { useTheme } from '@/theme/ThemeProvider';

export type TaskCardData = ShowcaseTask;

/** Карточка задачи: почти непрозрачная (текст читается легко), крупная цена, формат и срок. */
export function TaskCard({ task, onPress, footer }: { task: TaskCardData; onPress?: () => void; footer?: string }) {
  const { colors, reduceTransparency } = useTheme();
  const press = usePressSpring(0.98);
  const KindIcon = task.kind === 'online' ? Globe : task.kind === 'nearby' ? MapPin : GraduationCap;
  const kindLabel =
    task.kind === 'nearby' && task.distanceM != null
      ? `${t('kind.nearby')} · ${formatDistance(task.distanceM)}`
      : task.kind === 'campus' && task.campusName
        ? task.campusName
        : t(`kind.${task.kind}`);

  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${task.title}, ${formatMoney(task.rewardCents)}`}
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[
          styles.card,
          { backgroundColor: reduceTransparency ? colors.cardSolid : colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <View style={styles.top}>
          <AppText variant="price" color="accentText" tabular>
            {formatMoney(task.rewardCents)}
          </AppText>
          <View style={[styles.badge, { backgroundColor: colors.separator }]}>
            <AppText variant="caption" color="textSecondary">
              {t(`category.${task.category}`)}
            </AppText>
          </View>
        </View>
        <AppText variant="title3">{task.title}</AppText>
        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <KindIcon size={16} strokeWidth={2.4} color={colors.textSecondary} />
            <AppText variant="callout" color="textSecondary">{kindLabel}</AppText>
          </View>
          <View style={styles.metaItem}>
            <Clock size={16} strokeWidth={2.4} color={colors.textSecondary} />
            <AppText variant="callout" color="textSecondary">{t(`deadline.${task.deadline}`)}</AppText>
          </View>
        </View>
        {footer ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={4}>
            {footer}
          </AppText>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 1, padding: 20, gap: 12, boxShadow: '0px 2px 12px rgba(0,0,0,0.04)' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  badge: { borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 4 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
