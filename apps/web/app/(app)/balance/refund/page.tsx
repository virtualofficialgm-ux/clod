'use client';

import { formatDateTime, formatMoney, money, parseDollars, t, type RefundRequest } from '@parri/shared';
import { keys, useApiMutation, usePayments, useRefunds } from '@parri/shared/react';
import clsx from 'clsx';
import { CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { FormError, TextArea } from '@/components/ui/Field';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageTitle } from '@/components/ui/bits';
import { Card, OptionTile } from '@/components/ui/kit';

const REASONS: RefundRequest['reason'][] = ['not_provided', 'double_charge', 'unknown', 'other'];
const STEPS: RefundRequest['status'][] = ['created', 'reviewing', 'refunded'];

function Timeline({ r }: { r: RefundRequest }) {
  const steps = r.status === 'rejected' ? (['created', 'reviewing', 'rejected'] as const) : STEPS;
  const at = steps.indexOf(r.status as never);
  return (
    <ol className="flex items-center gap-2" aria-label={t(`refund.status.${r.status}`)}>
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 flex-col gap-1.5">
          <span className={clsx('h-1.5 rounded-pill', i <= at ? (s === 'rejected' ? 'bg-danger' : 'bg-ink') : 'bg-fill')} />
          <span className={clsx('text-caption', i <= at ? 'text-text' : 'text-text-2')}>{t(`refund.status.${s}`)}</span>
        </li>
      ))}
    </ol>
  );
}

function RefundInner() {
  const params = useSearchParams();
  const payments = usePayments();
  const refunds = useRefunds();
  const paymentId = params.get('payment');
  const tx = params.get('tx');
  const payment = payments.data?.find((p) => p.id === paymentId);
  const [reason, setReason] = useState<RefundRequest['reason'] | null>(null);
  const [amount, setAmount] = useState(payment ? String((payment.amount_cents - payment.refunded_cents) / 100) : '');
  const [details, setDetails] = useState('');
  const [sent, setSent] = useState(false);
  const cents = parseDollars(amount || (payment ? String((payment.amount_cents - payment.refunded_cents) / 100) : ''));

  const submit = useApiMutation(
    (sb) => money.requestRefund(sb, { paymentId, ledgerTx: paymentId ? null : tx, reason: reason!, amountCents: cents ?? 0, details }),
    { invalidate: () => [keys.refunds], onSuccess: () => setSent(true) },
  );

  return (
    <>
      <Header title={t('refund.title')} />
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle>
          {t('refund.title')}
          <span className="text-accent">.</span>
        </PageTitle>
        {sent ? (
          <Card className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 size={40} />
            </span>
            <h2 className="text-title3 font-bold">{t('refund.sentTitle')}</h2>
            <p className="text-body text-text-2">{t('refund.sentText')}</p>
            <LinkButton href="/balance" variant="glass">
              {t('topup.toBalance')}
            </LinkButton>
          </Card>
        ) : paymentId || tx ? (
          <>
            {payment && (
              <Card className="flex items-center justify-between">
                <span className="text-body font-bold">{t('topup.title')} · {formatDateTime(payment.created_at)}</span>
                <span className="tabular text-title3 font-extrabold">{formatMoney(payment.amount_cents, 'ru-RU', { currency: payment.currency })}</span>
              </Card>
            )}
            <section className="flex flex-col gap-2" role="radiogroup" aria-label={t('refund.reason')}>
              <h2 className="text-callout font-bold">{t('refund.reason')}</h2>
              {REASONS.map((r) => (
                <OptionTile key={r} selected={reason === r} onClick={() => setReason(r)} title={t(`refund.reasons.${r}`)} />
              ))}
            </section>
            <label className="tile flex h-14 items-center gap-2 px-4">
              <span className="font-bold text-text-2">$</span>
              <input inputMode="decimal" aria-label={t('refund.amount')} placeholder={t('refund.amount')} value={amount} onChange={(e) => setAmount(e.target.value)} className="h-full flex-1 bg-transparent font-bold outline-none" />
            </label>
            <TextArea label={t('refund.details')} hint={t('refund.detailsHint')} value={details} onChange={(e) => setDetails(e.target.value)} rows={4} counterMax={2000} />
            <FormError error={submit.error?.key} />
            <Button size="lg" block disabled={!reason || !cents || details.trim().length < 10 || submit.isPending} onClick={() => submit.mutate(undefined)}>
              {t('refund.submit')}
            </Button>
          </>
        ) : null}

        {!!refunds.data?.length && (
          <section className="flex flex-col gap-3">
            <h2 className="text-title3 font-bold">{t('refund.mine')}</h2>
            {refunds.data.map((r) => (
              <Card key={r.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">{t(`refund.reasons.${r.reason}`)}</span>
                  <span className="tabular font-extrabold">{formatMoney(r.amount_cents, 'ru-RU', { currency: r.currency })}</span>
                </div>
                <Timeline r={r} />
                {r.resolution && <p className="text-callout text-text-2">{r.resolution}</p>}
                <LinkButton href="/support" variant="glass" size="md">
                  {t('refund.support')}
                </LinkButton>
              </Card>
            ))}
          </section>
        )}
      </main>
    </>
  );
}

export default function RefundPage() {
  return (
    <Suspense>
      <RefundInner />
    </Suspense>
  );
}
