import { formatDateTime, formatMoney, t, type TranslationKey } from '@parri/shared';
import { useLedger, useMe } from '@parri/shared/react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Screen } from '@/components/ui/Screen';
import { Card, Center, PageTitle, SectionTitle } from '@/components/ui/bits';
import { useTheme } from '@/theme/ThemeProvider';

export default function Balance() {
  const me = useMe();
  const ledger = useLedger();
  const { colors } = useTheme();
  const w = me.data?.wallet;
  return (
    <Screen title={t('balance.title')} tabBar onRefresh={() => Promise.all([me.refetch(), ledger.refetch()])}>
      <PageTitle>{t('balance.title')}</PageTitle>
      <Card>
        <AppText variant="caption" color="textSecondary" style={{ textTransform: 'uppercase' }}>
          {t('balance.available')}
        </AppText>
        <AppText variant="title1" tabular testID="available">
          {formatMoney(w?.available_cents ?? 0)}
        </AppText>
      </Card>
      <Card>
        <AppText variant="caption" color="textSecondary" style={{ textTransform: 'uppercase' }}>
          {t('balance.safe')}
        </AppText>
        <AppText variant="title1" tabular>
          {formatMoney(w?.safe_cents ?? 0)}
        </AppText>
        <AppText variant="callout" color="textSecondary">
          {t('safe.hint')}
        </AppText>
      </Card>
      <AppText variant="callout" color="textSecondary">
        {t('balance.soon')}
      </AppText>
      <SectionTitle>{t('balance.history')}</SectionTitle>
      {ledger.isLoading ? (
        <Center />
      ) : !ledger.data?.length ? (
        <AppText variant="body" color="textSecondary">
          {t('balance.empty')}
        </AppText>
      ) : (
        <Card style={{ padding: 0, gap: 0 }}>
          {ledger.data.map((e, i) => (
            <View
              key={e.id}
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.separator }}
            >
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">
                  {t(`ledgerKind.${e.kind}` as TranslationKey)}
                  {e.account === 'escrow' ? ` · ${t('safe.name')}` : ''}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {formatDateTime(e.created_at)}
                </AppText>
              </View>
              <AppText variant="bodyStrong" tabular style={{ color: e.amount_cents > 0 ? colors.success : colors.text }}>
                {e.amount_cents > 0 ? '+' : '−'}
                {formatMoney(Math.abs(e.amount_cents))}
              </AppText>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
