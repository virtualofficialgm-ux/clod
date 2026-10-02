'use client';

import {
  formatAgo,
  formatDateTime,
  formatMoney,
  money,
  t,
  weeklyIncome,
  type LedgerEntry,
  type MoneyCurrency,
  type Receipt,
  type TranslationKey,
} from '@parri/shared';
import { useLedger, useMe, usePayments, usePayouts, useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownLeft, ArrowUpRight, Clock, FileText, Percent, Plus, RefreshCw, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { PaymentResult } from '@/components/money/PaymentResult';
import { TopupSheet } from '@/components/money/TopupSheet';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageTitle } from '@/components/ui/bits';
import { BarChart, BigNumber, Card, CardHeader, ListGroup, ListRow } from '@/components/ui/kit';

type Filter = 'all' | 'in' | 'out' | 'pending';

const fmt = (cents: number, currency: MoneyCurrency, compact = false) => formatMoney(cents, 'ru-RU', { currency, compact });

function EntryDetails({ entry, onClose }: { entry: LedgerEntry; onClose: () => void }) {
  const sb = useSupabase();
  const receipt = useQuery({ queryKey: ['receipt', entry.tx_id], queryFn: () => money.receipt(sb, entry.tx_id) });
  const r: Receipt | undefined = receipt.data;
  const currency = entry.currency ?? 'USD';
  const isTopup = entry.kind === 'topup';
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t('balance.details')}
      footer={
        <div className="grid gap-2 sm:grid-cols-2">
          <LinkButton href={`/receipt/${entry.tx_id}`} variant="glass">
            <FileText size={18} />
            {t('balance.receipt')}
          </LinkButton>
          {entry.task_id ? (
            <LinkButton href={`/tasks/${entry.task_id}/room`} variant="glass">
              {t('balance.openRoom')}
            </LinkButton>
          ) : (
            <LinkButton href={isTopup && entry.memo ? `/balance/refund?payment=${entry.memo}` : `/balance/refund?tx=${entry.tx_id}`} variant="glass">
              {t('balance.requestRefund')}
            </LinkButton>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <BigNumber value={`${entry.amount_cents > 0 ? '+' : '−'}${fmt(Math.abs(entry.amount_cents), currency)}`} label={t(`ledgerKind.${entry.kind}` as TranslationKey)} />
        <ListGroup>
          <ListRow title={t('balance.id')} value={<span className="font-mono text-caption">{entry.tx_id.slice(0, 8)}</span>} />
          <ListRow title={t('balance.date')} value={formatDateTime(entry.created_at)} />
          <ListRow title={t('balance.currency')} value={currency} />
          {r?.task && (
            <>
              <ListRow title={t('balance.task')} subtitle={r.task.title} href={`/tasks/${r.task.id}`} />
              <ListRow title={t('balance.reward')} value={fmt(r.task.reward_cents, currency)} />
              <ListRow title={t('balance.fee')} value={fmt(r.task.fee_cents, currency)} />
              <ListRow title={t('balance.sum')} value={<span className="font-extrabold text-text">{fmt(r.task.reward_cents + r.task.fee_cents, currency)}</span>} />
            </>
          )}
        </ListGroup>
      </div>
    </BottomSheet>
  );
}

function BalanceInner() {
  const me = useMe();
  const ledger = useLedger();
  const payouts = usePayouts();
  const payments = usePayments();
  const router = useRouter();
  const params = useSearchParams();
  const [currency, setCurrency] = useState<MoneyCurrency>('USD');
  const [filter, setFilter] = useState<Filter>('all');
  const [topup, setTopup] = useState(params.get('topup') === '1');
  const [selected, setSelected] = useState<LedgerEntry | null>(null);
  const paymentResult = params.get('payment');
  const w = me.data?.wallet;

  const usd = currency === 'USD';
  const available = (usd ? w?.available_cents : w?.usdt_available_cents) ?? 0;
  const reserved = (usd ? w?.safe_cents : w?.usdt_safe_cents) ?? 0;
  const held = (usd ? w?.held_cents : w?.usdt_held_cents) ?? 0;

  const entries = useMemo(
    () => (ledger.data ?? []).filter((e) => e.account === 'available' && (e.currency ?? 'USD') === currency),
    [ledger.data, currency],
  );
  const pending = [
    ...(payouts.data ?? []).filter((p) => p.currency === currency && ['requested', 'on_hold', 'approved', 'processing'].includes(p.status)),
  ];
  const pendingPayments = (payments.data ?? []).filter((p) => p.currency === currency && p.status === 'pending');
  const shown = filter === 'in' ? entries.filter((e) => e.amount_cents > 0) : filter === 'out' ? entries.filter((e) => e.amount_cents < 0) : entries;
  const income = weeklyIncome(ledger.data ?? [], 7, currency);
  const weekFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

  const refresh = () => Promise.all([me.refetch(), ledger.refetch(), payouts.refetch(), payments.refetch()]);

  return (
    <>
      <Header title={t('balance.title')} />
      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-6 px-[var(--p-gutter)] pt-2 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageTitle>
            {t('balance.title')}
            <span className="text-accent">.</span>
          </PageTitle>
          <div className="flex items-center gap-2">
            <Segmented
              label={t('balance.currency')}
              value={currency}
              onChange={setCurrency}
              options={[
                { value: 'USD', label: 'USD' },
                { value: 'USDT', label: 'USDT' },
              ]}
            />
            <button type="button" aria-label={t('balance.refresh')} onClick={() => void refresh()} className="glass flex size-12 items-center justify-center rounded-full">
              <RefreshCw size={18} />
            </button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="flex flex-col gap-5">
            <BigNumber value={fmt(available, currency)} label={t('balance.availableHint')} />
            <div className="grid grid-cols-3 gap-2">
              {[
                [t('balance.safe'), reserved],
                [t('balance.held'), held],
                [t('balance.total'), available + reserved + held],
              ].map(([label, v]) => (
                <div key={label as string} className="tile flex flex-col px-3 py-3">
                  <span className="tabular text-body font-extrabold">{fmt(v as number, currency, true)}</span>
                  <span className="text-caption text-text-2">{label}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setTopup(true)} className="inline-flex h-12 items-center gap-2 rounded-pill bg-ink px-5 font-bold text-on-ink">
                <Plus size={18} strokeWidth={2.8} />
                {t('balance.topup')}
              </button>
              <Link href={`/balance/withdraw?currency=${currency}`} className="inline-flex h-12 items-center gap-2 rounded-pill bg-fill px-5 font-bold">
                <ArrowUpRight size={18} strokeWidth={2.8} />
                {t('balance.withdraw')}
              </Link>
            </div>
          </Card>
          <Card>
            <CardHeader title={t('balance.income')} />
            {income.some((x) => x.cents > 0) ? (
              <BarChart
                label={t('balance.income')}
                data={income.map((x) => ({ label: weekFmt.format(x.start), value: x.cents }))}
                format={(v) => fmt(v, currency, true)}
              />
            ) : (
              <p className="text-body text-text-2">{t('balance.incomeEmpty')}</p>
            )}
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card className="p-0 md:p-0">
            <div className="flex flex-col gap-4 px-5 pt-5 md:px-6 md:pt-6">
              <h2 className="text-title3 font-bold">{t('balance.history')}</h2>
              <Segmented
                label={t('balance.history')}
                value={filter}
                onChange={setFilter}
                options={(['all', 'in', 'out', 'pending'] as const).map((f) => ({ value: f, label: t(`balance.filters.${f}`) }))}
              />
            </div>
            <div className="mt-3 divide-y divide-separator">
              {filter === 'pending' ? (
                pending.length + pendingPayments.length === 0 ? (
                  <p className="px-6 py-6 text-body text-text-2">{t('balance.empty')}</p>
                ) : (
                  <>
                    {pending.map((p) => (
                      <ListRow
                        key={p.id}
                        icon={<Clock size={18} />}
                        title={t(`withdraw.status.${p.status}`)}
                        subtitle={`${t('balance.withdraw')} · ${formatAgo(p.created_at)}`}
                        value={`−${fmt(p.amount_cents, p.currency)}`}
                        href="/balance/withdraw"
                      />
                    ))}
                    {pendingPayments.map((p) => (
                      <ListRow key={p.id} icon={<Clock size={18} />} title={t('paymentStatus.pending')} subtitle={formatAgo(p.created_at)} value={`+${fmt(p.amount_cents, p.currency)}`} />
                    ))}
                  </>
                )
              ) : shown.length === 0 ? (
                <p className="px-6 py-6 text-body text-text-2">{t('balance.empty')}</p>
              ) : (
                shown.map((e) => (
                  <ListRow
                    key={e.id}
                    icon={e.amount_cents > 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                    title={t(`ledgerKind.${e.kind}` as TranslationKey)}
                    subtitle={formatDateTime(e.created_at)}
                    value={
                      <span className={e.amount_cents > 0 ? 'tabular font-bold text-success' : 'tabular font-bold text-text'}>
                        {e.amount_cents > 0 ? '+' : '−'}
                        {fmt(Math.abs(e.amount_cents), currency)}
                      </span>
                    }
                    onClick={() => setSelected(e)}
                  />
                ))
              )}
            </div>
          </Card>
          <div className="flex flex-col gap-6">
            <ListGroup>
              <ListRow icon={<Wallet size={18} />} title={t('balance.sections.methods')} href="/balance/methods" />
              <ListRow icon={<FileText size={18} />} title={t('balance.sections.documents')} href="/balance/documents" />
              <ListRow icon={<Percent size={18} />} title={t('balance.sections.limits')} href="/balance/limits" />
            </ListGroup>
          </div>
        </div>
      </main>
      <TopupSheet open={topup} onClose={() => setTopup(false)} />
      {selected && <EntryDetails entry={selected} onClose={() => setSelected(null)} />}
      {paymentResult && (
        <PaymentResult
          sessionId={params.get('session_id')}
          canceled={paymentResult === 'canceled'}
          onClose={() => router.replace('/balance')}
          onRetry={() => {
            router.replace('/balance');
            setTopup(true);
          }}
        />
      )}
    </>
  );
}

export default function BalancePage() {
  return (
    <Suspense>
      <BalanceInner />
    </Suspense>
  );
}
