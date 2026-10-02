'use client';

import { displayStatus, formatDateTime, formatMoney, formatTimeLeft, t, tasks, type MyTask, type TranslationKey } from '@parri/shared';
import { keys, useApiMutation, useMyTasks } from '@parri/shared/react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { LinkButton } from '@/components/ui/LinkButton';
import { CenterSpinner, EmptyState, PageTitle, StatusBadge } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';

type Role = 'executor' | 'customer';

function Row({ task, role }: { task: MyTask; role: Role }) {
  const toast = useToast();
  const status = displayStatus(task);
  const republish = useApiMutation((sb) => tasks.republish(sb, task.id), {
    invalidate: () => [keys.mine('customer'), keys.me, ['feed']],
    onSuccess: () => toast(t('task.republished')),
  });
  const expired = task.expired || task.archive_reason === 'expired';

  return (
    <li className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
      <Link href={`/tasks/${task.id}`} className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          {role === 'executor' && task.my_response_status && task.my_response_status !== 'accepted' && (
            <span className="text-caption text-text-2">{t(`responseStatus.${task.my_response_status}` as TranslationKey)}</span>
          )}
        </div>
        <span className="truncate text-body font-bold">{task.title}</span>
        <span className="text-callout text-text-2">
          {status === 'open' && role === 'customer' && t('task.responsesCount', { n: task.response_count })}
          {['in_progress', 'review'].includes(status) && task.due_at && `${formatDateTime(task.due_at)} · ${formatTimeLeft(task.due_at)}`}
          {status === 'completed' && task.completed_at && formatDateTime(task.completed_at)}
          {status === 'archived' && t(expired ? 'task.archived_expired' : 'task.archived_cancelled')}
          {task.counterpart_name ? ` · ${task.counterpart_name}` : ''}
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <span className="tabular text-title3 font-extrabold text-accent-text">{formatMoney(task.reward_cents)}</span>
        {role === 'customer' && status === 'archived' && expired && (
          <Button variant="glass" onClick={() => republish.mutate(undefined)} disabled={republish.isPending}>
            {t('task.republish')}
          </Button>
        )}
      </div>
      {republish.error && <p className="text-callout font-semibold text-danger">{t(republish.error.key as TranslationKey)}</p>}
    </li>
  );
}

const ORDER = ['review', 'in_progress', 'disputed', 'open', 'completed', 'archived'];

export default function MyTasksPage() {
  const [role, setRole] = useState<Role>('executor');
  const { data = [], isLoading } = useMyTasks(role);
  const sorted = [...data].sort((a, b) => ORDER.indexOf(displayStatus(a)) - ORDER.indexOf(displayStatus(b)));

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
          onChange={setRole}
          options={[
            { value: 'executor', label: t('my.doing') },
            { value: 'customer', label: t('my.mine') },
          ]}
        />
        {isLoading ? (
          <CenterSpinner />
        ) : sorted.length === 0 ? (
          <EmptyState
            title={role === 'executor' ? t('my.emptyDoing') : t('my.emptyMine')}
            action={
              role === 'executor' ? <LinkButton href="/feed">{t('my.findTasks')}</LinkButton> : <LinkButton href="/tasks/new">{t('my.create')}</LinkButton>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3" data-testid="my-tasks">
            {sorted.map((task) => (
              <Row key={task.id} task={task} role={role} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
