import { formatDateTime, formatMoney, money, t, weeklyIncome, type LedgerEntry, type MoneyCurrency, type TranslationKey } from '@parri/shared';
import { useLedger, useMe, usePayouts, useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Segmented } from '@/components/glass/Segmented';
import { ArrowDownLeft, ArrowUpRight, Clock, FileText, Percent, Plus, Wallet } from '@/components/icons';
import { PaymentResult } from '@/components/money/PaymentResult';
import { TopupSheet } from '@/components/money/TopupSheet';
import { Screen } from '@/components/ui/Screen';
import { PageTitle } from '@/components/ui/bits';
import { BarChart, BigNumber, Card, CardHeader, ListGroup, ListRow, PillButton } from '@/components/ui/kit';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

type Filter = 'all' | 'in' | 'out' | 'pending';
const fmt = (c: number, currency: MoneyCurrency, compact = false) => formatMoney(c, 'ru-RU', { currency, compact });

function Details({ entry, onClose }: { entry: LedgerEntry; onClose: () => void }) {
  const sb = useSupabase();
  const r = useQuery({ queryKey: ['receipt', entry.tx_id], queryFn: () => money.receipt(sb, entry.tx_id) }).data;
  const cur = entry.currency ?? 'USD';
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t('balance.details')}
      footer={
        <View style={{ gap: 8 }}>
          <Button variant="glass" block label={t('balance.receipt')} onPress={() => { onClose(); router.push(`/receipt/${entry.tx_id}`); }} />
          {entry.task_id ? (
            <Button variant="glass" block label={t('balance.openRoom')} onPress={() => { onClose(); router.push(`/task/${entry.task_id}/room`); }} />
          ) : (
            <Button
              variant="glass"
              block
              label={t('balance.requestRefund')}
              onPress={() => {
                onClose();
                router.push(entry.kind === 'topup' && entry.memo ? `/balance/refund?payment=${entry.memo}` : `/balance/refund?tx=${entry.tx_id}`);
              }}
            />
          )}
        </View>
      }
    >
      <BigNumber value={`${entry.amount_cents > 0 ? '+' : '−'}${fmt(Math.abs(entry.amount_cents), cur)}`} label={t(`ledgerKind.${entry.kind}` as TranslationKey)} />
      <ListGroup>
        <ListRow title={t('balance.id')} value={entry.tx_id.slice(0, 8)} />
        <ListRow title={t('balance.date')} value={formatDateTime(entry.created_at)} />
        <ListRow title={t('balance.currency')} value={cur} />
        {r?.task ? <ListRow title={t('balance.task')} subtitle={r.task.title} /> : null}
        {r?.task ? <ListRow title={t('balance.reward')} value={fmt(r.task.reward_cents, cur)} /> : null}
        {r?.task ? <ListRow title={t('balance.fee')} value={fmt(r.task.fee_cents, cur)} /> : null}
        {r?.task ? <ListRow title={t('balance.sum')} value={fmt(r.task.reward_cents + r.task.fee_cents, cur)} /> : null}
      </ListGroup>
    </BottomSheet>
  );
}

