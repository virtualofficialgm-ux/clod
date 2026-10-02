'use client';

import { formatDateTime, formatMoney, t, type TranslationKey } from '@parri/shared';
import { useLedger, useMe } from '@parri/shared/react';
import Link from 'next/link';
import { Header } from '@/components/glass/Header';
import { CenterSpinner, PageTitle, SectionTitle } from '@/components/ui/bits';

export default function BalancePage() {
  const me = useMe();
  const ledger = useLedger();
  const w = me.data?.wallet;

  return (
    <>
      <Header title={t('balance.title')} />
      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-6 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle>
          {t('balance.title')}
          <span className="text-accent">.</span>
        </PageTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card flex flex-col gap-1 p-6">
            <p className="text-caption uppercase tracking-wide text-text-2">{t('balance.available')}</p>
            <p className="tabular text-title1 font-extrabold" data-testid="available">
              {formatMoney(w?.available_cents ?? 0)}
            </p>
          </div>
          <div className="card flex flex-col gap-1 p-6">
            <p className="text-caption uppercase tracking-wide text-text-2">{t('balance.safe')}</p>
            <p className="tabular text-title1 font-extrabold">{formatMoney(w?.safe_cents ?? 0)}</p>
            <p className="text-callout text-text-2">{t('safe.hint')}</p>
          </div>
        </div>
        <p className="rounded-md bg-separator px-4 py-3 text-callout font-semibold text-text-2">{t('balance.soon')}</p>
        <SectionTitle>{t('balance.history')}</SectionTitle>
        {ledger.isLoading ? (
          <CenterSpinner />
        ) : !ledger.data?.length ? (
          <p className="text-body text-text-2">{t('balance.empty')}</p>
        ) : (
          <ul className="card divide-y divide-separator">
            {ledger.data.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {t(`ledgerKind.${e.kind}` as TranslationKey)}
                    {e.account === 'escrow' && <span className="text-text-2"> · {t('safe.name')}</span>}
                  </p>
                  <p className="text-caption text-text-2">
                    {formatDateTime(e.created_at)}
                    {e.task_id && (
                      <>
                        {' · '}
                        <Link href={`/tasks/${e.task_id}`} className="underline">
                          {t('task.description').toLowerCase()}
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <span className={`tabular text-body font-extrabold ${e.amount_cents > 0 ? 'text-success' : 'text-text'}`}>
                  {e.amount_cents > 0 ? '+' : '−'}
                  {formatMoney(Math.abs(e.amount_cents))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
