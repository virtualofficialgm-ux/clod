'use client';

import {
  displayStatus,
  formatDateTime,
  formatMoney,
  formatTimeLeft,
  t,
  taskExtras,
  tasks,
  type MyTask,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation, useMyTasks, useSupabase, useTaskDrafts } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { categoryIcon } from '@/components/task/categoryIcon';
import { LinkButton } from '@/components/ui/LinkButton';
import { CenterSpinner, EmptyState, PageTitle, StatusBadge } from '@/components/ui/bits';
import { StatTile } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

type Role = 'executor' | 'customer';
type Tab =
  'active' | 'responses' | 'review' | 'done' | 'archive' | 'choosing' | 'inwork' | 'drafts';
type Sort = 'new' | 'deadline' | 'pay';

const TABS: Record<Role, Tab[]> = {
  executor: ['active', 'responses', 'review', 'done', 'archive'],
  customer: ['choosing', 'inwork', 'review', 'done', 'archive', 'drafts'],
};

function tabOf(task: MyTask, role: Role): Tab {
  const s = displayStatus(task);
  if (s === 'review') return 'review';
  if (s === 'completed') return 'done';
  if (s === 'archived') return 'archive';
  if (role === 'executor') return s === 'open' ? 'responses' : 'active';
  return s === 'open' ? 'choosing' : 'inwork';
}

/** Следующее действие по задаче: куда ведёт главная кнопка */
function nextAction(task: MyTask, role: Role): { label: TranslationKey; href: string } | null {
  const s = displayStatus(task);
  const page = `/tasks/${task.id}`;
  const roomHref = `${page}/room`;
  if (role === 'executor') {
    if (s === 'in_progress' && !task.started_at) return { label: 'my.actions.start', href: page };
    if (s === 'in_progress' || s === 'disputed')
      return { label: 'my.actions.continue', href: roomHref };
    if (s === 'review') return { label: 'my.actions.chat', href: roomHref };
    if (s === 'completed' && !task.reviewed) return { label: 'my.actions.review', href: page };
    return { label: 'my.actions.open', href: page };
  }
  if (s === 'open') return { label: 'my.actions.responses', href: `${page}/responses` };
  if (s === 'in_progress' || s === 'disputed') return { label: 'my.actions.chat', href: roomHref };
  if (s === 'review') return { label: 'my.actions.check', href: roomHref };
  if (s === 'completed' && !task.reviewed) return { label: 'my.actions.review', href: page };
  if (s === 'completed' || s === 'archived')
    return { label: 'my.actions.repeat', href: `/tasks/new?repeat=${task.id}` };
  return null;
}

