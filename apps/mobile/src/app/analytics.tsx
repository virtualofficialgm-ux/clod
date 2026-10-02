import { analytics, formatMoney, t, type TranslationKey } from '@parri/shared';
import { useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { Center, PageTitle } from '@/components/ui/bits';
import { Card, CardHeader, ListGroup, ListRow, ProgressBar, StatTile } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="callout">{label}</AppText>
      <ProgressBar value={value} label={label} />
    </View>
  );
}

export default function Analytics() {
  const sb = useSupabase();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ['analytics'], queryFn: () => analytics.mine(sb) });
  if (!q.data)
    return (
      <Screen title={t('analytics.title')} leading={<BackButton />}>
        <Center />
      </Screen>
    );
  const a = q.data;
  const max = Math.max(1, ...a.weeks.flatMap((w) => [w.created, w.completed]));
  const kindsTotal = Object.values(a.kinds).reduce((s, n) => s + (n ?? 0), 0);
  const funnelMax = Math.max(1, ...Object.values(a.funnel));
  return (
    <Screen title={t('analytics.title')} leading={<BackButton />} onRefresh={() => q.refetch()}>
      <PageTitle>{t('analytics.title')}</PageTitle>
      <View testID="analytics" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {[
          [a.created, t('analytics.created')],
          [a.taken, t('analytics.taken')],
          [formatMoney(a.avg_budget_cents), t('analytics.avgBudget')],
          [`${a.success_rate}%`, t('analytics.success')],
        ].map(([v, l]) => (
          <View key={String(l)} style={{ width: '48%' }}>
            <StatTile value={v as string} label={l as string} />
          </View>
        ))}
      </View>
      <Card>
        <CardHeader title={t('analytics.chart')} />
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140, gap: 6 }}
          accessibilityRole="image"
          accessibilityLabel={t('analytics.chart')}
        >
          {a.weeks.map((w) => (
            <View
              key={w.start}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: 2,
                height: '100%',
              }}
            >
              <View
                style={{
                  width: 7,
                  height: `${(w.created / max) * 100}%`,
                  backgroundColor: colors.chart[0],
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                }}
              />
              <View
                style={{
                  width: 7,
                  height: `${(w.completed / max) * 100}%`,
                  backgroundColor: colors.chart[2],
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                }}
              />
            </View>
          ))}
        </View>
        <AppText variant="caption" color="textSecondary">
          <AppText variant="caption" style={{ color: colors.chart[0] }}>
            ■
          </AppText>{' '}
          {t('analytics.createdSeries')} ·{' '}
          <AppText variant="caption" style={{ color: colors.chart[2] }}>
            ■
          </AppText>{' '}
          {t('analytics.completedSeries')}
        </AppText>
      </Card>
      <Card>
        <CardHeader title={t('analytics.kinds')} />
        {(['online', 'nearby', 'campus'] as const).map((k) => (
          <Bar
            key={k}
            value={kindsTotal ? (a.kinds[k] ?? 0) / kindsTotal : 0}
            label={`${t(`kind.${k}`)} · ${a.kinds[k] ?? 0}`}
          />
        ))}
      </Card>
      <Card>
        <CardHeader title={t('analytics.funnel')} />
        {(['open', 'in_progress', 'review', 'completed'] as const).map((k) => (
          <Bar
            key={k}
            value={a.funnel[k] / funnelMax}
            label={`${t(`analytics.funnelSteps.${k}`)} · ${a.funnel[k]}`}
          />
        ))}
      </Card>
      <ListGroup title={t('analytics.income')}>
        <ListRow title="USD" value={formatMoney(a.income_usd_cents)} />
        <ListRow
          title="USDT"
          value={formatMoney(a.income_usdt_cents, 'ru-RU', { currency: 'USDT' })}
        />
      </ListGroup>
      <ListGroup title={t('analytics.categories')}>
        {a.categories.map((c) => (
          <ListRow
            key={c.category}
            title={t(`category.${c.category}` as TranslationKey)}
            value={String(c.n)}
          />
        ))}
      </ListGroup>
      <ListGroup title={t('analytics.recent')}>
        {a.recent.map((r) => (
          <ListRow
            key={r.id}
            title={r.title}
            value={formatMoney(r.reward_cents, 'ru-RU', { currency: r.currency })}
            onPress={() => router.push(`/task/${r.id}`)}
          />
        ))}
      </ListGroup>
    </Screen>
  );
}
