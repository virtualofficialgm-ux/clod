'use client';

import {
  fieldErrors,
  files as filesApi,
  formatMoney,
  reviewSchema,
  submissionSchema,
  t,
  work,
  type FileRef,
  type Submission,
  type Task,
} from '@parri/shared';
import { keys, useApiMutation, useMe } from '@parri/shared/react';
import { Check, Paperclip, X } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { FormError, Input, TextArea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

const invalidateTask = (id: string) => [keys.task(id), keys.messages(id), ['my-tasks'], keys.me];

/** Сдача работы исполнителем: ссылка, файлы, комментарий → новая версия результата */
export function SubmitSheet({ open, onClose, task }: { open: boolean; onClose: () => void; task: Task }) {
  const me = useMe();
  const toast = useToast();
  const [link, setLink] = useState('');
  const [comment, setComment] = useState('');
  const [list, setList] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useApiMutation(
    async (sb, v: { link: string; comment: string; files: File[] }) => {
      const refs: FileRef[] = [];
      for (const f of v.files) {
        const path = filesApi.path(me.data!.profile.id, task.id, 'submission', f.name, crypto.randomUUID());
        await filesApi.upload(sb, path, f, f.type || 'application/octet-stream');
        refs.push({ path, name: f.name, size: f.size, mime: f.type || 'application/octet-stream' });
      }
      return work.submit(sb, task.id, { link: v.link, comment: v.comment, files: refs });
    },
    {
      invalidate: () => invalidateTask(task.id),
      onSuccess: () => {
        toast(t('submit.sent'));
        onClose();
      },
    },
  );

  const submit = () => {
    const parsed = submissionSchema.safeParse({ link: link.trim(), comment, fileCount: list.length });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    mutation.mutate({ link: parsed.data.link, comment: parsed.data.comment, files: list });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('submit.title')}
      footer={
        <div className="flex flex-col gap-3">
          <FormError error={mutation.error?.key} />
          <Button size="lg" block onClick={submit} disabled={mutation.isPending}>
            {t('submit.send')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <Input label={t('submit.link')} type="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} error={errors.link} />
        <TextArea label={t('submit.comment')} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000} counterMax={2000} />
        <div className="flex flex-col gap-2">
          <span className="text-callout font-bold">{t('submit.files')}</span>
          {list.map((f, i) => (
            <div key={i} className="card flex items-center justify-between gap-3 px-4 py-3">
              <span className="truncate font-semibold">{f.name}</span>
              <button type="button" aria-label={t('common.remove')} onClick={() => setList(list.filter((_, j) => j !== i))}>
                <X size={18} />
              </button>
            </div>
          ))}
          <label className="glass inline-flex h-12 w-fit cursor-pointer items-center gap-2 rounded-pill px-6 font-bold">
            <Paperclip size={18} strokeWidth={2.4} />
            {t('create.attach')}
            <input
              type="file"
              multiple
              className="sr-only"
              onChange={(e) => {
                setList((p) => [...p, ...Array.from(e.target.files ?? [])].slice(0, 10));
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>
    </BottomSheet>
  );
}

/** Приёмка: чек-лист → принять и оплатить / доработка / спор (с причиной) */
export function ReviewSheet({ open, onClose, task, submission }: { open: boolean; onClose: () => void; task: Task; submission: Submission }) {
  const toast = useToast();
  const [checked, setChecked] = useState<boolean[]>(task.checklist.map(() => false));
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useApiMutation(
    (sb, v: { decision: 'accept' | 'revision' | 'dispute'; checklist: boolean[]; comment: string }) => work.review(sb, submission.id, v),
    {
      invalidate: () => invalidateTask(task.id),
      onSuccess: (_r, v) => {
        toast(t(v.decision === 'accept' ? 'review.accepted' : v.decision === 'revision' ? 'review.revisionSent' : 'review.disputeOpened'));
        onClose();
      },
    },
  );

  const decide = (decision: 'accept' | 'revision' | 'dispute') => {
    const parsed = reviewSchema.safeParse({ decision, checklist: checked, comment });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    mutation.mutate(parsed.data);
  };

  const allChecked = checked.every(Boolean);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('review.title')}
      footer={
        <div className="flex flex-col gap-3">
          <FormError error={mutation.error?.key ?? errors.checklist} />
          <Button size="lg" block onClick={() => decide('accept')} disabled={mutation.isPending || !allChecked}>
            {t('review.accept')}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="glass" block onClick={() => decide('revision')} disabled={mutation.isPending}>
              {t('review.revision')}
            </Button>
            <Button variant="glass" block onClick={() => decide('dispute')} disabled={mutation.isPending}>
              {t('review.dispute')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        {task.checklist.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-callout font-bold">{t('review.checklistTitle')}</legend>
            {task.checklist.map((item, i) => (
              <label
                key={i}
                className={clsx(
                  'card flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors',
                  checked[i] && 'border-success/40',
                )}
              >
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={checked[i] ?? false}
                  onChange={(e) => setChecked(checked.map((c, j) => (j === i ? e.target.checked : c)))}
                />
                <span
                  aria-hidden
                  className={clsx(
                    'flex size-6 shrink-0 items-center justify-center rounded-sm border-2 peer-focus-visible:ring-4 peer-focus-visible:ring-accent/30',
                    checked[i] ? 'border-success bg-success text-white' : 'border-text-3',
                  )}
                >
                  {checked[i] && <Check size={16} strokeWidth={3} />}
                </span>
                <span className="font-semibold">{item}</span>
              </label>
            ))}
          </fieldset>
        )}
        <p className="text-callout text-text-2">{t('review.acceptHint', { v: formatMoney(task.reward_cents) })}</p>
        <TextArea
          label={t('review.reason')}
          placeholder={t('review.reasonPlaceholder')}
          hint={t('review.reasonHint')}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          error={errors.comment}
          maxLength={2000}
        />
      </div>
    </BottomSheet>
  );
}
