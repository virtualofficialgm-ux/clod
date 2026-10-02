'use client';

import {
  formatAgo,
  notificationTarget,
  notifications,
  profile as profileApi,
  t,
  type AppNotification,
} from '@parri/shared';
import { keys, useApiMutation, useMe, useNotifications } from '@parri/shared/react';
import clsx from 'clsx';
import { Bell, CheckCheck, Settings, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { Avatar, CenterSpinner, EmptyState, PageTitle } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';
import { notificationText } from '@/components/social/notificationText';

function hrefFor(n: AppNotification): string | null {
  const target = notificationTarget(n);
  if (!target) return null;
  switch (target.to) {
    case 'task':
      return `/tasks/${target.id}`;
    case 'room':
      return `/tasks/${target.id}/room`;
    case 'responses':
      return `/tasks/${target.id}/responses`;
    case 'profile':
      return `/u/${target.id}`;
    case 'direct':
      return `/messages/u/${target.id}`;
    case 'connections':
      return `/connections?tab=${target.tab}`;
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const toast = useToast();
  const me = useMe();
  const { data = [], isLoading } = useNotifications();
  const inv = () => [keys.notifications, keys.unreadNotifications];
  const markRead = useApiMutation((sb, ids?: number[]) => notifications.markRead(sb, ids), {
    invalidate: inv,
  });
  const clear = useApiMutation((sb) => notifications.clear(sb), { invalidate: inv });
  const enableSkill = useApiMutation(
    (sb) => profileApi.saveData(sb, { notify_skill_tasks: true }),
    {
      invalidate: () => [keys.me],
      onSuccess: () => toast(t('common.done')),
    },
  );
  const unread = data.filter((n) => !n.read_at).length;

  return (
    <>
      <Header title={t('notif.title')} />
      <main className="mx-auto flex max-w-[760px] flex-col gap-5 px-[var(--p-gutter)] pt-2 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PageTitle>
            {t('notif.title')}
            <span className="text-accent">.</span>
          </PageTitle>
          <div className="flex gap-2">
            <Button
              variant="glass"
              size="md"
              disabled={!unread}
              onClick={() => markRead.mutate(undefined)}
            >
              <CheckCheck size={18} /> {t('notif.readAll')}
            </Button>
            <Button
              variant="glass"
              size="icon"
              aria-label={t('notif.clearAll')}
              disabled={!data.length}
              onClick={() => clear.mutate(undefined)}
            >
              <Trash2 size={18} />
            </Button>
            <Link
              href="/settings?tab=notifications"
              aria-label={t('notif.settings')}
              className="glass flex size-12 items-center justify-center rounded-pill"
            >
              <Settings size={18} />
            </Link>
          </div>
        </div>
        {me.data && !me.data.profile.notify_skill_tasks && (
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-callout">{t('profile.skillNotifyHint')}</p>
            <Button size="md" onClick={() => enableSkill.mutate(undefined)}>
              {t('notif.enableSkill')}
            </Button>
          </div>
        )}
        {isLoading ? (
          <CenterSpinner />
        ) : data.length === 0 ? (
          <EmptyState
            icon={<Bell size={36} />}
            title={t('notif.empty')}
            text={t('notif.emptyText')}
          />
        ) : (
          <ul className="card flex flex-col p-2" data-testid="notifications">
            {data.map((n) => {
              const href = hrefFor(n);
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read_at) markRead.mutate([n.id]);
                      if (href) router.push(href);
                    }}
                    className={clsx(
                      'flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-fill',
                      !n.read_at && 'bg-accent-soft/50',
                    )}
                  >
                    <Avatar name={n.actor_name || 'Parri'} url={n.actor_avatar} size={40} />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={clsx('text-callout', !n.read_at && 'font-bold')}>
                        {notificationText(n)}
                      </span>
                      <span className="text-caption text-text-2">{formatAgo(n.created_at)}</span>
                    </span>
                    {!n.read_at && (
                      <span
                        className="mt-2 size-2.5 shrink-0 rounded-full bg-accent"
                        aria-label={t('messages.unread')}
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
