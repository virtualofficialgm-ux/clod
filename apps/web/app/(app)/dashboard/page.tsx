'use client';

import {
  ACTIVE_STATUSES,
  deadlineDays,
  earnedThisMonth,
  formatAgo,
  formatMoney,
  formatTimeLeft,
  profileCompleteness,
  t,
  type TranslationKey,
} from '@parri/shared';
import { useFeed, useLedger, useMe, useMyTasks } from '@parri/shared/react';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Briefcase, Plus, Search, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Segmented } from '@/components/glass/Segmented';
import { TaskCard } from '@/components/task/TaskCard';
import { StatusBadge } from '@/components/ui/bits';
import { BigNumber, Card, CardHeader, ListRow, ProgressBar, ProgressRing, QuickAction, StatTile, WeekStrip, dayKey } from '@/components/ui/kit';

export default function DashboardPage() {
  const me = useMe();
  const asExecutor = useMyTasks('executor');
  const asCustomer = useMyTasks('customer');
  const ledger = useLedger();
  const feed = useFeed({ kind: 'online', sort: 'recommended' }, null);
  const [role, setRole] = useState<'executor' | 'customer'>('executor');
  const [day, setDay] = useState(() => dayKey(new Date()));

  const wallet = me.data?.wallet;
  const available = wallet?.available_cents ?? 0;
  const reserved = wallet?.safe_cents ?? 0;
  const all = useMemo(() => [...(asExecutor.data ?? []), ...(asCustomer.data ?? [])], [asExecutor.data, asCustomer.data]);
  const days = useMemo(() => deadlineDays(all), [all]);
  const active = (role === 'executor' ? asExecutor.data : asCustomer.data)?.filter((x) => ACTIVE_STATUSES.has(x.status)) ?? [];
  const activeCount = all.filter((x) => ACTIVE_STATUSES.has(x.status)).length;
  const earned = earnedThisMonth(ledger.data ?? []);
  const completeness = profileCompleteness(me.data);
  const firstName = me.data?.profile.first_name ?? '';
  const dayTasks = days.get(day) ?? [];

  return (
    <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-6 px-[var(--p-gutter)] pt-6 md:px-8 md:pt-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-callout font-semibold text-text-2">{new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p>
          <h1 className="text-title1 font-extrabold">
            {t('dashboard.hello', { name: firstName })}
            <span className="text-accent">.</span>
          </h1>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
        <div className="flex min-w-0 flex-col gap-6">
          <WeekStrip marks={new Set(days.keys())} selected={day} onSelect={setDay} />

          {/* Главная карточка — как карточка калорий в Cal AI: большая цифра и кольцо */}
          <Card className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-4">
              <BigNumber value={formatMoney(available)} label={t('dashboard.available')} />
              <p className="text-callout text-text-2">
                {t('dashboard.reserved')}: <span className="tabular font-bold text-text">{formatMoney(reserved)}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Link href="/balance?topup=1" className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-ink px-4 text-callout font-bold text-on-ink">
                  <Plus size={16} strokeWidth={2.8} />
                  {t('dashboard.topUp')}
                </Link>
                <Link href="/balance?withdraw=1" className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-fill px-4 text-callout font-bold">
                  <ArrowUpRight size={16} strokeWidth={2.8} />
                  {t('dashboard.withdraw')}
                </Link>
              </div>
            </div>
            <ProgressRing
              value={available + reserved ? reserved / (available + reserved) : 0}
              size={132}
              stroke={12}
              className="size-24 sm:size-[132px]"
              label={`${t('dashboard.reserved')}: ${formatMoney(reserved)}`}
            >
              <Wallet size={28} strokeWidth={2.4} className="text-accent" />
            </ProgressRing>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <StatTile
              value={activeCount}
              label={t('dashboard.inWork')}
              ring={activeCount ? Math.min(1, activeCount / 5) : 0}
              color="var(--p-chart-1)"
              icon={<Briefcase size={20} strokeWidth={2.4} />}
              href="/my-tasks"
            />
            <StatTile
              value={me.data?.profile.completed_count ?? 0}
              label={t('dashboard.done')}
              ring={Math.min(1, (me.data?.profile.completed_count ?? 0) / 10)}
              color="var(--p-chart-3)"
              icon={<CheckCircle2 size={20} strokeWidth={2.4} />}
              href="/my-tasks?tab=done"
            />
            <StatTile
              value={formatMoney(earned, 'ru-RU', { compact: true })}
              label={t('dashboard.earnedMonth')}
              ring={Math.min(1, earned / 50000)}
              color="var(--p-chart-4)"
              icon={<TrendingUp size={20} strokeWidth={2.4} />}
              href="/balance"
            />
          </div>

          <Card>
            <CardHeader
              stack
              title={t('dashboard.activeTasks')}
              action={
                <Segmented
                  label={t('dashboard.activeTasks')}
                  value={role}
                  onChange={setRole}
                  options={[
                    { value: 'executor', label: t('dashboard.iDo') },
                    { value: 'customer', label: t('dashboard.iOrder') },
                  ]}
                />
              }
            />
            {active.length === 0 ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-body text-text-2">{t('dashboard.noActive')}</p>
                <Link href={role === 'executor' ? '/feed' : '/tasks/new'} className="inline-flex h-11 items-center rounded-pill bg-accent px-5 font-bold text-on-accent">
                  {role === 'executor' ? t('dashboard.findTask') : t('dashboard.createTask')}
                </Link>
              </div>
            ) : (
              <div className="-mx-2 flex flex-col">
                {active.slice(0, 5).map((task) => (
                  <Link key={task.id} href={`/tasks/${task.id}/room`} className="flex items-center gap-3 rounded-md px-2 py-3 hover:bg-fill/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-bold">{task.title}</p>
                      <p className="text-callout text-text-2">
                        {task.due_at ? formatTimeLeft(task.due_at) : t(`deadline.${task.deadline}`)} · {task.counterpart_name}
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-body font-extrabold">{formatMoney(task.reward_cents)}</span>
                    <StatusBadge status={task.status} />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <aside className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title={t('dashboard.deadlines')} />
            {dayTasks.length === 0 ? (
              <p className="text-body text-text-2">{t('dashboard.noDeadlines')}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {dayTasks.map((task) => (
                  <li key={task.id}>
                    <Link href={`/tasks/${task.id}/room`} className="tile flex items-center justify-between gap-3 px-4 py-3">
                      <span className="truncate font-bold">{task.title}</span>
                      <span className="shrink-0 text-callout font-semibold text-accent-text">{formatTimeLeft(task.due_at!)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid grid-cols-4 gap-2">
            <QuickAction href="/tasks/new" icon={<Plus size={24} strokeWidth={2.6} />} label={t('dashboard.createTask')} />
            <QuickAction href="/feed" icon={<Search size={22} strokeWidth={2.6} />} label={t('dashboard.findTask')} />
            <QuickAction href="/balance?topup=1" icon={<ArrowDownLeft size={22} strokeWidth={2.6} />} label={t('dashboard.topUp')} />
            <QuickAction href="/balance?withdraw=1" icon={<ArrowUpRight size={22} strokeWidth={2.6} />} label={t('dashboard.withdraw')} />
          </div>

          {completeness.percent < 100 && (
            <Card className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Sparkles size={20} className="text-accent" />
                <h2 className="text-body font-bold">{t('dashboard.profileFill', { n: completeness.percent })}</h2>
              </div>
              <ProgressBar value={completeness.percent / 100} label={t('dashboard.profileFill', { n: completeness.percent })} />
              <Link href="/account/edit" className="text-callout font-bold text-accent-text">
                {t('dashboard.improveProfile')} →
              </Link>
            </Card>
          )}

          <Card className="p-0 md:p-0">
            <div className="px-5 pt-5 md:px-6 md:pt-6">
              <CardHeader title={t('dashboard.transactions')} action={<Link href="/balance" className="text-callout font-bold text-accent-text">{t('common.seeAll')}</Link>} />
            </div>
            {(ledger.data ?? []).slice(0, 4).map((e) => (
              <ListRow
                key={e.id}
                icon={e.amount_cents > 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                title={t(`ledgerKind.${e.kind}` as TranslationKey)}
                subtitle={formatAgo(e.created_at)}
                value={
                  <span className={e.amount_cents > 0 ? 'text-success' : 'text-text'}>
                    {e.amount_cents > 0 ? '+' : '−'}
                    {formatMoney(Math.abs(e.amount_cents))}
                  </span>
                }
              />
            ))}
            {!ledger.data?.length && <p className="px-6 pb-6 text-body text-text-2">—</p>}
          </Card>
        </aside>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-title3 font-bold">{t('dashboard.recommended')}</h2>
          <Link href="/feed" className="text-callout font-bold text-accent-text">
            {t('common.seeAll')}
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(feed.data?.pages.flat() ?? []).slice(0, 6).map((task) => (
            <TaskCard
              key={task.id}
              href={`/tasks/${task.id}`}
              task={{
                id: task.id,
                title: task.title,
                rewardCents: task.reward_cents,
                kind: task.kind,
                category: task.category,
                deadline: task.deadline,
                distanceM: task.distance_m ?? undefined,
                campusName: task.university_name ?? undefined,
              }}
            />
          ))}
        </div>
      </section>
    </main>
  );
}
