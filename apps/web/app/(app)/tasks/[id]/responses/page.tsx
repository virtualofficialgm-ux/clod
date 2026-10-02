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
import clsx from 'clsx';
import { ChevronLeft, ExternalLink, Video } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { Input } from '@/components/ui/Field';
import { StatTile } from '@/components/ui/kit';
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
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'match' | 'cheap' | 'new'>('match');
  const [onlyCompared, setOnlyCompared] = useState(false);
  const task = detail.data?.task;
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: task?.currency });

  // Открытие списка = заказчик просмотрел отклики
  const viewed = useRef(false);
  const markViewed = useApiMutation((sb) => responses.markViewed(sb, id), { invalidate: () => [keys.responses(id), ['my-tasks']] });
  const newCount = (list.data ?? []).filter((r) => !r.viewed_at && r.status === 'pending').length;
  useEffect(() => {
    if (isCustomer && newCount > 0 && !viewed.current) {
      viewed.current = true;
      markViewed.mutate(undefined);
    }
  }, [isCustomer, newCount, markViewed]);
  const compare = useApiMutation((sb, v: { id: string; on: boolean }) => responses.setCompared(sb, v.id, v.on), { invalidate: () => [keys.responses(id)] });

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = (list.data ?? []).filter(
      (r) => (!needle || `${r.first_name ?? ''} ${r.last_name ?? ''} ${r.username ?? ''} ${r.cover_letter}`.toLowerCase().includes(needle)) && (!onlyCompared || r.compared),
    );
    const by = {
      match: (a: ResponseWithExecutor, b: ResponseWithExecutor) => b.match - a.match || (b.rating_avg ?? 0) - (a.rating_avg ?? 0),
      cheap: (a: ResponseWithExecutor, b: ResponseWithExecutor) => a.price_cents - b.price_cents,
      new: (a: ResponseWithExecutor, b: ResponseWithExecutor) => b.created_at.localeCompare(a.created_at),
    }[sort];
    return [...all].sort(by);
  }, [list.data, q, sort, onlyCompared]);

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

  const all = list.data ?? [];
  const comparedCount = all.filter((r) => r.compared).length;
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
        <PageTitle subtitle={`${task.title} · ${fmt(task.reward_cents)}`}>{t('responses.title')}</PageTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile value={all.length} label={t('responses.counters.total')} />
          <StatTile value={newCount} label={t('responses.counters.new')} />
          <StatTile value={comparedCount} label={t('responses.counters.compared')} />
          <StatTile value={fmt(task.reward_cents)} label={t('responses.counters.budget')} />
        </div>
        {all.length > 0 && (
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <Input label={t('responses.search')} value={q} onChange={(e) => setQ(e.target.value)} type="search" />
            </div>
            <Segmented
              label={t('feed.sort')}
              value={sort}
              onChange={setSort}
              options={(['match', 'cheap', 'new'] as const).map((v) => ({ value: v, label: t(`responses.sort.${v}`) }))}
            />
            <Button variant={onlyCompared ? 'primary' : 'glass'} aria-pressed={onlyCompared} onClick={() => setOnlyCompared((v) => !v)}>
              {t('responses.compare')} · {comparedCount}
            </Button>
          </div>
        )}
        {onlyCompared && comparedCount > 1 && (
          <div className="card overflow-x-auto p-4">
            <table className="w-full min-w-[480px] text-left text-callout">
              <caption className="pb-2 text-left font-bold">{t('responses.compareTitle')}</caption>
              <thead>
                <tr className="text-caption text-text-2">
                  <th className="py-1 font-semibold" />
                  <th className="py-1 font-semibold">{t('respond.price')}</th>
                  <th className="py-1 font-semibold">{t('respond.deadline')}</th>
                  <th className="py-1 font-semibold">★</th>
                  <th className="py-1 font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-t border-separator">
                    <td className="py-2 font-bold">{shortName(r.first_name, r.last_name)}</td>
                    <td className="tabular py-2">{fmt(r.price_cents)}</td>
                    <td className="py-2">{t(`deadline.${r.deadline}`)}</td>
                    <td className="py-2">{r.rating_avg ? Number(r.rating_avg).toFixed(1) : '—'}</td>
                    <td className="py-2">{r.match}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-body font-bold">
                        {name}
                        {!r.viewed_at && r.status === 'pending' && <span className="rounded-pill bg-accent px-2 py-0.5 text-caption text-on-accent">{t('responses.new')}</span>}
                      </p>
                      <p className="text-callout text-text-2">
                        {r.rating_avg ? `★ ${Number(r.rating_avg).toFixed(1)} · ` : `${t('responses.noRating')} · `}
                        {t('responses.completed', { n: r.completed_count })}
                      </p>
                    </div>
                    <span className={clsx('shrink-0 rounded-pill px-2.5 py-1 text-caption font-bold', r.match >= 70 ? 'bg-success/15 text-success' : 'bg-fill text-text-2')}>
                      {t('responses.match', { n: r.match })}
                    </span>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 rounded-md bg-fill p-3 text-center">
                    <div>
                      <dt className="text-caption text-text-2">{t('respond.price')}</dt>
                      <dd className="tabular text-title3 font-extrabold text-accent-text">{fmt(r.price_cents)}</dd>
                      {diff !== 0 && (
                        <dd className="tabular text-caption text-text-2">
                          {diff > 0 ? '+' : '−'}
                          {fmt(Math.abs(diff))}
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
                        <span key={s} className="rounded-pill bg-fill px-3 py-1 text-caption text-text-2">
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
                  {r.video_url && (
                    <a href={r.video_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 text-callout font-semibold text-accent-text">
                      <Video size={14} aria-hidden /> {t('responses.video')}
                    </a>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/u/${r.username ?? r.executor_id}`} className="text-callout font-bold text-accent-text">
                      {t('responses.openProfile')}
                    </Link>
                    {r.status === 'pending' && (
                      <button
                        type="button"
                        aria-pressed={r.compared}
                        onClick={() => compare.mutate({ id: r.id, on: !r.compared })}
                        className="ml-auto text-callout font-bold text-text-2"
                      >
                        {r.compared ? t('responses.compareRemove') : t('responses.compareAdd')}
                      </button>
                    )}
                  </div>
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
                  price: fmt(picked.price_cents),
                  deadline: t(`deadline.${picked.deadline}`),
                })}
              </p>
              {delta(picked) > 0 && <p className="font-semibold text-text">{t('responses.diffUp', { v: fmt(delta(picked)) })}</p>}
              {delta(picked) < 0 && <p className="font-semibold text-text">{t('responses.diffDown', { v: fmt(-delta(picked)) })}</p>}
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
