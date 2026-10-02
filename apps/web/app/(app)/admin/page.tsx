'use client';

import {
  admin,
  formatDateTime,
  formatMoney,
  parseDollars,
  privateDocs,
  t,
  type AdminComplaint,
  type MoneyCurrency,
  type TicketStatus,
  type TranslationKey,
} from '@parri/shared';
import { useApiMutation, useMe, useSupabase } from '@parri/shared/react';
import { useQuery, type QueryKey } from '@tanstack/react-query';
import clsx from 'clsx';
import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { FormError, Input } from '@/components/ui/Field';
import { CenterSpinner, EmptyState, PageTitle } from '@/components/ui/bits';
import { Card, CardHeader, StatTile } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

const TABS = [
  'dashboard',
  'payouts',
  'disputes',
  'support',
  'payments',
  'tasks',
  'kyc',
  'users',
  'complaints',
  'audit',
] as const;
type Tab = (typeof TABS)[number];

/** Мутация админки: сообщение «Готово», обновление списков, ошибка под рукой */
function useAdminAction<V>(
  fn: (sb: Parameters<typeof admin.stats>[0], v: V) => Promise<unknown>,
  keys: QueryKey[],
) {
  const toast = useToast();
  return useApiMutation(fn, {
    invalidate: () => [...keys, ['admin', 'stats']],
    onSuccess: () => toast(t('common.done')),
  });
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <li className={clsx('card flex flex-wrap items-center gap-3 p-4', className)}>{children}</li>
  );
}

