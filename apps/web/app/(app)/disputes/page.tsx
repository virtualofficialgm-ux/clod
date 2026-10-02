'use client';

import {
  DISPUTE_DESIRED,
  DISPUTE_REASONS,
  disputeTimeLeft,
  disputes,
  displayStatus,
  formatDateTime,
  formatDuration,
  formatMoney,
  parseDollars,
  t,
  type DisputeDesired,
  type DisputeReason,
  type TranslationKey,
} from '@parri/shared';
import { useApiMutation, useMe, useMyTasks, useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { Lock, Scale } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { LinkButton } from '@/components/ui/LinkButton';
import { Checkbox, FormError, Input, Select, TextArea } from '@/components/ui/Field';
import { CenterSpinner, EmptyState, PageTitle } from '@/components/ui/bits';
import { Card, CardHeader } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

function NewDispute() {
  const toast = useToast();
  const asExec = useMyTasks('executor');
  const asCust = useMyTasks('customer');
  const eligible = useMemo(
    () =>
      [...(asExec.data ?? []), ...(asCust.data ?? [])].filter((x) =>
        ['in_progress', 'review'].includes(displayStatus(x)),
      ),
    [asExec.data, asCust.data],
  );
  const [kind, setKind] = useState<'task' | 'account'>('task');
  const [taskId, setTaskId] = useState('');
  const [reason, setReason] = useState<DisputeReason>('mismatch');
  const [details, setDetails] = useState('');
  const [links, setLinks] = useState('');
  const [desired, setDesired] = useState<DisputeDesired>('refund');
  const [amount, setAmount] = useState('');
  const [truthful, setTruthful] = useState(false);
  const open = useApiMutation(
    (sb) =>
      disputes.open(sb, {
        kind,
        taskId: kind === 'task' ? taskId : null,
        reason,
        details,
        links: links
          .split(/\s+/)
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 5),
        desired,
        amountCents: amount ? parseDollars(amount) : null,
        truthful,
      }),
    {
      invalidate: () => [['disputes'], ['my-tasks']],
      onSuccess: () => {
        toast(t('disputes.sent'));
        setDetails('');
        setTruthful(false);
      },
    },
  );
  return (
    <Card className="flex flex-col gap-4" data-testid="dispute-form">
      <CardHeader title={t('disputes.new')} />
      <Segmented
        label={t('disputes.kind')}
        value={kind}
        onChange={setKind}
        options={(['task', 'account'] as const).map((v) => ({
          value: v,
          label: t(`disputes.kinds.${v}`),
        }))}
      />
      {kind === 'task' &&
        (eligible.length ? (
          <Select
            label={t('disputes.task')}
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            placeholder={t('disputes.chooseTask')}
            options={eligible.map((x) => ({
              value: x.id,
              label: `${x.title} · ${formatMoney(x.reward_cents, 'ru-RU', { currency: x.currency })}`,
            }))}
          />
        ) : (
          <p className="text-callout text-text-2">{t('disputes.noTasks')}</p>
        ))}
      {kind === 'task' && taskId && (
        <Link href={`/tasks/${taskId}/room`} className="text-callout font-bold text-accent-text">
          {t('disputes.openChat')} →
        </Link>
      )}
      <div className="flex flex-col gap-2">
        <span className="text-callout font-bold">{t('disputes.reason')}</span>
        <div className="flex flex-wrap gap-2">
          {DISPUTE_REASONS.map((r) => (
            <Chip key={r} selected={reason === r} onClick={() => setReason(r)}>
              {t(`disputes.reasons.${r}`)}
            </Chip>
          ))}
        </div>
      </div>
      <TextArea
        label={t('disputes.details')}
        placeholder={t('disputes.detailsPlaceholder')}
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={4}
        counterMax={2000}
        maxLength={2000}
      />
      <Input
        label={t('disputes.links')}
        hint={t('disputes.linksHint')}
        value={links}
        onChange={(e) => setLinks(e.target.value)}
        placeholder="https://"
      />
      <div className="flex flex-col gap-2">
        <span className="text-callout font-bold">{t('disputes.desired')}</span>
        <div className="flex flex-wrap gap-2">
          {DISPUTE_DESIRED.map((d) => (
            <Chip key={d} selected={desired === d} onClick={() => setDesired(d)}>
              {t(`disputes.desires.${d}`)}
            </Chip>
          ))}
        </div>
      </div>
      {kind === 'task' && (
        <Input
          label={t('disputes.amount')}
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      )}
      <Checkbox checked={truthful} onChange={setTruthful}>
        {t('disputes.truthful')}
      </Checkbox>
      <FormError error={open.error?.key} />
      <Button
        size="lg"
        block
        disabled={
          open.isPending || !truthful || details.trim().length < 20 || (kind === 'task' && !taskId)
        }
        onClick={() => open.mutate(undefined)}
      >
        {t('disputes.submit')}
      </Button>
    </Card>
  );
}

