'use client';

import { analytics, displayStatus, formatMoney, t, type TaskKind, type TranslationKey } from '@parri/shared';
import { useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { CenterSpinner, PageTitle, StatusBadge } from '@/components/ui/bits';
import { Card, CardHeader, ProgressBar, StatTile } from '@/components/ui/kit';

const KIND_COLORS: Record<TaskKind, string> = { online: 'var(--p-chart-1)', nearby: 'var(--p-chart-2)', campus: 'var(--p-chart-3)' };

export default function AnalyticsPage() {
  const sb = useSupabase();
  const q = useQuery({ queryKey: ['analytics'], queryFn: () => analytics.mine(sb) });
  if (q.isLoading || !q.data) return <CenterSpinner />;
  const a = q.data;
  const max = Math.max(1, ...a.weeks.flatMap((w) => [w.created, w.completed]));
  const kindsTotal = Object.values(a.kinds).reduce((s, n) => s + (n ?? 0), 0);
  const funnelMax = Math.max(1, ...Object.values(a.funnel));
  const week = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
  return (
    <>
      <Header
        title={t('analytics.title')}
        actions={
          <Button variant="glass" size="md" onClick={() => q.refetch()} disabled={q.isFetching}>
            <RefreshCw size={16} /> {t('analytics.refresh')}
          </Button>
        }
      />
      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-5 px-[var(--p-gutter)] pt-2 md:px-8" data-testid="analytics">
        <PageTitle>
          {t('analytics.title')}
          <span className="text-accent">.</span>
        </PageTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile value={a.created} label={t('analytics.created')} />
          <StatTile value={a.taken} label={t('analytics.taken')} />
          <StatTile value={formatMoney(a.avg_budget_cents)} label={t('analytics.avgBudget')} />
          <StatTile value={`${a.success_rate}%`} label={t('analytics.success')} ring={a.success_rate / 100} />
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title={t('analytics.chart')} />
            <div className="flex h-48 items-end gap-2" role="img" aria-label={t('analytics.chart')}>
              {a.weeks.map((w) => (
                <div key={w.start} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-40 w-full items-end justify-center gap-1">
                    <span className="w-1/2 max-w-4 rounded-t-md bg-[var(--p-chart-1)]" style={{ height: `${(w.created / max) * 100}%` }} title={`${t('analytics.createdSeries')}: ${w.created}`} />
                    <span className="w-1/2 max-w-4 rounded-t-md bg-[var(--p-chart-3)]" style={{ height: `${(w.completed / max) * 100}%` }} title={`${t('analytics.completedSeries')}: ${w.completed}`} />
                  </div>
                  <span className="text-[10px] text-text-2">{week.format(new Date(w.start))}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-caption">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[var(--p-chart-1)]" /> {t('analytics.createdSeries')}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-2.5 rounded-full bg-[var(--p-chart-3)]" /> {t('analytics.completedSeries')}
              </span>
            </div>
          </Card>
          <Card className="flex flex-col gap-3">
            <CardHeader title={t('analytics.kinds')} />
            {(['online', 'nearby', 'campus'] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1">
                <span className="flex justify-between text-callout">
                  {t(`kind.${k}`)} <span className="tabular font-bold">{a.kinds[k] ?? 0}</span>
                </span>
                <ProgressBar value={kindsTotal ? (a.kinds[k] ?? 0) / kindsTotal : 0} color={KIND_COLORS[k]} label={t(`kind.${k}`)} />
              </div>
            ))}
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader title={t('analytics.income')} />
            <p className="tabular text-title2 font-extrabold">{formatMoney(a.income_usd_cents)}</p>
            <p className="tabular text-callout text-text-2">{formatMoney(a.income_usdt_cents, 'ru-RU', { currency: 'USDT' })}</p>
          </Card>
          <Card>
            <CardHeader title={t('analytics.categories')} />
            <ul className="flex flex-col gap-1.5">
              {a.categories.map((c) => (
                <li key={c.category} className="flex justify-between text-callout">
                  {t(`category.${c.category}` as TranslationKey)} <span className="tabular font-bold">{c.n}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="flex flex-col gap-2">
            <CardHeader title={t('analytics.funnel')} />
            {(['open', 'in_progress', 'review', 'completed'] as const).map((k) => (
              <div key={k} className="flex flex-col gap-1">
                <span className="flex justify-between text-callout">
                  {t(`analytics.funnelSteps.${k}`)} <span className="tabular font-bold">{a.funnel[k]}</span>
                </span>
                <ProgressBar value={a.funnel[k] / funnelMax} label={t(`analytics.funnelSteps.${k}`)} />
              </div>
            ))}
          </Card>
        </div>
        <Card>
          <CardHeader
            title={t('analytics.recent')}
            action={
              <Link href="/my-tasks" className="text-callout font-bold text-accent-text">
                {t('analytics.allTasks')}
              </Link>
            }
          />
          <ul className="flex flex-col gap-2">
            {a.recent.map((r) => (
              <li key={r.id}>
                <Link href={`/tasks/${r.id}`} className="tile flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0 truncate font-semibold">{r.title}</span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={displayStatus({ status: r.status })} />
                    <span className="tabular font-bold">{formatMoney(r.reward_cents, 'ru-RU', { currency: r.currency })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </main>
    </>
  );
}
