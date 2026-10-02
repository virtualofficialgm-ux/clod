'use client';

import { displayStatus, formatAgo, formatMoney, t, type TranslationKey } from '@parri/shared';
import { useChats, useMe } from '@parri/shared/react';
import clsx from 'clsx';
import { MessageCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Glass } from '@/components/glass/Glass';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { LinkButton } from '@/components/ui/LinkButton';
import { Avatar, CenterSpinner, EmptyState, PageTitle, StatusBadge } from '@/components/ui/bits';

export default function MessagesPage() {
  const me = useMe();
  const chats = useChats();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const myId = me.data?.profile.id;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (chats.data ?? [])
      .filter((c) => filter === 'all' || c.unread > 0)
      .filter((c) => !q || `${c.title} ${c.counterpart_name} ${c.last_body ?? ''}`.toLowerCase().includes(q));
  }, [chats.data, query, filter]);

  return (
    <>
      <Header title={t('messages.title')} />
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle>
          {t('messages.title')}
          <span className="text-accent">.</span>
        </PageTitle>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Glass radius="pill" className="flex h-12 min-w-0 flex-1 items-center gap-2 px-4">
            <Search size={18} strokeWidth={2.4} className="shrink-0 text-text-2" aria-hidden />
            <input
              type="search"
              aria-label={t('messages.search')}
              placeholder={t('messages.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-2"
            />
          </Glass>
          <Segmented
            label={t('messages.title')}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('messages.all') },
              { value: 'unread', label: t('messages.unread') },
            ]}
          />
        </div>

        {chats.isLoading ? (
          <CenterSpinner />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<MessageCircle size={36} />}
            title={t('messages.empty')}
            text={t('messages.emptyText')}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton href="/feed">{t('messages.findTasks')}</LinkButton>
                <LinkButton href="/my-tasks" variant="glass">
                  {t('messages.myTasks')}
                </LinkButton>
              </div>
            }
          />
        ) : (
          <ul className="card divide-y divide-separator overflow-hidden p-0">
            {list.map((c) => {
              const preview =
                c.last_kind === 'system'
                  ? t(`event.${c.last_body}` as TranslationKey, { version: '' })
                  : c.last_body
                    ? (c.last_sender === myId ? t('messages.you') : '') + c.last_body
                    : t('messages.noMessages');
              return (
                <li key={c.task_id}>
                  <Link href={`/tasks/${c.task_id}/room`} className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-fill/60">
                    <Avatar name={c.counterpart_name} url={c.counterpart_avatar} size={52} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="truncate text-body font-bold">{c.counterpart_name}</p>
                        {c.last_at && <span className="shrink-0 text-caption text-text-2">{formatAgo(c.last_at)}</span>}
                      </div>
                      <p className="truncate text-callout font-semibold text-text-2">
                        {c.title} · {formatMoney(c.reward_cents)}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <p className={clsx('truncate text-callout', c.unread ? 'font-semibold text-text' : 'text-text-2')}>{preview}</p>
                        {c.unread > 0 ? (
                          <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-pill bg-accent px-2 text-caption text-on-accent">
                            {c.unread}
                          </span>
                        ) : (
                          <StatusBadge status={displayStatus(c)} />
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
