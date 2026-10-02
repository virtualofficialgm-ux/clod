import { formatDateTime, formatMoney, t, type TranslationKey } from '@parri/shared';
import { useLedger } from '@parri/shared/react';
import { router } from 'expo-router';
import { FileText } from '@/components/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { EmptyState, PageTitle } from '@/components/ui/bits';
import { ListGroup, ListRow } from '@/components/ui/kit';

export default function Documents() {
  const ledger = useLedger();
  const seen = new Set<string>();
  const rows = (ledger.data ?? []).filter((e) => e.account === 'available' && !seen.has(e.tx_id) && seen.add(e.tx_id));
  return (
    <Screen title={t('docs.title')} leading={<BackButton to="/balance" />}>
      <PageTitle>{t('docs.title')}</PageTitle>
      {rows.length === 0 ? (
        <EmptyState title={t('docs.empty')} />
      ) : (
        <ListGroup>
          {rows.map((e) => (
            <ListRow
              key={e.tx_id}
              icon={(c) => <FileText size={18} color={c} />}
              title={t(`ledgerKind.${e.kind}` as TranslationKey)}
              subtitle={formatDateTime(e.created_at)}
              value={formatMoney(Math.abs(e.amount_cents), 'ru-RU', { currency: e.currency ?? 'USD' })}
              onPress={() => router.push(`/receipt/${e.tx_id}`)}
            />
          ))}
        </ListGroup>
      )}
    </Screen>
  );
}