function Row({ task, role }: { task: MyTask; role: Role }) {
  const toast = useToast();
  const status = displayStatus(task);
  const Icon = categoryIcon(task.category);
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: task.currency });
  const republish = useApiMutation((sb) => tasks.republish(sb, task.id), {
    invalidate: () => [keys.mine('customer'), keys.me, ['feed']],
    onSuccess: () => toast(t('task.republished')),
  });
  const expired = task.expired || task.archive_reason === 'expired';
  const next = nextAction(task, role);
  const progress =
    task.due_at && task.assigned_at && ['in_progress', 'review'].includes(status)
      ? Math.min(
          1,
          Math.max(
            0,
            (Date.now() - new Date(task.assigned_at).getTime()) /
              (new Date(task.due_at).getTime() - new Date(task.assigned_at).getTime()),
          ),
        )
      : null;

  return (
    <li className="card flex flex-col gap-3 p-5 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] md:items-center md:gap-6">
      <Link href={`/tasks/${task.id}`} className="flex min-w-0 items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-fill">
          <Icon size={20} />
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            {role === 'customer' && task.new_responses > 0 && (
              <span className="rounded-pill bg-accent px-2 py-0.5 text-caption font-bold text-on-accent">
                {t('my.newResponses', { n: task.new_responses })}
              </span>
            )}
            {role === 'executor' &&
              task.my_response_status &&
              task.my_response_status !== 'accepted' && (
                <span className="text-caption text-text-2">
                  {t(`responseStatus.${task.my_response_status}` as TranslationKey)}
                </span>
              )}
          </span>
          <span className="truncate text-body font-bold">{task.title}</span>
          <span className="text-callout text-text-2">
            {status === 'open' &&
              role === 'customer' &&
              t('task.responsesCount', { n: task.response_count })}
            {status === 'completed' && task.completed_at && formatDateTime(task.completed_at)}
            {status === 'archived' &&
              t(expired ? 'task.archived_expired' : 'task.archived_cancelled')}
            {task.counterpart_name
              ? `${status === 'in_progress' || status === 'review' ? '' : ' · '}${task.counterpart_name}`
              : ''}
          </span>
        </span>
      </Link>
      <div className="flex flex-col gap-1.5">
        {progress != null && (
          <>
            <div
              className="h-1.5 overflow-hidden rounded-pill bg-fill"
              role="progressbar"
              aria-label={t('my.cols.progress')}
              aria-valuenow={Math.round(progress * 100)}
            >
              <div
                className="h-full rounded-pill bg-accent"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="text-caption text-text-2">
              {formatDateTime(task.due_at!)} · {formatTimeLeft(task.due_at!)}
            </span>
          </>
        )}
        <span className="tabular text-title3 font-extrabold">{fmt(task.reward_cents)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {next && (
          <LinkButton
            href={next.href}
            size="md"
            variant={
              ['my.actions.open', 'my.actions.repeat'].includes(next.label) ? 'glass' : 'primary'
            }
          >
            {t(next.label)}
          </LinkButton>
        )}
        {role === 'customer' && status === 'archived' && expired && (
          <Button
            variant="glass"
            size="md"
            onClick={() => republish.mutate(undefined)}
            disabled={republish.isPending}
          >
            {t('task.republish')}
          </Button>
        )}
      </div>
      {republish.error && (
        <p className="text-callout font-semibold text-danger">
          {t(republish.error.key as TranslationKey)}
        </p>
      )}
    </li>
  );
}

function Drafts() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const { data = [], isLoading } = useTaskDrafts();
  if (isLoading) return <CenterSpinner />;
  if (!data.length)
    return (
      <EmptyState
        title={t('my.emptyTab')}
        action={<LinkButton href="/tasks/new">{t('my.create')}</LinkButton>}
      />
    );
  return (
    <ul className="flex flex-col gap-3">
      {data.map((d) => (
        <li key={d.id} className="card flex items-center gap-3 p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-fill">
            <FileText size={20} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate font-bold">
              {String(d.data.title || '') || t('my.draftUntitled')}
            </span>
            <span className="text-caption text-text-2">{formatDateTime(d.updated_at)}</span>
          </span>
          <LinkButton href={`/tasks/new?draft=${d.id}`} size="md">
            {t('my.actions.edit')}
          </LinkButton>
          <Button
            variant="plain"
            size="icon"
            aria-label={t('create.draftDelete')}
            onClick={() =>
              taskExtras
                .deleteDraft(sb, d.id)
                .then(() => qc.invalidateQueries({ queryKey: keys.drafts }))
            }
          >
            <Trash2 size={18} />
          </Button>
        </li>
      ))}
    </ul>
  );
}

