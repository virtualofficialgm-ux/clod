'use client';

import { formatBps, formatDateTime, formatMoney, money, t, type TranslationKey } from '@parri/shared';
import { useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/glass/Button';
import { CenterSpinner, EmptyState } from '@/components/ui/bits';

/** Квитанция по операции: печатается без навигации (print-стили) */
export default function ReceiptPage() {
  const { tx } = useParams<{ tx: string }>();
  const sb = useSupabase();
  const q = useQuery({ queryKey: ['receipt', tx], queryFn: () => money.receipt(sb, tx) });
  if (q.isLoading) return <CenterSpinner />;
  const r = q.data;
  if (!r) return <EmptyState title={t('task.notFound')} />;
  const cur = r.currency;
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: cur });
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-[var(--p-gutter)] pt-8 print:max-w-none print:p-0">
      <article className="card flex flex-col gap-5 p-8 print:border-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[28px] font-extrabold tracking-[-0.04em]">
              Parri<span className="text-accent">.</span>
            </p>
            <p className="text-caption text-text-2">{t('docs.platform')}</p>
          </div>
          <div className="text-right">
            <p className="text-title3 font-bold">{t('docs.receiptTitle')}</p>
            <p className="font-mono text-caption text-text-2">{r.tx_id}</p>
          </div>
        </header>
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-3 text-body">
          <dt className="text-text-2">{t('balance.date')}</dt>
          <dd>{formatDateTime(r.created_at)}</dd>
          <dt className="text-text-2">{t('balance.type')}</dt>
          <dd>{t(`ledgerKind.${r.kind}` as TranslationKey)}</dd>
          <dt className="text-text-2">{t('balance.currency')}</dt>
          <dd>{cur}</dd>
          {r.task && (
            <>
              <dt className="text-text-2">{t('balance.task')}</dt>
              <dd className="text-right font-semibold">{r.task.title}</dd>
              <dt className="text-text-2">{t('balance.reward')}</dt>
              <dd className="tabular">{fmt(r.task.reward_cents)}</dd>
              <dt className="text-text-2">
                {t('balance.fee')} ({formatBps(r.task.fee_bps)})
              </dt>
              <dd className="tabular">{fmt(r.task.fee_cents)}</dd>
              <dt className="font-bold">{t('balance.sum')}</dt>
              <dd className="tabular font-extrabold">{fmt(r.task.reward_cents + r.task.fee_cents)}</dd>
            </>
          )}
        </dl>
        {!r.task && (
          <ul className="flex flex-col gap-1 border-t border-separator pt-4">
            {r.entries
              .filter((e) => e.account === 'available' || e.account === 'hold')
              .map((e, i) => (
                <li key={i} className="flex justify-between">
                  <span className="text-text-2">{e.account}</span>
                  <span className="tabular font-bold">{fmt(e.amount_cents)}</span>
                </li>
              ))}
          </ul>
        )}
      </article>
      <Button variant="glass" onClick={() => window.print()} className="self-center print:hidden">
        <Printer size={18} />
        {t('balance.print')}
      </Button>
    </main>
  );
}
