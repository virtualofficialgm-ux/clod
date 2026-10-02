'use client';

import { formatDateTime, t, taskExtras, type TaskQuestion } from '@parri/shared';
import { keys, useApiMutation, useMe, useTaskDetail, useTaskQuestions } from '@parri/shared/react';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { FormError, TextArea } from '@/components/ui/Field';
import { Avatar, CenterSpinner, EmptyState } from '@/components/ui/bits';
import { Card } from '@/components/ui/kit';

function Message({ q, mine, onDelete }: { q: TaskQuestion; mine: boolean; onDelete: () => void }) {
  return (
    <div className="flex gap-3">
      <Avatar name={q.author_name} url={q.author_avatar} size={36} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2 text-callout">
          <span className="font-bold">{q.author_name}</span>
          {q.is_customer && <span className="rounded-pill bg-accent-soft px-2 py-0.5 text-caption text-accent-text">{t('questions.customer')}</span>}
          <span className="text-caption text-text-2">{formatDateTime(q.created_at)}</span>
        </p>
        <p className={q.deleted ? 'italic text-text-2' : 'whitespace-pre-line'}>{q.deleted ? t('questions.deleted') : q.body}</p>
      </div>
      {mine && !q.deleted && (
        <Button variant="plain" size="icon" aria-label={t('questions.delete')} onClick={onDelete}>
          <Trash2 size={18} />
        </Button>
      )}
    </div>
  );
}

function Composer({ taskId, parentId, placeholder, label, onDone }: { taskId: string; parentId?: string; placeholder: string; label: string; onDone?: () => void }) {
  const [body, setBody] = useState('');
  const send = useApiMutation((sb) => taskExtras.ask(sb, taskId, body, parentId), {
    invalidate: () => [keys.questions(taskId), keys.task(taskId)],
    onSuccess: () => {
      setBody('');
      onDone?.();
    },
  });
  return (
    <div className="flex flex-col gap-2">
      <TextArea label={label} placeholder={placeholder} value={body} onChange={(e) => setBody(e.target.value)} rows={2} counterMax={1000} />
      <FormError error={send.error?.key} />
      <div>
        <Button disabled={body.trim().length < 2 || send.isPending} onClick={() => send.mutate(undefined)}>
          {t('questions.publish')}
        </Button>
      </div>
    </div>
  );
}

export default function QuestionsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const d = useTaskDetail(id).data;
  const { data, isLoading } = useTaskQuestions(id);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const del = useApiMutation((sb, qid: string) => taskExtras.deleteQuestion(sb, qid), { invalidate: () => [keys.questions(id), keys.task(id)] });
  const uid = me.data?.profile.id;
  const roots = (data ?? []).filter((q) => !q.parent_id);
  const replies = (pid: string) => (data ?? []).filter((q) => q.parent_id === pid);
  const isCustomer = d?.viewer_role === 'customer';

  return (
    <>
      <Header
        title={t('questions.title')}
        leading={
          <Button variant="glass" size="icon" aria-label={t('common.back')} onClick={() => router.back()}>
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Button>
        }
      />
      <main className="mx-auto flex max-w-[760px] flex-col gap-4 px-[var(--p-gutter)] pt-2 md:px-8">
        {d && <p className="text-callout text-text-2">{d.task.title}</p>}
        {!isCustomer && (
          <Card>
            <Composer taskId={id} label={t('questions.ask')} placeholder={t('questions.askPlaceholder')} />
          </Card>
        )}
        {isLoading ? (
          <CenterSpinner />
        ) : roots.length === 0 ? (
          <EmptyState title={t('questions.empty')} />
        ) : (
          roots.map((q) => (
            <Card key={q.id} className="flex flex-col gap-4" data-testid="question">
              <Message q={q} mine={q.author_id === uid} onDelete={() => del.mutate(q.id)} />
              {replies(q.id).map((r) => (
                <div key={r.id} className="ml-6 border-l-2 border-fill pl-4">
                  <Message q={r} mine={r.author_id === uid} onDelete={() => del.mutate(r.id)} />
                </div>
              ))}
              {(isCustomer || q.author_id === uid) &&
                !q.deleted &&
                (replyTo === q.id ? (
                  <div className="ml-6 flex flex-col gap-2">
                    <Composer taskId={id} parentId={q.id} label={t('questions.answer')} placeholder={t('questions.answerPlaceholder')} onDone={() => setReplyTo(null)} />
                    <Button variant="plain" onClick={() => setReplyTo(null)}>
                      {t('questions.cancelAnswer')}
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Button variant="glass" size="md" onClick={() => setReplyTo(q.id)}>
                      {t('questions.answer')}
                    </Button>
                  </div>
                ))}
            </Card>
          ))
        )}
      </main>
    </>
  );
}