export default function DisputesPage() {
  const sb = useSupabase();
  const me = useMe();
  const list = useQuery({ queryKey: ['disputes'], queryFn: () => disputes.mine(sb) });
  const pro = me.data?.profile.plan === 'pro';
  return (
    <>
      <Header title={t('disputes.title')} />
      <main className="mx-auto grid max-w-[var(--p-content-max)] gap-6 px-[var(--p-gutter)] pt-2 md:px-8 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="flex min-w-0 flex-col gap-4">
          <PageTitle>
            {t('disputes.title')}
            <span className="text-accent">.</span>
          </PageTitle>
          <h2 className="text-title3 font-bold">{t('disputes.mine')}</h2>
          {list.isLoading ? (
            <CenterSpinner />
          ) : !list.data?.length ? (
            <EmptyState icon={<Scale size={32} />} title={t('disputes.empty')} />
          ) : (
            <ul className="flex flex-col gap-3" data-testid="disputes">
              {list.data.map((d) => (
                <li key={d.id} className="card flex flex-col gap-2 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">{d.task_title ?? t('disputes.kinds.account')}</p>
                    <span className="rounded-pill bg-fill px-3 py-1 text-caption font-bold">
                      {t(`disputes.status.${d.status}`)}
                    </span>
                  </div>
                  <p className="text-callout text-text-2">
                    {d.reason_code ? t(`disputes.reasons.${d.reason_code}`) : ''} ·{' '}
                    {formatDateTime(d.created_at)}
                  </p>
                  {['pending', 'in_progress'].includes(d.status) && (
                    <p className="text-callout font-semibold">
                      {t('disputes.timer', {
                        left: formatDuration(disputeTimeLeft(d.deadline_at)),
                      })}
                    </p>
                  )}
                  {d.decision && (
                    <p className="font-bold text-accent-text">
                      {t(`disputes.decision.${d.decision}`)}
                      {d.executor_cents != null && d.decision === 'compromise'
                        ? ` · ${formatMoney(d.executor_cents)}`
                        : ''}
                    </p>
                  )}
                  {d.resolution && <p className="text-callout">{d.resolution}</p>}
                  <ol className="mt-1 flex flex-col gap-1 border-l-2 border-fill pl-3 text-caption text-text-2">
                    {d.events.map((e, i) => (
                      <li key={i}>
                        {t(`disputes.ev.${e.kind}` as TranslationKey)} · {formatDateTime(e.at)}
                        {e.note ? ` — ${e.note}` : ''}
                      </li>
                    ))}
                  </ol>
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside>
          {pro ? (
            <NewDispute />
          ) : (
            <Card className="flex flex-col gap-3" data-testid="disputes-pro">
              <p className="flex items-center gap-2 text-title3 font-bold">
                <Lock size={20} /> {t('disputes.proOnly')}
              </p>
              <p className="text-callout text-text-2">{t('disputes.proText')}</p>
              <div className="flex flex-wrap gap-2">
                <LinkButton href="/subscription">{t('disputes.toPro')}</LinkButton>
                <LinkButton href="/support" variant="glass">
                  {t('disputes.writeSupport')}
                </LinkButton>
              </div>
            </Card>
          )}
        </aside>
      </main>
    </>
  );
}
