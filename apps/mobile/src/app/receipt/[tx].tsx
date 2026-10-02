import { formatBps, formatDateTime, formatMoney, money, t, type TranslationKey } from '@parri/shared';
import { useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Platform, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Printer } from '@/components/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { Center } from '@/components/ui/bits';
import { Card, ListGroup, ListRow } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

export default function ReceiptScreen() {
  const { tx } = useLocalSearchParams<{ tx: string }>();
  const sb = useSupabase();
  const { colors } = useTheme();
  const q = useQuery({ queryKey: ['receipt', tx], queryFn: () => money.receipt(sb, tx!), enabled: !!tx });
  const r = q.data;
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: r?.currency ?? 'USD' });
  return (
    <Screen title={t('docs.receiptTitle')} leading={<BackButton to="/balance/documents" />}>
      {!r ? (
        <Center />
      ) : (
        <>
          <Card>
            <AppText variant="title2">
              Parri<AppText variant="title2" style={{ color: colors.accent }}>.</AppText>
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {t('docs.platform')}
            </AppText>
            <AppText variant="caption" color="textSecondary" selectable>
              {r.tx_id}
            </AppText>
          </Card>
          <ListGroup>
            <ListRow title={t('balance.date')} value={formatDateTime(r.created_at)} />
            <ListRow title={t('balance.type')} value={t(`ledgerKind.${r.kind}` as TranslationKey)} />
            <ListRow title={t('balance.currency')} value={r.currency} />
            {r.task ? <ListRow title={t('balance.task')} subtitle={r.task.title} /> : null}
            {r.task ? <ListRow title={t('balance.reward')} value={fmt(r.task.reward_cents)} /> : null}
            {r.task ? <ListRow title={`${t('balance.fee')} (${formatBps(r.task.fee_bps)})`} value={fmt(r.task.fee_cents)} /> : null}
            {r.task ? <ListRow title={t('balance.sum')} value={fmt(r.task.reward_cents + r.task.fee_cents)} /> : null}
          </ListGroup>
          {Platform.OS === 'web' ? (
            <View>
              <Button variant="glass" label={t('balance.print')} icon={<Printer size={18} color={colors.text} />} onPress={() => window.print()} />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}
