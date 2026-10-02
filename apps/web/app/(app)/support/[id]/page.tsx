'use client';

import {
  formatDateTime,
  privateDocs,
  support,
  t,
  type FileRef,
  type TranslationKey,
} from '@parri/shared';
import { useApiMutation, useMe, useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowUp, ChevronLeft, Paperclip } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { FormError } from '@/components/ui/Field';
import { CenterSpinner, EmptyState } from '@/components/ui/bits';
import { Card } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

function FileLink({ f }: { f: FileRef }) {
  const sb = useSupabase();
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-callout font-semibold underline"
      onClick={async () => window.open(await privateDocs.signedUrl(sb, f.path), '_blank')}
    >
      <Paperclip size={14} /> {f.name}
    </button>
  );
}

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sb = useSupabase();
  const me = useMe();
  const toast = useToast();
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const ticket = useQuery({ queryKey: ['ticket', id], queryFn: () => support.ticket(sb, id) });
  const msgs = useQuery({
    queryKey: ['ticket-messages', id],
    queryFn: () => support.messages(sb, id),
    refetchInterval: 8000,
  });
  const staff = me.data?.profile.role === 'admin' || me.data?.profile.role === 'moderator';
  const [internal, setInternal] = useState(false);
  const reply = useApiMutation(
    async (s) => {
      const refs: FileRef[] = [];
      if (file) {
        const path = privateDocs.path(
          me.data!.profile.id,
          'support',
          file.name,
          crypto.randomUUID(),
        );
        await privateDocs.upload(s, path, file, file.type || 'application/octet-stream');
        refs.push({
          path,
          name: file.name,
          size: file.size,
          mime: file.type || 'application/octet-stream',
        });
      }
      return support.reply(s, id, text.trim(), refs, internal);
    },
    {
      invalidate: () => [['ticket-messages', id], ['ticket', id], ['tickets']],
      onSuccess: () => {
        setText('');
        setFile(null);
      },
    },
  );
  const resolve = useApiMutation((s) => support.setStatus(s, id, 'resolved'), {
    invalidate: () => [['ticket', id], ['tickets']],
    onSuccess: () => toast(t('common.done')),
  });
  if (ticket.isLoading) return <CenterSpinner />;
  const tk = ticket.data;
  if (!tk) return <EmptyState title={t('profile.notFound')} />;
  return (
    <>
      <Header
        title={tk.subject}
        leading={
          <Button
            variant="glass"
            size="icon"
            aria-label={t('common.back')}
            onClick={() =>
              router.push(
                staff && tk.user_id !== me.data?.profile.id ? '/admin?tab=support' : '/support',
              )
            }
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Button>
        }
      />
      <main className="mx-auto flex max-w-[760px] flex-col gap-4 px-[var(--p-gutter)] pt-2 md:px-8">
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-title3 font-extrabold">{tk.subject}</h1>
            <p className="text-caption text-text-2">
              {t(`support.categories.${tk.category}`)} · {formatDateTime(tk.created_at)}
            </p>
          </div>
          <span
            className="rounded-pill bg-fill px-3 py-1 text-caption font-bold"
            data-testid="ticket-status"
          >
            {t(`support.status.${tk.status}`)}
          </span>
        </Card>
        <ul className="flex flex-col gap-3" data-testid="ticket-messages">
          {(msgs.data ?? []).map((m) => {
            const mine = m.author_id === me.data?.profile.id;
            return (
              <li
                key={m.id}
                className={clsx('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}
              >
                <span className="px-2 text-caption text-text-2">
                  {m.internal
                    ? t('support.internal')
                    : m.from_staff
                      ? t('support.team')
                      : mine
                        ? t('support.you')
                        : ''}{' '}
                  · {formatDateTime(m.created_at)}
                </span>
                <div
                  className={clsx(
                    'max-w-[85%] rounded-[22px] px-4 py-2.5',
                    m.internal ? 'bg-warning/15' : mine ? 'bg-accent text-on-accent' : 'card',
                  )}
                >
                  <p className="whitespace-pre-line break-words">{m.body}</p>
                  {m.files.map((f) => (
                    <FileLink key={f.path} f={f} />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
        {tk.status !== 'closed' && (
          <Card className="flex flex-col gap-2">
            <textarea
              aria-label={t('support.replyPlaceholder')}
              placeholder={t('support.replyPlaceholder')}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              maxLength={4000}
              className="w-full resize-none rounded-lg bg-fill px-4 py-3 outline-none"
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-pill bg-fill px-4 text-callout font-bold">
                <Paperclip size={16} /> {file ? file.name : t('support.attach')}
                <input
                  type="file"
                  className="sr-only"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {staff && (
                <label className="inline-flex items-center gap-2 text-callout">
                  <input
                    type="checkbox"
                    checked={internal}
                    onChange={(e) => setInternal(e.target.checked)}
                  />{' '}
                  {t('support.internal')}
                </label>
              )}
              <div className="ml-auto flex gap-2">
                {!staff && ['open', 'waiting'].includes(tk.status) && (
                  <Button variant="glass" size="md" onClick={() => resolve.mutate(undefined)}>
                    {t('support.markResolved')}
                  </Button>
                )}
                <Button
                  size="md"
                  disabled={!text.trim() || reply.isPending}
                  onClick={() => reply.mutate(undefined)}
                >
                  <ArrowUp size={18} /> {t('support.reply')}
                </Button>
              </div>
            </div>
            <FormError error={reply.error?.key as TranslationKey | undefined} />
          </Card>
        )}
      </main>
    </>
  );
}
