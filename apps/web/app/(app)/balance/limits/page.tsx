'use client';

import { FEE_TIERS, calcFee, formatBps, formatDateTime, formatMoney, t } from '@parri/shared';
import { useRates } from '@parri/shared/react';
import { Header } from '@/components/glass/Header';
import { PageTitle } from '@/components/ui/bits';
import { Card, CardHeader, ListGroup, ListRow } from '@/components/ui/kit';

export default function LimitsPage() {
  const rates = useRates();
  const tiers = [...FEE_TIERS].reverse();
  return (
    <>
      <Header title={t('limits.title')} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle>
          {t('limits.title')}
          <span className="text-accent">.</span>
        </PageTitle>
        <Card>
          <CardHeader title={t('limits.fee')} />
          <div className="grid grid-cols-5 gap-2">
            {tiers.map((tier) => (
              <div key={tier.bps} className="tile flex flex-col items-center gap-1 px-2 py-4 text-center">
                <span className="tabular text-title3 font-extrabold">{formatBps(tier.bps)}</span>
                <span className="text-caption text-text-2">{t('limits.tier', { from: formatMoney(tier.fromCents) })}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-body text-text-2">
            {t('fees.rule')} {t('fees.example')} ({formatMoney(calcFee(50000))})
          </p>
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
          {['RUB', 'EUR', 'AED', 'KZT'].map((c) => {
            const r = rates.data?.[c];
            return r ? (
              <ListRow key={c} title={t('limits.rateLine', { value: Number(r.per_usd).toLocaleString('ru-RU'), currency: c, date: formatDateTime(r.fetched_at) })} />
            ) : null;
          })}
          <ListRow title={t('limits.ratesText')} />
        </ListGroup>
      </main>
    </>
  );
}
