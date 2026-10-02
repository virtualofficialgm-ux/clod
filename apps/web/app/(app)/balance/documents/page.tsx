'use client';

import { formatDateTime, formatMoney, t, type TranslationKey } from '@parri/shared';
import { useLedger } from '@parri/shared/react';
import { FileText } from 'lucide-react';
import { Header } from '@/components/glass/Header';
import { EmptyState, PageTitle } from '@/components/ui/bits';
import { ListGroup, ListRow } from '@/components/ui/kit';

/** Квитанции по реальным операциям: одна строка на транзакцию */
export default function DocumentsPage() {
  const ledger = useLedger();
  const seen = new Set<string>();
  const rows = (ledger.data ?? []).filter((e) => e.account === 'available' && !seen.has(e.tx_id) && seen.add(e.tx_id));
  return (
    <>
      <Header title={t('docs.title')} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle>
          {t('docs.title')}
          <span className="text-accent">.</span>
        </PageTitle>
        {rows.length === 0 ? (
          <EmptyState icon={<FileText size={36} />} title={t('docs.empty')} />
        ) : (
          <ListGroup>
            {rows.map((e) => (
              <ListRow
                key={e.tx_id}
                icon={<FileText size={18} />}
                title={t(`ledgerKind.${e.kind}` as TranslationKey)}
                subtitle={formatDateTime(e.created_at)}
                value={formatMoney(Math.abs(e.amount_cents), 'ru-RU', { currency: e.currency ?? 'USD' })}
                href={`/receipt/${e.tx_id}`}
              />
            ))}
          </ListGroup>
        )}
      </main>
    </>
  );
}
