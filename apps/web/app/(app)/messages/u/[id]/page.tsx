'use client';

import { direct, formatAgo, formatDateTime, isOnline, t, type TranslationKey } from '@parri/shared';
import {
  keys,
  useApiMutation,
  useDirect,
  useMe,
  usePeerState,
  usePublicProfile,
  useSupabase,
  useTypingPing,
} from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowUp, CheckCheck, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Glass } from '@/components/glass/Glass';
import { Header } from '@/components/glass/Header';
import { Avatar, CenterSpinner, EmptyState } from '@/components/ui/bits';

export default function DirectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sb = useSupabase();
  const qc = useQueryClient();
  const me = useMe();
  const peer = usePublicProfile(id);
  const msgs = useDirect(id);
  const where = useMemo(() => ({ peerId: id }), [id]);
  const state = usePeerState(where);
  const ping = useTypingPing(where);
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const count = msgs.data?.length ?? 0;
  const uid = me.data?.profile.id;

  useEffect(() => {
    if (!count) return;
    direct
      .markRead(sb, id)
      .then(() =>
        Promise.all([
          qc.invalidateQueries({ queryKey: keys.directThreads }),
          qc.invalidateQueries({ queryKey: ['notifications'] }),
        ]),
      )
      .catch(() => undefined);
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [count, sb, id, qc]);

  const send = useApiMutation((s, body: string) => direct.send(s, id, body), {
    invalidate: () => [keys.direct(id), keys.directThreads],
    onSuccess: () => setText(''),
  });

  if (peer.isLoading) return <CenterSpinner />;
  const p = peer.data;
  if (!p || p.private) {
    return (
      <main className="mx-auto max-w-[760px] px-[var(--p-gutter)] pt-8 md:px-8">
        <EmptyState title={t('profile.notFound')} />
      </main>
    );
  }
  const online = isOnline(state?.last_seen_at ?? p.last_seen_at);
  const status = state?.typing
    ? t('direct.typing')
    : online
      ? t('profile.online')
      : p.last_seen_at
        ? t('profile.lastSeen', { ago: formatAgo(p.last_seen_at) })
        : '';
  const lastMine = [...(msgs.data ?? [])].reverse().find((m) => m.sender_id === uid);
  const canWrite = p.relation.can_message || (msgs.data ?? []).some((m) => m.sender_id === p.id);

  return (
    <>
      <Header
        title={p.name}
        leading={
          <Button
            variant="glass"
            size="icon"
            aria-label={t('common.back')}
            onClick={() => router.push('/messages')}
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Button>
        }
      />
      <main className="mx-auto flex max-w-[760px] flex-col gap-4 px-[var(--p-gutter)] pb-40 pt-2 md:px-8 md:pb-28">
        <Link href={`/u/${p.username ?? p.id}`} className="card flex items-center gap-3 p-4">
          <Avatar name={p.name} url={p.avatar_url} size={48} />
          <span className="min-w-0">
            <span className="block truncate font-bold">{p.name}</span>
            <span
              className={clsx(
                'block text-caption',
                state?.typing || online ? 'text-success' : 'text-text-2',
              )}
              data-testid="peer-status"
            >
              {status}
            </span>
          </span>
        </Link>
        <section aria-live="polite" className="flex flex-col gap-3" data-testid="direct-messages">
          {msgs.isLoading ? (
            <CenterSpinner />
          ) : (
            (msgs.data ?? []).map((m) => {
              const mine = m.sender_id === uid;
              return (
                <div
                  key={m.id}
                  className={clsx('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}
                >
                  <div
                    className={clsx(
                      'max-w-[85%] rounded-[22px] px-4 py-2.5',
                      mine ? 'rounded-br-md bg-accent text-on-accent' : 'card rounded-bl-md',
                    )}
                  >
                    <p className="whitespace-pre-line break-words">{m.body}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 text-caption text-text-2">
                    {formatDateTime(m.created_at)}
                    {mine && m.id === lastMine?.id && (
                      <span
                        className={clsx(
                          'inline-flex items-center gap-0.5',
                          m.read_at && 'text-accent-text',
                        )}
                      >
                        · <CheckCheck size={14} aria-hidden />{' '}
                        {m.read_at ? t('room.read') : t('room.delivered')}
                      </span>
                    )}
                  </span>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </section>
      </main>
      <div className="fixed inset-x-0 bottom-[92px] z-30 px-[var(--p-gutter)] md:bottom-4 md:pl-[calc(var(--p-sidebar-width)+16px)]">
        <div className="mx-auto max-w-[760px] md:px-8">
          {canWrite ? (
            <Glass
              as="form"
              radius="2xl"
              className="flex items-end gap-2 p-2"
              onSubmit={(e: React.FormEvent) => {
                e.preventDefault();
                if (text.trim()) send.mutate(text.trim());
              }}
            >
              <textarea
                aria-label={t('direct.placeholder')}
                placeholder={t('direct.placeholder')}
                rows={1}
                value={text}
                maxLength={4000}
                onChange={(e) => {
                  setText(e.target.value);
                  ping();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (text.trim()) send.mutate(text.trim());
                  }
                }}
                className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 outline-none placeholder:text-text-2"
              />
              <Button
                type="submit"
                size="icon"
                aria-label={t('common.send')}
                disabled={send.isPending || !text.trim()}
              >
                <ArrowUp size={20} strokeWidth={2.8} />
              </Button>
            </Glass>
          ) : (
            <Glass
              radius="pill"
              className="px-5 py-3 text-center text-callout font-semibold text-text-2"
            >
              {t('direct.forbidden')}
            </Glass>
          )}
          {send.error && (
            <p className="mt-2 text-center text-callout font-semibold text-danger">
              {t(send.error.key as TranslationKey)}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