export default function MyTasksPage() {
  const [role, setRole] = useState<Role>('executor');
  const [tab, setTab] = useState<Tab>('active');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('new');
  const { data = [], isLoading } = useMyTasks(role);
  const drafts = useTaskDrafts(role === 'customer');

  const counts = useMemo(() => {
    const c: Partial<Record<Tab, number>> = {};
    for (const x of data) c[tabOf(x, role)] = (c[tabOf(x, role)] ?? 0) + 1;
    c.drafts = drafts.data?.length ?? 0;
    return c;
  }, [data, role, drafts.data]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = data.filter(
      (x) =>
        tabOf(x, role) === tab &&
        (!needle ||
          x.title.toLowerCase().includes(needle) ||
          (x.counterpart_name ?? '').toLowerCase().includes(needle)),
    );
    const by: Record<Sort, (a: MyTask, b: MyTask) => number> = {
      new: (a, b) => b.published_at.localeCompare(a.published_at),
      deadline: (a, b) => (a.due_at ?? a.expires_at).localeCompare(b.due_at ?? b.expires_at),
      pay: (a, b) => b.reward_cents - a.reward_cents,
    };
    return [...list].sort(by[sort]);
  }, [data, role, tab, q, sort]);

  const activeSum = data
    .filter(
      (x) =>
        ['open', 'in_progress', 'review', 'disputed'].includes(displayStatus(x)) &&
        (role === 'customer' || displayStatus(x) !== 'open'),
    )
    .reduce((acc, x) => acc + x.reward_cents, 0);
  const weekAgo = Date.now() - 7 * 86400_000;
  const doneWeek = data.filter(
    (x) => x.completed_at && new Date(x.completed_at).getTime() > weekAgo,
  ).length;

  const switchRole = (r: Role) => {
    setRole(r);
    setTab(TABS[r][0]!);
  };

  return (
    <>
      <Header title={t('my.title')} />
      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-6 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle>
          {t('my.title')}
          <span className="text-accent">.</span>
        </PageTitle>
        <Segmented<Role>
          label={t('my.title')}
          value={role}
          onChange={switchRole}
          options={[
            { value: 'executor', label: t('my.doing') },
            { value: 'customer', label: t('my.mine') },
          ]}
        />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile
            value={formatMoney(activeSum, 'ru-RU', { compact: true })}
            label={t('my.stats.reserved')}
          />
          <StatTile
            value={(counts.active ?? 0) + (counts.inwork ?? 0) + (counts.review ?? 0)}
            label={t('my.tabs.inwork')}
          />
          <StatTile value={counts.done ?? 0} label={t('my.tabs.done')} />
          <StatTile value={doneWeek} label={t('my.stats.week')} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={t('my.title')}>
          {TABS[role].map((x) => (
            <Chip key={x} selected={tab === x} onClick={() => setTab(x)}>
              {t(`my.tabs.${x}`)} · {counts[x] ?? 0}
            </Chip>
          ))}
        </div>
        {tab !== 'drafts' && (
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="flex h-12 flex-1 items-center gap-2 rounded-pill bg-fill px-4">
              <Search size={18} className="text-text-2" aria-hidden />
              <input
                type="search"
                aria-label={t('my.search')}
                placeholder={t('my.search')}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="h-full flex-1 bg-transparent text-body outline-none placeholder:text-text-2"
              />
            </label>
            <Segmented<Sort>
              label={t('feed.sort')}
              value={sort}
              onChange={setSort}
              options={(['new', 'deadline', 'pay'] as const).map((v) => ({
                value: v,
                label: t(`my.sort.${v}`),
              }))}
            />
          </div>
        )}
        {tab === 'drafts' ? (
          <Drafts />
        ) : isLoading ? (
          <CenterSpinner />
        ) : data.length === 0 ? (
          <EmptyState
            title={role === 'executor' ? t('my.emptyDoing') : t('my.emptyMine')}
            action={
              role === 'executor' ? (
                <LinkButton href="/feed">{t('my.findTasks')}</LinkButton>
              ) : (
                <LinkButton href="/tasks/new">{t('my.create')}</LinkButton>
              )
            }
          />
        ) : shown.length === 0 ? (
          <EmptyState title={t('my.emptyTab')} />
        ) : (
          <ul className="flex flex-col gap-3" data-testid="my-tasks">
            {shown.map((task) => (
              <Row key={task.id} task={task} role={role} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
