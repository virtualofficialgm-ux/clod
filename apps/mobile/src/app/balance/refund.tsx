import { formatMoney, money, parseDollars, t, type RefundRequest } from '@parri/shared';
import { keys, useApiMutation, usePayments, useRefunds } from '@parri/shared/react';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { CircleCheck } from '@/components/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField } from '@/components/ui/TextField';
import { PageTitle } from '@/components/ui/bits';
import { Card, OptionTile } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

const REASONS: RefundRequest['reason'][] = ['not_provided', 'double_charge', 'unknown', 'other'];

export default function Refund() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ payment?: string; tx?: string }>();
  const payments = usePayments();
  const refunds = useRefunds();
  const payment = payments.data?.find((p) => p.id === params.payment);
  const [reason, setReason] = useState<RefundRequest['reason'] | null>(null);
  const [amount, setAmount] = useState('');
  const [details, setDetails] = useState('');
  const [sent, setSent] = useState(false);
  const cents = parseDollars(amount || (payment ? String((payment.amount_cents - payment.refunded_cents) / 100) : ''));
  const submit = useApiMutation(
    (sb) => money.requestRefund(sb, { paymentId: params.payment ?? null, ledgerTx: params.payment ? null : params.tx ?? null, reason: reason!, amountCents: cents ?? 0, details }),
    { invalidate: () => [keys.refunds], onSuccess: () => setSent(true) },
  );
  return (
    <Screen title={t('refund.title')} leading={<BackButton to="/balance" />}>
      <PageTitle>{t('refund.title')}</PageTitle>
      {sent ? (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <CircleCheck size={48} color={colors.success} />
          <AppText variant="title3">{t('refund.sentTitle')}</AppText>
          <AppText variant="body" color="textSecondary">
            {t('refund.sentText')}
          </AppText>
        </Card>
      ) : (
        <>
          {payment ? (
            <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <AppText variant="bodyStrong">{t('topup.title')}</AppText>
              <AppText variant="bodyStrong" tabular>
                {formatMoney(payment.amount_cents)}
              </AppText>
            </Card>
          ) : null}
          {REASONS.map((r) => (
            <OptionTile key={r} title={t(`refund.reasons.${r}`)} selected={reason === r} onPress={() => setReason(r)} />
          ))}
          <TextField label={t('refund.amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder={payment ? String((payment.amount_cents - payment.refunded_cents) / 100) : ''} />
          <TextField label={t('refund.details')} hint={t('refund.detailsHint')} value={details} onChangeText={setDetails} multiline counterMax={2000} />
          <FormError error={submit.error?.key} />
          <Button size="lg" block label={t('refund.submit')} disabled={!reason || !cents || details.trim().length < 10 || submit.isPending} onPress={() => submit.mutate(undefined)} />
        </>
      )}
      {(refunds.data ?? []).map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <AppText variant="bodyStrong">{t(`refund.reasons.${r.reason}`)}</AppText>
            <AppText variant="bodyStrong">{formatMoney(r.amount_cents, 'ru-RU', { currency: r.currency })}</AppText>
          </View>
          <AppText variant="callout" color="textSecondary">
            {t(`refund.status.${r.status}`)}
            {r.resolution ? ` · ${r.resolution}` : ''}
          </AppText>
        </Card>
      ))}
    </Screen>
  );
}
