import { FEE_TIERS, formatBps, formatDateTime, formatMoney, t } from '@parri/shared';
import { useRates } from '@parri/shared/react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { PageTitle } from '@/components/ui/bits';
import { Card, CardHeader, ListGroup, ListRow } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

export default function Limits() {
  const { colors } = useTheme();
  const rates = useRates();
  return (
    <Screen title={t('limits.title')} leading={<BackButton to="/balance" />}>
      <PageTitle>{t('limits.title')}</PageTitle>
      <Card>
        <CardHeader title={t('limits.fee')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[...FEE_TIERS].reverse().map((tier) => (
            <View key={tier.bps} style={{ width: '31%', backgroundColor: colors.fill, borderRadius: 16, padding: 10, alignItems: 'center' }}>
              <AppText variant="title3" tabular>
                {formatBps(tier.bps)}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                {t('limits.tier', { from: formatMoney(tier.fromCents) })}
              </AppText>
            </View>
          ))}
        </View>
        <AppText variant="callout" color="textSecondary">
          {t('fees.rule')} {t('fees.example')}
        </AppText>
      </Card>
      <ListGroup title={t('limits.topup')}>
        <ListRow title={t('limits.rows.card')} />
        <ListRow title={t('limits.rows.usdt')} />
      </ListGroup>
      <ListGroup title={t('limits.withdraw')}>
        <ListRow title={t('limits.rows.payoutCard')} />
        <ListRow title={t('limits.rows.payoutUsdt')} />
        <ListRow title={t('limits.rows.perHour')} />
        <ListRow title={t('limits.rows.refund')} />
      </ListGroup>
      <ListGroup title={t('limits.rates')}>
        {['RUB', 'EUR', 'AED', 'KZT']
          .map((c) => rates.data?.[c])
          .filter(Boolean)
          .map((r) => (
            <ListRow key={r!.currency} title={t('limits.rateLine', { value: Number(r!.per_usd).toLocaleString('ru-RU'), currency: r!.currency, date: formatDateTime(r!.fetched_at) })} />
          ))}
        <ListRow title={t('limits.ratesText')} />
      </ListGroup>
    </Screen>
  );
}
