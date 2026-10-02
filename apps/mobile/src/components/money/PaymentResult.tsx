import { formatMoney, money, t, type Payment } from '@parri/shared';
import { keys, useSupabase } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { CircleCheck, CircleX, Clock } from '@/components/icons';
import { useTheme } from '@/theme/ThemeProvider';

/** После страницы оплаты: опрос статуса (баланс меняет только вебхук) и сверка со Stripe */
export function PaymentResult({
  paymentId,
  sessionId,
  canceled,
  onClose,
  onRetry,
}: {
  paymentId?: string | null;
  sessionId?: string | null;
  canceled?: boolean;
  onClose: () => void;
  onRetry: () => void;
}) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      let p = paymentId ? await money.payment(sb, paymentId) : sessionId ? await money.paymentByRef(sb, sessionId) : null;
      if (p?.status === 'pending') p = await money.checkPayment(sb, p.id).catch(() => p);
      setPayment(p);
      if (p?.status === 'succeeded') await qc.invalidateQueries({ queryKey: keys.me });
      await qc.invalidateQueries({ queryKey: keys.ledger });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (canceled) return;
    void check();
    const id = setInterval(() => void check(), 3000);
    const stop = setTimeout(() => clearInterval(id), 30_000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId, sessionId, canceled]);

  const status = canceled ? 'failed' : payment?.status === 'succeeded' ? 'success' : payment && ['failed', 'canceled'].includes(payment.status) ? 'failed' : 'pending';
  const tone = status === 'success' ? colors.success : status === 'failed' ? colors.danger : colors.textSecondary;
  const Icon = status === 'success' ? CircleCheck : status === 'failed' ? CircleX : Clock;
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t(status === 'success' ? 'topup.successTitle' : status === 'failed' ? 'topup.failedTitle' : 'topup.pendingTitle')}
      footer={
        <View style={{ gap: 8 }}>
          {status === 'failed' ? <Button size="lg" block label={t('topup.tryAgain')} onPress={onRetry} /> : null}
          {status === 'pending' ? <Button size="lg" block label={t('topup.checkStatus')} disabled={checking} onPress={() => void check()} /> : null}
          <Button variant={status === 'success' ? 'primary' : 'glass'} size="lg" block label={t('topup.toBalance')} onPress={onClose} testID="payment-close" />
        </View>
      }
    >
      <View style={{ alignItems: 'center', gap: 16, paddingVertical: 12 }} accessibilityLiveRegion="polite">
        <View style={{ width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill }}>
          <Icon size={40} strokeWidth={2.4} color={tone} />
        </View>
        <AppText variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
          {status === 'success' ? t('topup.successText', { sum: formatMoney(payment!.amount_cents) }) : status === 'failed' ? t('topup.failedText') : t('topup.pendingText')}
        </AppText>
      </View>
    </BottomSheet>
  );
}
