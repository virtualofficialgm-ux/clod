'use client';

import { formatMoney, money, t, type Payment } from '@parri/shared';
import { keys, useSupabase } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';

/**
 * Экран после возврата со страницы оплаты: «Оплата прошла», «Платёж отклонён» или «Ждём подтверждение».
 * Баланс меняет только вебхук; здесь — опрос статуса и сверка со Stripe (payment_status).
 */
export function PaymentResult({ sessionId, canceled, onClose, onRetry }: { sessionId: string | null; canceled: boolean; onClose: () => void; onRetry: () => void }) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [checking, setChecking] = useState(false);

  const check = async () => {
    if (!sessionId) return;
    setChecking(true);
    try {
      let p = await money.paymentByRef(sb, sessionId);
      if (p?.status === 'pending') p = await money.checkPayment(sb, p.id).catch(() => p);
      setPayment(p);
      if (p?.status === 'succeeded') await qc.invalidateQueries({ queryKey: keys.me });
      await qc.invalidateQueries({ queryKey: keys.ledger });
      await qc.invalidateQueries({ queryKey: keys.payments });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    void check();
    const id = setInterval(() => void check(), 3000);
    const stop = setTimeout(() => clearInterval(id), 30_000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const status = canceled ? 'failed' : payment?.status === 'succeeded' ? 'success' : payment && ['failed', 'canceled'].includes(payment.status) ? 'failed' : 'pending';
  const Icon = status === 'success' ? CheckCircle2 : status === 'failed' ? XCircle : Clock;

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t(status === 'success' ? 'topup.successTitle' : status === 'failed' ? 'topup.failedTitle' : 'topup.pendingTitle')}
      footer={
        <div className="flex flex-col gap-2">
          {status === 'failed' ? (
            <Button size="lg" block onClick={onRetry}>
              {t('topup.tryAgain')}
            </Button>
          ) : status === 'pending' ? (
            <Button size="lg" block disabled={checking} onClick={() => void check()}>
              {t('topup.checkStatus')}
            </Button>
          ) : null}
          <Button variant={status === 'success' ? 'primary' : 'glass'} size="lg" block onClick={onClose}>
            {t('topup.toBalance')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col items-center gap-4 py-4 text-center" aria-live="polite">
        <span
          className={
            status === 'success'
              ? 'flex size-20 items-center justify-center rounded-full bg-success/15 text-success'
              : status === 'failed'
                ? 'flex size-20 items-center justify-center rounded-full bg-danger/12 text-danger'
                : 'flex size-20 items-center justify-center rounded-full bg-fill text-text-2'
          }
        >
          <Icon size={40} strokeWidth={2.4} />
        </span>
        <p className="text-body text-text-2">
          {status === 'success'
            ? t('topup.successText', { sum: formatMoney(payment!.amount_cents) })
            : status === 'failed'
              ? t('topup.failedText')
              : t('topup.pendingText')}
        </p>
      </div>
    </BottomSheet>
  );
}
