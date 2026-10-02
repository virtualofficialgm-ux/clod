'use client';

import { formatDateTime, formatMoney, responses, t, type TranslationKey } from '@parri/shared';
import { keys, useApiMutation, useSupabase, useTaskDetail } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronLeft } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { ConfirmSheet } from '@/components/task/ConfirmSheet';
import { RespondSheet } from '@/components/task/RespondSheet';
import { LinkButton } from '@/components/ui/LinkButton';
import { CenterSpinner, EmptyState } from '@/components/ui/bits';
import { Card, CardHeader, ListGroup, ListRow } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

type Shown = 'pending' | 'viewed' | 'comparing' | 'accepted' | 'rejected' | 'withdrawn';

export default function ResponsePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sb = useSupabase();
  const toast = useToast();
  const q = useQuery({ queryKey: ['response', id], queryFn: () => responses.mine(sb, id) });
  const r = q.data;
  const detail = useTaskDetail(r?.task_id).data;
  const [sheet, setSheet] = useState<null | 'edit' | 'withdraw'>(null);
  const withdraw = useApiMutation((s) => responses.withdraw(s, id), {
    invalidate: () => [['response', id], keys.task(r?.task_id ?? ''), ['my-tasks']],
    onSuccess: () => {
      toast(t('task.withdrawn'));
      setSheet(null);
    },
  });

  if (q.isLoading) return <CenterSpinner />;
  if (!r)
    return (
      <EmptyState
        title={t('task.notAvailable')}
        action={<LinkButton href="/feed">{t('task.backToFeed')}</LinkButton>}
      />
    );

  const shown: Shown =
    r.status === 'pending'
      ? r.compared
        ? 'comparing'
        : r.viewed_at
          ? 'viewed'
          : 'pending'
      : (r.status as Shown);
  const cur = r.tasks.currency;
  const steps: Shown[] = ['pending', 'viewed', 'comparing', 'accepted'];
  const stepIdx = steps.indexOf(shown);
  const editable = r.status === 'pending' && r.tasks.status === 'open';

  return (
    <>
      <Header
        title={t('respond.statusTitle')}
        leading={
          <Button
            variant="glass"
            size="icon"
            aria-label={t('common.back')}
            onClick={() => router.back()}
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Button>
        }
      />
      <main className="mx-auto flex max-w-[760px] flex-col gap-4 px-[var(--p-gutter)] pt-2 md:px-8">
        <Card className="flex flex-col gap-4">
          <p className="text-callout text-text-2">{r.tasks.title}</p>
          <h1 className="text-title2 font-extrabold" data-testid="response-status">
            {t(`respond.st.${shown}`)}
          </h1>
          {stepIdx >= 0 && (
            <ol className="grid grid-cols-4 gap-2">
              {steps.map((s, i) => (
                <li key={s} className="flex flex-col gap-1.5">
                  <span
                    className={clsx('h-1.5 rounded-pill', i <= stepIdx ? 'bg-accent' : 'bg-fill')}
                  />
                  <span
                    className={clsx('text-caption', i <= stepIdx ? 'text-text' : 'text-text-2')}
                  >
                    {t(`respond.st.${s}`)}
                  </span>
                </li>
              ))}
            </ol>
          )}
          {shown === 'accepted' && <p className="text-callout">{t('respond.chosenText')}</p>}
          {shown === 'rejected' && (
            <p className="text-callout text-text-2">{t('respond.rejectedWhy')}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {shown === 'accepted' ? (
              <LinkButton href={`/tasks/${r.task_id}/room`}>{t('task.openRoom')}</LinkButton>
            ) : (
              <LinkButton href={`/tasks/${r.task_id}`} variant="glass">
                {t('respond.goTask')}
              </LinkButton>
            )}
            {editable && (
              <>
                <Button variant="glass" onClick={() => setSheet('edit')}>
                  {t('respond.edit')}
                </Button>
                <Button
                  variant="plain"
                  className="text-danger"
                  onClick={() => setSheet('withdraw')}
                >
                  {t('task.withdraw')}
                </Button>
              </>
            )}
            {shown === 'rejected' && (
              <>
                <LinkButton href="/feed">{t('respond.findSimilar')}</LinkButton>
                <LinkButton href="/account" variant="glass">
                  {t('respond.improveProfile')}
                </LinkButton>
              </>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title={t('respond.title')} />
          <ListGroup>
            <ListRow title={t('respond.responseId')} value={r.id.slice(0, 8)} />
            <ListRow
              title={t('respond.price')}
              value={formatMoney(r.price_cents, 'ru-RU', { currency: cur })}
            />
            <ListRow title={t('respond.deadline')} value={t(`deadline.${r.deadline}`)} />
            <ListRow title={t('respond.ready')} value={t(`ready.${r.ready}`)} />
            <ListRow title={t('balance.date')} value={formatDateTime(r.created_at)} />
          </ListGroup>
          <p className="mt-4 whitespace-pre-line">{r.cover_letter}</p>
          {r.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.skills.map((s) => (
                <span key={s} className="rounded-pill bg-fill px-3 py-1 text-caption">
                  {t(`skill.${s}` as TranslationKey)}
                </span>
              ))}
            </div>
          )}
          {[...r.portfolio_links, ...(r.video_url ? [r.video_url] : [])].map((l) => (
            <a
              key={l}
              href={l}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block truncate text-callout font-semibold text-accent-text"
            >
              {l}
            </a>
          ))}
        </Card>
      </main>
      {sheet === 'edit' && detail && (
        <RespondSheet
          open
          onClose={() => {
            setSheet(null);
            q.refetch();
          }}
          task={detail.task}
          existing={r}
        />
      )}
      <ConfirmSheet
        open={sheet === 'withdraw'}
        onClose={() => setSheet(null)}
        title={t('task.withdraw')}
        confirmLabel={t('task.withdraw')}
        onConfirm={() => withdraw.mutate(undefined)}
        busy={withdraw.isPending}
        error={withdraw.error?.key}
      />
    </>
  );
}