function Dashboard() {
  const sb = useSupabase();
  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => admin.stats(sb) });
  if (stats.isLoading) return <CenterSpinner />;
  const s = stats.data!;
  const tiles: [TranslationKey, string | number][] = [
    ['admin.stats.users', s.users],
    ['admin.stats.users_week', s.users_week],
    ['admin.stats.tasks_open', s.tasks_open],
    ['admin.stats.tasks_active', s.tasks_active],
    ['admin.stats.tasks_completed', s.tasks_completed],
    ['admin.stats.turnover', formatMoney(s.turnover_cents, 'ru-RU', { compact: true })],
    ['admin.stats.revenue', formatMoney(s.revenue_cents, 'ru-RU', { compact: true })],
    ['admin.stats.disputes_open', s.disputes_open],
    ['admin.stats.kyc_pending', s.kyc_pending],
    ['admin.stats.tickets_open', s.tickets_open],
    ['admin.stats.payouts_pending', s.payouts_pending],
    ['admin.stats.payments_pending', s.payments_pending],
    ['admin.stats.complaints_new', s.complaints_new],
  ];
  return (
    <div className="flex flex-col gap-4" data-testid="admin-dashboard">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
        {tiles.map(([k, v]) => (
          <StatTile key={k} value={v} label={t(k)} />
        ))}
      </div>
      <Card>
        <CardHeader title={t('admin.services')} />
        <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {(['api', 'site', 'db', 'jobs', 'payments'] as const).map((k) => (
            <li
              key={k}
              className="tile flex items-center gap-2 px-4 py-3 text-callout font-semibold"
            >
              <span className="size-2.5 rounded-full bg-success" /> {t(`admin.serviceNames.${k}`)} ·{' '}
              {t('admin.ok')}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Payouts() {
  const sb = useSupabase();
  const [f, setF] = useState<'waiting' | 'hold' | 'history'>('waiting');
  const statuses = {
    waiting: ['requested', 'approved'],
    hold: ['on_hold'],
    history: ['paid', 'failed', 'rejected', 'processing'],
  }[f];
  const list = useQuery({
    queryKey: ['admin', 'payouts', f],
    queryFn: () => admin.payouts(sb, statuses),
  });
  const decide = useAdminAction(
    (s, v: { id: string; d: 'approve' | 'hold' | 'reject' }) =>
      admin.decidePayout(
        s,
        v.id,
        v.d,
        v.d === 'reject' ? (prompt(t('admin.reasonPrompt')) ?? '') : undefined,
      ),
    [['admin', 'payouts']],
  );
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        label={t('admin.tabs.payouts')}
        value={f}
        onChange={setF}
        options={(['waiting', 'hold', 'history'] as const).map((v) => ({
          value: v,
          label: t(`admin.payoutFilters.${v}`),
        }))}
      />
      <FormError error={decide.error?.key} />
      {list.isLoading ? (
        <CenterSpinner />
      ) : !list.data?.length ? (
        <EmptyState title={t('admin.empty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.data.map((p) => (
            <Row key={p.id}>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">
                  {formatMoney(p.amount_cents, 'ru-RU', { currency: p.currency })} · {p.method}
                </span>
                <span className="text-caption text-text-2">
                  {p.status} · {formatDateTime(p.created_at)} ·{' '}
                  <Link href={`/u/${p.user_id}`} className="underline">
                    {p.user_id.slice(0, 8)}
                  </Link>
                </span>
              </span>
              {['requested', 'on_hold'].includes(p.status) && (
                <div className="flex gap-2">
                  <Button size="md" onClick={() => decide.mutate({ id: p.id, d: 'approve' })}>
                    {t('admin.approve')}
                  </Button>
                  {p.status !== 'on_hold' && (
                    <Button
                      size="md"
                      variant="glass"
                      onClick={() => decide.mutate({ id: p.id, d: 'hold' })}
                    >
                      {t('admin.hold')}
                    </Button>
                  )}
                  <Button
                    size="md"
                    variant="glass"
                    onClick={() => decide.mutate({ id: p.id, d: 'reject' })}
                  >
                    {t('admin.reject')}
                  </Button>
                </div>
              )}
            </Row>
          ))}
        </ul>
      )}
    </div>
  );
}

function Disputes() {
  const sb = useSupabase();
  const list = useQuery({ queryKey: ['admin', 'disputes'], queryFn: () => admin.disputes(sb) });
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [part, setPart] = useState('');
  const decide = useAdminAction(
    (
      s,
      v: { id: string; d: 'in_progress' | 'customer' | 'executor' | 'compromise' | 'rejected' },
    ) => admin.decideDispute(s, v.id, v.d, v.d === 'compromise' ? parseDollars(part) : null, note),
    [['admin', 'disputes']],
  );
  if (list.isLoading) return <CenterSpinner />;
  if (!list.data?.length) return <EmptyState title={t('admin.empty')} />;
  return (
    <ul className="flex flex-col gap-2" data-testid="admin-disputes">
      {list.data.map((d) => (
        <Row key={d.id} className="flex-col items-stretch">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold">
              {t(`disputes.kinds.${d.kind}`)} ·{' '}
              {d.reason_code ? t(`disputes.reasons.${d.reason_code}` as TranslationKey) : ''}
            </span>
            <span className="rounded-pill bg-fill px-3 py-1 text-caption font-bold">
              {t(`disputes.status.${d.status}`)}
            </span>
          </div>
          <p className="text-callout">{d.reason}</p>
          <p className="text-caption text-text-2">
            {formatDateTime(d.created_at)} ·{' '}
            {d.desired ? t(`disputes.desires.${d.desired}` as TranslationKey) : ''}
            {d.amount_cents != null ? ` · ${formatMoney(d.amount_cents)}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            {d.task_id && (
              <Link
                href={`/tasks/${d.task_id}/room`}
                className="glass inline-flex h-10 items-center rounded-pill px-4 text-callout font-bold"
              >
                {t('admin.openTask')}
              </Link>
            )}
            {['pending', 'in_progress'].includes(d.status) && (
              <Button
                size="md"
                variant="glass"
                onClick={() => setOpen(open === d.id ? null : d.id)}
              >
                {t('admin.decide')}
              </Button>
            )}
          </div>
          {open === d.id && (
            <div className="flex flex-col gap-3 rounded-lg bg-fill/60 p-4">
              <Input
                label={t('admin.note')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              {d.kind === 'task' && (
                <Input
                  label={t('admin.executorPart')}
                  inputMode="decimal"
                  value={part}
                  onChange={(e) => setPart(e.target.value)}
                />
              )}
              <FormError error={decide.error?.key} />
              <div className="flex flex-wrap gap-2">
                {d.status === 'pending' && (
                  <Button
                    size="md"
                    variant="glass"
                    onClick={() => decide.mutate({ id: d.id, d: 'in_progress' })}
                  >
                    {t('admin.takeInWork')}
                  </Button>
                )}
                {d.kind === 'task' && (
                  <>
                    <Button size="md" onClick={() => decide.mutate({ id: d.id, d: 'executor' })}>
                      {t('disputes.decision.executor')}
                    </Button>
                    <Button size="md" onClick={() => decide.mutate({ id: d.id, d: 'customer' })}>
                      {t('disputes.decision.customer')}
                    </Button>
                    <Button
                      size="md"
                      variant="glass"
                      disabled={!part}
                      onClick={() => decide.mutate({ id: d.id, d: 'compromise' })}
                    >
                      {t('disputes.decision.compromise')}
                    </Button>
                  </>
                )}
                <Button
                  size="md"
                  variant="glass"
                  onClick={() => decide.mutate({ id: d.id, d: 'rejected' })}
                >
                  {t('admin.reject')}
                </Button>
              </div>
            </div>
          )}
        </Row>
      ))}
    </ul>
  );
}

function Support() {
  const sb = useSupabase();
  const [status, setStatus] = useState<TicketStatus | 'all'>('open');
  const list = useQuery({
    queryKey: ['admin', 'tickets', status],
    queryFn: () => admin.tickets(sb, status === 'all' ? null : status),
  });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {(['all', 'open', 'waiting', 'resolved', 'closed'] as const).map((s) => (
          <Chip key={s} selected={status === s} onClick={() => setStatus(s)}>
            {s === 'all' ? t('common.all') : t(`support.status.${s}`)}
          </Chip>
        ))}
      </div>
      {list.isLoading ? (
        <CenterSpinner />
      ) : !list.data?.length ? (
        <EmptyState title={t('admin.empty')} />
      ) : (
        <ul className="flex flex-col gap-2" data-testid="admin-tickets">
          {list.data.map((x) => (
            <Row key={x.id}>
              <Link href={`/support/${x.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-bold">{x.subject}</span>
                <span className="text-caption text-text-2">
                  {t(`support.categories.${x.category}`)} · {formatDateTime(x.updated_at)}
                </span>
              </Link>
              <span className="rounded-pill bg-fill px-3 py-1 text-caption font-bold">
                {t(`support.status.${x.status}`)}
              </span>
            </Row>
          ))}
        </ul>
      )}
    </div>
  );
}

function Payments() {
  const sb = useSupabase();
  const list = useQuery({ queryKey: ['admin', 'payments'], queryFn: () => admin.payments(sb) });
  const credit = useAdminAction(
    (s, id: string) => admin.creditPayment(s, id),
    [['admin', 'payments']],
  );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-callout text-text-2">{t('admin.reconcileHint')}</p>
      <div>
        <Button variant="glass" onClick={() => list.refetch()}>
          {t('admin.reconcile')}
        </Button>
      </div>
      <FormError error={credit.error?.key} />
      {list.isLoading ? (
        <CenterSpinner />
      ) : !list.data?.length ? (
        <EmptyState title={t('admin.empty')} />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.data.map((p) => (
            <Row key={p.id}>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">
                  {formatMoney(p.amount_cents, 'ru-RU', { currency: p.currency })} · {p.provider}
                </span>
                <span className="text-caption text-text-2">
                  {p.provider_ref ?? '—'} · {formatDateTime(p.created_at)}
                </span>
              </span>
              <Button size="md" onClick={() => credit.mutate(p.id)}>
                {t('admin.credit')}
              </Button>
            </Row>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tasks() {
  const sb = useSupabase();
  const [f, setF] = useState<'open' | 'hidden' | 'cancelled' | 'reported'>('open');
  const [q, setQ] = useState('');
  const list = useQuery({
    queryKey: ['admin', 'tasks', f, q],
    queryFn: () => admin.tasks(sb, f, q),
  });
  const hide = useAdminAction(
    (s, v: { id: string; hide: boolean }) =>
      admin.hideTask(s, v.id, v.hide, v.hide ? (prompt(t('admin.reasonPrompt')) ?? '') : undefined),
    [['admin', 'tasks']],
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Segmented
          label={t('admin.tabs.tasks')}
          value={f}
          onChange={setF}
          options={(['open', 'hidden', 'cancelled', 'reported'] as const).map((v) => ({
            value: v,
            label: t(`admin.taskFilters.${v}`),
          }))}
        />
        <div className="min-w-48 flex-1">
          <Input label={t('admin.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <FormError error={hide.error?.key} />
      {list.isLoading ? (
        <CenterSpinner />
      ) : !list.data?.length ? (
        <EmptyState title={t('admin.empty')} />
      ) : (
        <ul className="flex flex-col gap-2" data-testid="admin-tasks">
          {list.data.map((x) => (
            <Row key={x.id}>
              <Link href={`/tasks/${x.id}`} className="min-w-0 flex-1">
                <span className="block truncate font-bold">{x.title}</span>
                <span className="text-caption text-text-2">
                  {x.customer_name} ·{' '}
                  {formatMoney(x.reward_cents, 'ru-RU', { currency: x.currency })} · {x.complaints}{' '}
                  ⚑{x.hidden_reason ? ` · ${x.hidden_reason}` : ''}
                </span>
              </Link>
              {x.hidden_at ? (
                <Button
                  size="md"
                  variant="glass"
                  onClick={() => hide.mutate({ id: x.id, hide: false })}
                >
                  {t('admin.unhide')}
                </Button>
              ) : (
                <Button
                  size="md"
                  variant="glass"
                  onClick={() => hide.mutate({ id: x.id, hide: true })}
                >
                  {t('admin.hide')}
                </Button>
              )}
            </Row>
          ))}
        </ul>
      )}
    </div>
  );
}

function Kyc() {
  const sb = useSupabase();
  const list = useQuery({ queryKey: ['admin', 'kyc'], queryFn: () => admin.kyc(sb) });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const decide = useAdminAction(
    (s, v: { id: string; d: 'approved' | 'rejected' | 'need_docs' }) =>
      admin.decideKyc(s, v.id, v.d, notes[v.id]),
    [['admin', 'kyc']],
  );
  if (list.isLoading) return <CenterSpinner />;
  if (!list.data?.length) return <EmptyState title={t('admin.empty')} />;
  return (
    <ul className="flex flex-col gap-2" data-testid="admin-kyc">
      {list.data.map((r) => (
        <Row key={r.id} className="flex-col items-stretch">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold">{t(`verify.${r.kind}`)}</span>
            <Link href={`/u/${r.user_id}`} className="text-caption underline">
              {r.user_id.slice(0, 8)}
            </Link>
          </div>
          <pre className="whitespace-pre-wrap break-all rounded-md bg-fill px-3 py-2 text-caption">
            {JSON.stringify(r.payload, null, 1)}
          </pre>
          <div className="flex flex-wrap gap-2">
            {r.files.map((f) => (
              <button
                key={f.path}
                type="button"
                className="text-callout font-semibold underline"
                onClick={async () => window.open(await privateDocs.signedUrl(sb, f.path), '_blank')}
              >
                {f.name}
              </button>
            ))}
          </div>
          <Input
            label={t('admin.note')}
            value={notes[r.id] ?? ''}
            onChange={(e) => setNotes((s) => ({ ...s, [r.id]: e.target.value }))}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="md" onClick={() => decide.mutate({ id: r.id, d: 'approved' })}>
              {t('admin.approve')}
            </Button>
            <Button
              size="md"
              variant="glass"
              onClick={() => decide.mutate({ id: r.id, d: 'need_docs' })}
            >
              {t('admin.requestDocs')}
            </Button>
            <Button
              size="md"
              variant="glass"
              onClick={() => decide.mutate({ id: r.id, d: 'rejected' })}
            >
              {t('admin.reject')}
            </Button>
          </div>
        </Row>
      ))}
    </ul>
  );
}

function Users() {
  const sb = useSupabase();
  const me = useMe();
  const [q, setQ] = useState('');
  const list = useQuery({ queryKey: ['admin', 'users', q], queryFn: () => admin.users(sb, q) });
  const [edit, setEdit] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<MoneyCurrency>('USD');
  const [note, setNote] = useState('');
  const adjust = useAdminAction(
    (s, id: string) => {
      const neg = amount.trim().startsWith('-');
      const cents = parseDollars(amount.replace('-', '')) ?? 0;
      return admin.adjustBalance(s, id, neg ? -cents : cents, currency, note);
    },
    [['admin', 'users']],
  );
  const restrict = useAdminAction(
    (s, v: { id: string; on: boolean }) =>
      admin.restrict(s, v.id, v.on, v.on ? (prompt(t('admin.reasonPrompt')) ?? '') : undefined),
    [['admin', 'users']],
  );
  const isAdmin = me.data?.profile.role === 'admin';
  return (
    <div className="flex flex-col gap-3">
      <Input
        label={t('admin.search')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="email, @ник, UUID"
      />
      <FormError error={(adjust.error ?? restrict.error)?.key} />
      {list.isLoading ? (
        <CenterSpinner />
      ) : (
        <ul className="flex flex-col gap-2" data-testid="admin-users">
          {(list.data ?? []).map((u) => (
            <Row key={u.id} className="flex-col items-stretch">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/u/${u.username ?? u.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-bold">
                    {u.name || '—'} {u.username ? `@${u.username}` : ''}
                  </span>
                  <span className="text-caption text-text-2">
                    {u.email} · {u.role} · {u.plan} · {formatMoney(u.available_cents)} ·{' '}
                    {formatMoney(u.usdt_available_cents, 'ru-RU', { currency: 'USDT' })}
                    {u.banned_at ? ` · ⛔ ${u.banned_reason ?? ''}` : ''}
                  </span>
                </Link>
                {isAdmin && (
                  <Button
                    size="md"
                    variant="glass"
                    onClick={() => setEdit(edit === u.id ? null : u.id)}
                  >
                    {t('admin.adjust')}
                  </Button>
                )}
                {u.banned_at ? (
                  <Button
                    size="md"
                    variant="glass"
                    onClick={() => restrict.mutate({ id: u.id, on: false })}
                  >
                    {t('admin.activate')}
                  </Button>
                ) : (
                  <Button
                    size="md"
                    variant="glass"
                    onClick={() => restrict.mutate({ id: u.id, on: true })}
                  >
                    {t('admin.restrict')}
                  </Button>
                )}
              </div>
              {edit === u.id && (
                <div className="grid gap-2 rounded-lg bg-fill/60 p-3 md:grid-cols-[1fr_auto_2fr_auto] md:items-end">
                  <Input
                    label={t('admin.amount')}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="10 или -5"
                  />
                  <Segmented
                    label="currency"
                    value={currency}
                    onChange={setCurrency}
                    options={[
                      { value: 'USD', label: 'USD' },
                      { value: 'USDT', label: 'USDT' },
                    ]}
                  />
                  <Input
                    label={t('admin.comment')}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <Button
                    onClick={() => adjust.mutate(u.id)}
                    disabled={!amount || note.trim().length < 3}
                  >
                    OK
                  </Button>
                  <span className="text-caption text-text-2 md:col-span-4">
                    {t('admin.adjustHint')}
                  </span>
                </div>
              )}
            </Row>
          ))}
        </ul>
      )}
    </div>
  );
}

function Complaints() {
  const sb = useSupabase();
  const list = useQuery({ queryKey: ['admin', 'complaints'], queryFn: () => admin.complaints(sb) });
  const decide = useAdminAction(
    (s, v: { id: string; st: AdminComplaint['status'] }) => admin.decideComplaint(s, v.id, v.st),
    [['admin', 'complaints']],
  );
  if (list.isLoading) return <CenterSpinner />;
  if (!list.data?.length) return <EmptyState title={t('admin.empty')} />;
  return (
    <ul className="flex flex-col gap-2">
      {list.data.map((c) => (
        <Row key={c.id} className="flex-col items-stretch">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/tasks/${c.task_id}`} className="font-bold underline">
              {c.task_title}
            </Link>
            <span className="rounded-pill bg-fill px-3 py-1 text-caption font-bold">
              {c.status}
            </span>
          </div>
          <p className="text-callout">
            {t(`task.reasons.${c.reason}` as TranslationKey)} · {c.reporter_name}
            {c.details ? ` — ${c.details}` : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="md"
              variant="glass"
              onClick={() => decide.mutate({ id: c.id, st: 'in_review' })}
            >
              {t('admin.takeInWork')}
            </Button>
            <Button
              size="md"
              variant="glass"
              onClick={() => decide.mutate({ id: c.id, st: 'rejected' })}
            >
              {t('admin.reject')}
            </Button>
            <Button
              size="md"
              variant="glass"
              onClick={() => decide.mutate({ id: c.id, st: 'escalated' })}
            >
              {t('admin.escalate')}
            </Button>
            <Button size="md" onClick={() => decide.mutate({ id: c.id, st: 'resolved' })}>
              {t('admin.close')}
            </Button>
          </div>
        </Row>
      ))}
    </ul>
  );
}

function Audit() {
  const sb = useSupabase();
  const list = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => admin.audit(sb) });
  if (list.isLoading) return <CenterSpinner />;
  if (!list.data?.length) return <EmptyState title={t('admin.empty')} />;
  return (
    <ul className="card flex flex-col divide-y divide-separator p-0">
      {list.data.map((a) => (
        <li key={a.id} className="flex flex-wrap gap-x-3 px-4 py-2.5 text-callout">
          <span className="font-mono text-caption text-text-2">{formatDateTime(a.created_at)}</span>
          <span className="font-bold">{a.action}</span>
          <span className="truncate text-text-2">{a.target}</span>
          <span className="truncate text-caption text-text-2">{JSON.stringify(a.payload)}</span>
        </li>
      ))}
    </ul>
  );
}

function Admin() {
  const me = useMe();
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : 'dashboard');
  const staff = me.data?.profile.role === 'admin' || me.data?.profile.role === 'moderator';
  if (!me.data) return <CenterSpinner />;
  if (!staff) {
    return (
      <main className="mx-auto max-w-[640px] px-[var(--p-gutter)] pt-10 md:px-8">
        <EmptyState
          icon={<ShieldAlert size={36} />}
          title={t('service.forbidden')}
          text={t('admin.staffOnly')}
        />
      </main>
    );
  }
  return (
    <>
      <Header title={t('admin.title')} />
      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-5 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle>
          {t('admin.title')}
          <span className="text-accent">.</span>
        </PageTitle>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label={t('admin.title')}
        >
          {TABS.map((x) => (
            <Chip
              key={x}
              selected={tab === x}
              onClick={() => {
                setTab(x);
                router.replace(`/admin?tab=${x}`);
              }}
            >
              {t(`admin.tabs.${x}`)}
            </Chip>
          ))}
        </div>
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'payouts' && <Payouts />}
        {tab === 'disputes' && <Disputes />}
        {tab === 'support' && <Support />}
        {tab === 'payments' && <Payments />}
        {tab === 'tasks' && <Tasks />}
        {tab === 'kyc' && <Kyc />}
        {tab === 'users' && <Users />}
        {tab === 'complaints' && <Complaints />}
        {tab === 'audit' && <Audit />}
      </main>
    </>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<CenterSpinner />}>
      <Admin />
    </Suspense>
  );
}
