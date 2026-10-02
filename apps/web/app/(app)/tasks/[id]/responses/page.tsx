'use client';

import {
  calcFee,
  formatAgo,
  formatMoney,
  responses,
  shortName,
  t,
  type ResponseWithExecutor,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation, useTaskDetail, useTaskResponses } from '@parri/shared/react';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { ConfirmSheet } from '@/components/task/ConfirmSheet';
import { Avatar, CenterSpinner, EmptyState, PageTitle } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';

export default function ResponsesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const detail = useTaskDetail(id);
  const isCustomer = detail.data?.viewer_role === 'customer';
  const list = useTaskResponses(id, isCustomer);
  const [picked, setPicked] = useState<ResponseWithExecutor | null>(null);
  const task = detail.data?.task;

  const choose = useApiMutation((sb, responseId: string) => responses.choose(sb, responseId), {
    invalidate: () => [keys.task(id), keys.responses(id), keys.me, ['my-tasks']],
    onSuccess: () => {
      toast(t('responses.chosen'));
      router.push(`/tasks/${id}/room`);
    },
  });

  if (detail.isLoading || list.isLoading) return <CenterSpinner />;
  if (!task || !isCustomer) {
    return (
      <main className="mx-auto max-w-[var(--p-content-max)] px-[var(--p-gutter)] pt-8 md:px-8">
        <EmptyState title={t('task.notFound')} />
      </main>
    );
  }

  const items = list.data ?? [];
  const delta = (r: ResponseWithExecutor) => r.price_cents + calcFee(r.price_cents) - (task.reward_cents + task.fee_cents);
  const canChoose = task.status === 'open' && !task.expired;

  return (
    <>
      <Header
        title={t('responses.title')}
        leading={
          <Button variant="glass" size="icon" aria-label={t('common.back')} onClick={() => router.push(`/tasks/${id}`)}>
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Button>
        }
      />
      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-6 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle subtitle={`${task.title} · ${formatMoney(task.reward_cents)}`}>{t('responses.title')}</PageTitle>
        {items.length === 0 ? (
          <EmptyState title={t('responses.empty')} text={t('responses.emptyHint')} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="responses">
            {items.map((r) => {
              const name = shortName(r.first_name, r.last_name);
              const diff = r.price_cents - task.reward_cents;
              return (
                <article key={r.id} className="card flex flex-col gap-4 p-5">
                  <div className="flex items-center gap-3">
                    <Avatar name={name} url={r.avatar_url} size={48} />
                    <div className="min-w-0">
                      <p className="truncate text-body font-bold">{name}</p>
                      <p className="text-callout text-text-2">
                        {r.rating_avg ? `★ ${Number(r.rating_avg).toFixed(1)} · ` : `${t('responses.noRating')} · `}
                        {t('responses.completed', { n: r.completed_count })}
                      </p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 rounded-md bg-separator p-3 text-center">
                    <div>
                      <dt className="text-caption text-text-2">{t('respond.price')}</dt>
                      <dd className="tabular text-title3 font-extrabold text-accent-text">{formatMoney(r.price_cents)}</dd>
                      {diff !== 0 && (
                        <dd className="tabular text-caption text-text-2">
                          {diff > 0 ? '+' : '−'}
                          {formatMoney(Math.abs(diff))}
                        </dd>
                      )}
                    </div>
                    <div>
                      <dt className="text-caption text-text-2">{t('respond.deadline')}</dt>
                      <dd className="text-callout font-bold">{t(`deadline.${r.deadline}`)}</dd>
                    </div>
                    <div>
                      <dt className="text-caption text-text-2">{t('respond.ready')}</dt>
                      <dd className="text-callout font-bold">{t(`ready.${r.ready}`)}</dd>
                    </div>
                  </dl>
                  <p className="whitespace-pre-line text-body">{r.cover_letter}</p>
                  {r.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {r.skills.map((s) => (
                        <span key={s} className="rounded-pill bg-separator px-3 py-1 text-caption text-text-2">
                          {t(`skill.${s}` as TranslationKey)}
                        </span>
                      ))}
                    </div>
                  )}
                  {r.portfolio_links.map((l) => (
                    <a key={l} href={l} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 break-all text-callout font-semibold text-accent-text">
                      <ExternalLink size={14} aria-hidden /> {l}
                    </a>
                  ))}
                  <div className="mt-auto flex items-center justify-between gap-2">
                    <span className="text-caption text-text-2">{formatAgo(r.created_at)}</span>
                    {r.status === 'pending' && canChoose ? (
                      <Button onClick={() => setPicked(r)}>{t('responses.choose')}</Button>
                    ) : (
                      <span className="text-callout font-bold">{t(`responseStatus.${r.status}` as TranslationKey)}</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      <ConfirmSheet
        open={!!picked}
        onClose={() => setPicked(null)}
        title={t('responses.chooseTitle')}
        text={
          picked && (
            <div className="flex flex-col gap-2">
              <p>
                {t('responses.chooseText', {
                  name: shortName(picked.first_name, picked.last_name),
                  price: formatMoney(picked.price_cents),
                  deadline: t(`deadline.${picked.deadline}`),
                })}
              </p>
              {delta(picked) > 0 && <p className="font-semibold text-text">{t('responses.diffUp', { v: formatMoney(delta(picked)) })}</p>}
              {delta(picked) < 0 && <p className="font-semibold text-text">{t('responses.diffDown', { v: formatMoney(-delta(picked)) })}</p>}
            </div>
          )
        }
        confirmLabel={t('responses.choose')}
        onConfirm={() => picked && choose.mutate(picked.id)}
        busy={choose.isPending}
        error={choose.error?.key}
      />
    </>
  );
}