export default function Balance() {
  const { colors } = useTheme();
  const me = useMe();
  const ledger = useLedger();
  const payouts = usePayouts();
  const params = useLocalSearchParams<{ payment?: string; session_id?: string }>();
  const [currency, setCurrency] = useState<MoneyCurrency>('USD');
  const [filter, setFilter] = useState<Filter>('all');
  const [topup, setTopup] = useState(false);
  const [selected, setSelected] = useState<LedgerEntry | null>(null);
  const [result, setResult] = useState<{ paymentId?: string; sessionId?: string; canceled?: boolean } | null>(
    params.payment ? { sessionId: params.session_id, canceled: params.payment === 'canceled' } : null,
  );
  const w = me.data?.wallet;
  const usd = currency === 'USD';
  const available = (usd ? w?.available_cents : w?.usdt_available_cents) ?? 0;
  const reserved = (usd ? w?.safe_cents : w?.usdt_safe_cents) ?? 0;
  const held = (usd ? w?.held_cents : w?.usdt_held_cents) ?? 0;
  const entries = useMemo(() => (ledger.data ?? []).filter((e) => e.account === 'available' && (e.currency ?? 'USD') === currency), [ledger.data, currency]);
  const shown = filter === 'in' ? entries.filter((e) => e.amount_cents > 0) : filter === 'out' ? entries.filter((e) => e.amount_cents < 0) : entries;
  const pending = (payouts.data ?? []).filter((p) => p.currency === currency && ['requested', 'on_hold', 'approved', 'processing'].includes(p.status));
  const income = weeklyIncome(ledger.data ?? [], 7, currency);
  const weekFmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

  return (
    <Screen
      title={t('balance.title')}
      tabBar
      onRefresh={() => Promise.all([me.refetch(), ledger.refetch(), payouts.refetch()])}
      overlay={
        <>
          <TopupSheet open={topup} onClose={() => setTopup(false)} onCheckoutClosed={(paymentId) => setResult({ paymentId })} />
          {selected ? <Details entry={selected} onClose={() => setSelected(null)} /> : null}
          {result ? (
            <PaymentResult
              {...result}
              onClose={() => {
                setResult(null);
                router.setParams({ payment: undefined, session_id: undefined });
              }}
              onRetry={() => {
                setResult(null);
                setTopup(true);
              }}
            />
          ) : null}
        </>
      }
    >
      <PageTitle>{t('balance.title')}</PageTitle>
      <Segmented
        value={currency}
        onChange={setCurrency}
        options={[
          { value: 'USD', label: 'USD' },
          { value: 'USDT', label: 'USDT' },
        ]}
      />
      <Card>
        <BigNumber value={fmt(available, currency)} label={t('balance.availableHint')} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            [t('balance.safe'), reserved],
            [t('balance.held'), held],
            [t('balance.total'), available + reserved + held],
          ].map(([label, v]) => (
            <View key={label as string} style={{ flex: 1, backgroundColor: colors.fill, borderRadius: 16, padding: 10 }}>
              <AppText variant="bodyStrong" tabular numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: familyByWeight['800'] }}>
                {fmt(v as number, currency, true)}
              </AppText>
              <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                {label as string}
              </AppText>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <PillButton label={t('balance.topup')} icon={(c) => <Plus size={16} strokeWidth={2.8} color={c} />} onPress={() => setTopup(true)} />
          <PillButton tone="fill" label={t('balance.withdraw')} icon={(c) => <ArrowUpRight size={16} strokeWidth={2.8} color={c} />} onPress={() => router.push(`/balance/withdraw?currency=${currency}`)} />
        </View>
      </Card>
      <Card>
        <CardHeader title={t('balance.income')} />
        {income.some((x) => x.cents > 0) ? (
          <BarChart label={t('balance.income')} data={income.map((x) => ({ label: weekFmt.format(x.start), value: x.cents }))} format={(v) => fmt(v, currency, true)} />
        ) : (
          <AppText variant="body" color="textSecondary">
            {t('balance.incomeEmpty')}
          </AppText>
        )}
      </Card>
      <ListGroup>
        <ListRow icon={(c) => <Wallet size={18} color={c} />} title={t('balance.sections.methods')} onPress={() => router.push('/balance/methods')} />
        <ListRow icon={(c) => <FileText size={18} color={c} />} title={t('balance.sections.documents')} onPress={() => router.push('/balance/documents')} />
        <ListRow icon={(c) => <Percent size={18} color={c} />} title={t('balance.sections.limits')} onPress={() => router.push('/balance/limits')} />
      </ListGroup>
      <View style={{ gap: 12 }}>
        <AppText variant="title3" accessibilityRole="header">
          {t('balance.history')}
        </AppText>
        <Segmented value={filter} onChange={setFilter} options={(['all', 'in', 'out', 'pending'] as const).map((f) => ({ value: f, label: t(`balance.filters.${f}`) }))} />
        <ListGroup>
          {filter === 'pending'
            ? pending.length
              ? pending.map((p) => (
                  <ListRow key={p.id} icon={(c) => <Clock size={18} color={c} />} title={t(`withdraw.status.${p.status}`)} subtitle={formatDateTime(p.created_at)} value={`−${fmt(p.amount_cents, p.currency)}`} />
                ))
              : [<ListRow key="e" title={t('balance.empty')} />]
            : shown.length
              ? shown.map((e) => (
                  <ListRow
                    key={e.id}
                    testID="ledger-row"
                    icon={(c) => (e.amount_cents > 0 ? <ArrowDownLeft size={18} color={c} /> : <ArrowUpRight size={18} color={c} />)}
                    title={t(`ledgerKind.${e.kind}` as TranslationKey)}
                    subtitle={formatDateTime(e.created_at)}
                    value={`${e.amount_cents > 0 ? '+' : '−'}${fmt(Math.abs(e.amount_cents), currency)}`}
                    onPress={() => setSelected(e)}
                  />
                ))
              : [<ListRow key="e" title={t('balance.empty')} />]}
        </ListGroup>
      </View>
    </Screen>
  );
}
