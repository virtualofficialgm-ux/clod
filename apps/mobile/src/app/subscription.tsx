import { SUBSCRIPTION_PRICES, formatDateTime, formatMoney, money, t, type TranslationKey } from '@parri/shared';
import { keys, useApiMutation, useMe, usePayments, useSubscription } from '@parri/shared/react';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Segmented } from '@/components/glass/Segmented';
import { Check, Crown, Sparkles } from '@/components/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { FormError } from '@/components/ui/TextField';
import { PageTitle } from '@/components/ui/bits';
import { Card, ListGroup, ListRow, SoonBadge } from '@/components/ui/kit';
import { openProviderPage, returnUrl } from '@/lib/checkout';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

function Features({ group, n, color, light }: { group: 'freeFeatures' | 'proFeatures' | 'maxFeatures'; n: number; color: string; light?: string }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: n }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Check size={18} strokeWidth={3} color={color} />
          <AppText variant="body" style={{ flex: 1, color: light }}>
            {t(`plans.${group}.f${i + 1}` as TranslationKey)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const me = useMe();
  const sub = useSubscription();
  const payments = usePayments();
  const [interval, setInterval] = useState<'month' | 'year'>('year');
  const plan = me.data?.profile.plan ?? 'free';
  const active = !!sub.data && ['active', 'trialing', 'past_due'].includes(sub.data.status);
  const price = SUBSCRIPTION_PRICES.pro[interval];
  const refresh = () => {
    void me.refetch();
    void sub.refetch();
    void payments.refetch();
  };
  const subscribe = useApiMutation((sb) => money.subscribe(sb, interval, returnUrl('/subscription')), {
    onSuccess: async (r) => {
      if ((await openProviderPage(r.url)) === 'returned') refresh();
    },
  });
  const portal = useApiMutation((sb) => money.portal(sb, returnUrl('/subscription')), {
    invalidate: () => [keys.subscription],
    onSuccess: async (r) => {
      if ((await openProviderPage(r.url)) === 'returned') refresh();
    },
  });
  return (
    <Screen title={t('plans.title')} leading={<BackButton to="/account" />} onRefresh={async () => refresh()}>
      <PageTitle subtitle={t('plans.note')}>{t('plans.title')}</PageTitle>
      <Segmented value={interval} onChange={setInterval} options={[{ value: 'month', label: t('plans.month') }, { value: 'year', label: t('plans.year') }]} />
      <View style={{ backgroundColor: colors.ink, borderRadius: 28, padding: 22, gap: 16, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Sparkles size={20} color={colors.accent} />
            <AppText variant="title3" style={{ color: colors.onInk }}>
              {t('plans.pro')}
            </AppText>
          </View>
          {plan === 'pro' ? (
            <View style={{ backgroundColor: colors.accent, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 3 }}>
              <AppText variant="caption" color="onAccent">
                {t('plans.current')}
              </AppText>
            </View>
          ) : null}
        </View>
        <View>
          <AppText variant="number" tabular style={{ color: colors.onInk }}>
            {formatMoney(price)}
            <AppText variant="body" style={{ color: colors.onInk, opacity: 0.7 }}>
              {interval === 'year' ? t('plans.perYear') : t('plans.perMonth')}
            </AppText>
          </AppText>
          {interval === 'year' ? (
            <AppText variant="callout" style={{ color: colors.onInk, opacity: 0.75 }}>
              {t('plans.yearHint', { sum: formatMoney(price / 12) })}
            </AppText>
          ) : null}
        </View>
        <Features group="proFeatures" n={4} color={colors.accent} light={colors.onInk} />
        {active ? (
          <>
            <AppText variant="callout" style={{ color: colors.onInk, opacity: 0.8 }}>
              {sub.data!.status === 'past_due'
                ? t('plans.pastDue')
                : sub.data!.cancel_at_period_end
                  ? t('plans.cancelsAt', { date: formatDateTime(sub.data!.current_period_end!) })
                  : t('plans.activeUntil', { date: formatDateTime(sub.data!.current_period_end!) })}
            </AppText>
            <Button size="lg" block label={t('plans.manage')} disabled={portal.isPending} onPress={() => portal.mutate(undefined)} />
          </>
        ) : plan === 'pro' ? null : (
          <Button size="lg" block label={t('plans.connectPro')} disabled={subscribe.isPending} onPress={() => subscribe.mutate(undefined)} testID="connect-pro" />
        )}
        <FormError error={subscribe.error?.key ?? portal.error?.key} />
      </View>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <AppText variant="title3">{t('plans.free')}</AppText>
          {plan === 'free' ? (
            <AppText variant="caption" style={{ fontFamily: familyByWeight['700'] }}>
              {t('plans.current')}
            </AppText>
          ) : null}
        </View>
        <Features group="freeFeatures" n={4} color={colors.accent} />
      </Card>
      <Card style={{ opacity: 0.7 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Crown size={20} color={colors.text} />
            <AppText variant="title3">{t('plans.max')}</AppText>
          </View>
          <SoonBadge />
        </View>
        <Features group="maxFeatures" n={3} color={colors.textSecondary} />
      </Card>
      <ListGroup title={t('plans.history')}>
        {(payments.data ?? []).filter((p) => p.kind === 'subscription').length
          ? (payments.data ?? [])
              .filter((p) => p.kind === 'subscription')
              .map((p) => <ListRow key={p.id} title={formatMoney(p.amount_cents)} subtitle={formatDateTime(p.created_at)} value={t(`paymentStatus.${p.status}`)} />)
          : [<ListRow key="e" title={t('balance.empty')} />]}
      </ListGroup>
    </Screen>
  );
}
