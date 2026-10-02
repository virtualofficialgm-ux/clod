'use client';

import {
  displayStatus,
  files as filesApi,
  formatDateTime,
  formatTimeLeft,
  room,
  t,
  type FileRef,
  type Message,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation, useMe, useRoomMessages, useTaskDetail } from '@parri/shared/react';
import clsx from 'clsx';
import { ArrowUp, ChevronLeft, Paperclip, X } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Glass } from '@/components/glass/Glass';
import { Header } from '@/components/glass/Header';
import { FileList } from '@/components/task/FileList';
import { ReviewSheet, SubmitSheet } from '@/components/task/WorkSheets';
import { CenterSpinner, EmptyState, StatusBadge } from '@/components/ui/bits';

const ACTIVE = ['in_progress', 'review', 'disputed'];

function Bubble({ m, mine }: { m: Message; mine: boolean }) {
  if (m.kind === 'system') {
    return (
      <p className="mx-auto max-w-md rounded-pill bg-separator px-4 py-2 text-center text-caption text-text-2">
        {t(`event.${m.body}` as TranslationKey, { version: String((m.meta?.version as number | undefined) ?? '') })}
      </p>
    );
  }
  return (
    <div className={clsx('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      <div
        className={clsx(
          'max-w-[85%] rounded-[22px] px-4 py-2.5 text-body',
          mine ? 'rounded-br-md bg-accent text-on-accent' : 'card rounded-bl-md',
        )}
      >
        {m.body && <p className="whitespace-pre-line break-words">{m.body}</p>}
      </div>
      {m.files.length > 0 && (
        <div className="w-full max-w-[85%]">
          <FileList items={m.files} />
        </div>
      )}
      <span className="px-2 text-caption text-text-2">{formatDateTime(m.created_at)}</span>
    </div>
  );
}

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const detail = useTaskDetail(id);
  const messages = useRoomMessages(id);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<File[]>([]);
  const [sheet, setSheet] = useState<null | 'submit' | 'review'>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const send = useApiMutation(
    async (sb, v: { body: string; files: File[] }) => {
      const refs: FileRef[] = [];
      for (const f of v.files) {
        const path = filesApi.path(me.data!.profile.id, id, 'chat', f.name, crypto.randomUUID());
        await filesApi.upload(sb, path, f, f.type || 'application/octet-stream');
        refs.push({ path, name: f.name, size: f.size, mime: f.type || 'application/octet-stream' });
      }
      return room.send(sb, id, v.body, refs);
    },
    {
      invalidate: () => [keys.messages(id)],
      onSuccess: () => {
        setText('');
        setPending([]);
      },
    },
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.data?.length]);

  if (detail.isLoading) return <CenterSpinner />;
  const d = detail.data;
  if (!d || !(d.viewer_role === 'customer' || d.viewer_role === 'executor') || !d.task.executor_id) {
    return (
      <main className="mx-auto max-w-[var(--p-content-max)] px-[var(--p-gutter)] pt-8 md:px-8">
        <EmptyState title={t('task.notFound')} />
      </main>
    );
  }

  const task = d.task;
  const status = displayStatus(task);
  const active = ACTIVE.includes(status);
  const latest = d.submissions[0];
  const uid = me.data?.profile.id;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() && pending.length === 0) return;
    send.mutate({ body: text.trim(), files: pending });
  };

  return (
    <>
      <Header
        title={task.title}
        leading={
          <Button variant="glass" size="icon" aria-label={t('common.back')} onClick={() => router.push(`/tasks/${id}`)}>
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Button>
        }
      />
      <main className="mx-auto flex max-w-[860px] flex-col gap-4 px-[var(--p-gutter)] pt-2 md:px-8">
        <div className="card flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
            <p className="text-caption uppercase tracking-wide text-text-2">{t('room.title')}</p>
            <h1 className="truncate text-title3 font-bold">{task.title}</h1>
            {task.due_at && active && (
              <p className="text-callout font-semibold text-text-2">
                {t('room.deadline')}: {formatDateTime(task.due_at)} · {formatTimeLeft(task.due_at)}
              </p>
            )}
          </div>
          <StatusBadge status={status} />
          {d.viewer_role === 'executor' && status === 'in_progress' && <Button onClick={() => setSheet('submit')}>{t('task.submitWork')}</Button>}
          {d.viewer_role === 'customer' && status === 'review' && latest && <Button onClick={() => setSheet('review')}>{t('task.review')}</Button>}
        </div>

        <section aria-label={t('room.title')} aria-live="polite" className="flex min-h-[40vh] flex-col gap-3 pb-40 md:pb-28">
          {messages.isLoading ? (
            <CenterSpinner />
          ) : (
            (messages.data ?? []).map((m) => <Bubble key={m.id} m={m} mine={m.sender_id === uid} />)
          )}
          <div ref={endRef} />
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-[92px] z-30 px-[var(--p-gutter)] md:bottom-4 md:pl-[calc(var(--p-sidebar-width)+16px)]">
        <div className="mx-auto max-w-[860px]">
          {active ? (
            <Glass as="form" radius="2xl" onSubmit={submit} className="flex flex-col gap-2 p-2">
              {pending.length > 0 && (
                <div className="flex flex-wrap gap-2 px-2 pt-1">
                  {pending.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-pill bg-separator px-3 py-1 text-caption">
                      {f.name}
                      <button type="button" aria-label={t('common.remove')} onClick={() => setPending(pending.filter((_, j) => j !== i))}>
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill text-text hover:bg-separator" aria-label={t('room.attach')}>
                  <Paperclip size={20} strokeWidth={2.4} />
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={(e) => {
                      setPending((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 10));
                      e.target.value = '';
                    }}
                  />
                </label>
                <textarea
                  aria-label={t('room.placeholder')}
                  placeholder={t('room.placeholder')}
                  rows={1}
                  value={text}
                  maxLength={4000}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) submit(e);
                  }}
                  className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-body outline-none placeholder:text-text-2"
                />
                <Button type="submit" size="icon" aria-label={t('common.send')} disabled={send.isPending || (!text.trim() && !pending.length)}>
                  <ArrowUp size={20} strokeWidth={2.8} />
                </Button>
              </div>
              {send.error && <p className="px-3 text-callout font-semibold text-danger">{t(send.error.key as TranslationKey)}</p>}
            </Glass>
          ) : (
            <Glass radius="pill" className="px-5 py-3 text-center text-callout font-semibold text-text-2">
              {t('room.readonly')}
            </Glass>
          )}
        </div>
      </div>

      {sheet === 'submit' && <SubmitSheet open onClose={() => setSheet(null)} task={task} />}
      {sheet === 'review' && latest && <ReviewSheet open onClose={() => setSheet(null)} task={task} submission={latest} />}
    </>
  );
}
