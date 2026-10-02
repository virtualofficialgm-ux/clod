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
import { Check, Lock, Paperclip, X } from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import { FormError, Input, TextArea } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

const invalidateTask = (id: string) => [keys.task(id), keys.messages(id), ['my-tasks'], keys.me];
const INCLUDED = ['matches_task', 'materials_attached', 'files_checked'] as const;
const MAX_FILE = 25 * 1024 * 1024;

function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={clsx(
        'tile flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors',
        checked && 'ring-2 ring-success/40',
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={clsx(
          'flex size-6 shrink-0 items-center justify-center rounded-sm border-2 peer-focus-visible:ring-4 peer-focus-visible:ring-accent/30',
          checked ? 'border-success bg-success text-white' : 'border-text-3',
        )}
      >
        {checked && <Check size={16} strokeWidth={3} />}
      </span>
      <span className="font-semibold">{children}</span>
    </label>
  );
}

/** Сдача работы: этап, описание, файлы и ссылка, «что включено», комментарий, предпросмотр */
export function SubmitSheet({
  open,
  onClose,
  task,
}: {
  open: boolean;
  onClose: () => void;
  task: Task;
}) {
  const me = useMe();
  const toast = useToast();
  const [stage, setStage] = useState<'final' | 'intermediate'>('final');
  const [link, setLink] = useState('');
  const [comment, setComment] = useState('');
  const [note, setNote] = useState('');
  const [included, setIncluded] = useState<string[]>([]);
  const [list, setList] = useState<File[]>([]);
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState<string | null>(null);

  const mutation = useApiMutation(
    async (sb, v: { link: string; comment: string; files: File[] }) => {
      const refs: FileRef[] = [];
      for (const f of v.files) {
        const path = filesApi.path(
          me.data!.profile.id,
          task.id,
          'submission',
          f.name,
          crypto.randomUUID(),
        );
        await filesApi.upload(sb, path, f, f.type || 'application/octet-stream');
        refs.push({ path, name: f.name, size: f.size, mime: f.type || 'application/octet-stream' });
      }
      return work.submit(sb, task.id, {
        link: v.link,
        comment: v.comment,
        files: refs,
        stage,
        included,
        note,
      });
    },
    {
      invalidate: () => invalidateTask(task.id),
      onSuccess: () => {
        toast(t('submit.sent'));
        onClose();
      },
    },
  );

  const validate = () => {
    const parsed = submissionSchema.safeParse({
      link: link.trim(),
      comment,
      fileCount: list.length,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return null;
    }
    if (list.some((f) => f.size > MAX_FILE)) {
      setFileError('errors.file_too_big');
      return null;
    }
    setErrors({});
    setFileError(null);
    return parsed.data;
  };
  const submit = () => {
    const v = validate();
    if (v) mutation.mutate({ link: v.link, comment: v.comment, files: list });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={preview ? t('submit.previewTitle') : t('submit.title')}
      footer={
        <div className="flex flex-col gap-3">
          <FormError error={mutation.error?.key ?? fileError} />
          <Button size="lg" block onClick={submit} disabled={mutation.isPending}>
            {t('submit.send')}
          </Button>
          <Button
            variant="glass"
            block
            onClick={() => (preview ? setPreview(false) : validate() && setPreview(true))}
          >
            {preview ? t('common.back') : t('submit.preview')}
          </Button>
          <p className="text-center text-caption text-text-2">{t('submit.reviewTime')}</p>
        </div>
      }
    >
      {preview ? (
        <div className="flex flex-col gap-3 pb-2" data-testid="submit-preview">
          <span className="w-fit rounded-pill bg-accent-soft px-3 py-1 text-caption font-bold text-accent-text">
            {t(`submit.${stage}`)}
          </span>
          {comment && <p className="whitespace-pre-line">{comment}</p>}
          {link && <p className="truncate font-semibold text-accent-text">{link}</p>}
          {list.map((f, i) => (
            <p key={i} className="tile px-4 py-2 text-callout font-semibold">
              {f.name}
            </p>
          ))}
          {included.length > 0 && (
            <ul className="flex flex-col gap-1 text-callout">
              {included.map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <Check size={16} className="text-success" />{' '}
                  {t(`submit.inc.${x as (typeof INCLUDED)[number]}`)}
                </li>
              ))}
            </ul>
          )}
          {note && (
            <p className="rounded-md bg-fill px-4 py-3 text-callout">
              <span className="font-bold">{t('submit.note')}: </span>
              {note}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-5 pb-2">
          <div className="flex flex-col gap-2">
            <span className="text-callout font-bold">{t('submit.stage')}</span>
            <Segmented
              label={t('submit.stage')}
              value={stage}
              onChange={setStage}
              options={[
                { value: 'final', label: t('submit.final') },
                { value: 'intermediate', label: t('submit.intermediate') },
              ]}
            />
          </div>
          <TextArea
            label={t('submit.description')}
            placeholder={t('submit.descriptionPlaceholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            counterMax={2000}
          />
          <div className="flex flex-col gap-2">
            <span className="text-callout font-bold">{t('submit.filesLinks')}</span>
            <Input
              label={t('submit.link')}
              type="url"
              placeholder="https://"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              error={errors.link}
            />
            {list.map((f, i) => (
              <div key={i} className="tile flex items-center justify-between gap-3 px-4 py-3">
                <span className="truncate font-semibold">{f.name}</span>
                <button
                  type="button"
                  aria-label={t('common.remove')}
                  onClick={() => setList(list.filter((_, j) => j !== i))}
                >
                  <X size={18} />
                </button>
              </div>
            ))}
            <label className="inline-flex h-12 w-fit cursor-pointer items-center gap-2 rounded-pill bg-fill px-6 font-bold">
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
            <span className="text-caption text-text-2">{t('submit.filesHint')}</span>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-callout font-bold">{t('submit.included')}</legend>
            {INCLUDED.map((x) => (
              <CheckRow
                key={x}
                checked={included.includes(x)}
                onChange={(on) => setIncluded((s) => (on ? [...s, x] : s.filter((y) => y !== x)))}
              >
                {t(`submit.inc.${x}`)}
              </CheckRow>
            ))}
          </fieldset>
          <TextArea
            label={t('submit.note')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            rows={2}
          />
        </div>
      )}
    </BottomSheet>
  );
}

const CRITERIA = ['structure', 'quality', 'formatting', 'completeness', 'deadline'] as const;
const DUE = { h1: 60, h3: 180, d1: 1440, d3: 4320 } as const;

/** Приёмка: чек-лист → принять; доработка — что не принято, критерии, что исправить, новый срок; спор — на Pro */
export function ReviewSheet({
  open,
  onClose,
  task,
  submission,
}: {
  open: boolean;
  onClose: () => void;
  task: Task;
  submission: Submission;
}) {
  const toast = useToast();
  const me = useMe();
  const pro = me.data?.profile.plan === 'pro';
  const [mode, setMode] = useState<'check' | 'revision'>('check');
  const [checked, setChecked] = useState<boolean[]>(task.checklist.map(() => false));
  const [criteria, setCriteria] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [marks, setMarks] = useState('');
  const [due, setDue] = useState<keyof typeof DUE>('d1');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: task.currency });

  const mutation = useApiMutation(
    (sb, v: Parameters<typeof work.review>[2]) => work.review(sb, submission.id, v),
    {
      invalidate: () => invalidateTask(task.id),
      onSuccess: (_r, v) => {
        toast(
          t(
            v.decision === 'accept'
              ? 'review.accepted'
              : v.decision === 'revision'
                ? 'review.revisionSent'
                : 'review.disputeOpened',
          ),
        );
        onClose();
      },
    },
  );

  const fullComment = [comment.trim(), marks.trim() ? `${t('review.marks')}: ${marks.trim()}` : '']
    .filter(Boolean)
    .join('\n');
  const decide = (decision: 'accept' | 'revision' | 'dispute') => {
    const parsed = reviewSchema.safeParse({ decision, checklist: checked, comment: fullComment });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    mutation.mutate({
      ...parsed.data,
      ...(decision === 'revision'
        ? {
            revisionItems: checked.flatMap((c, i) => (c ? [] : [i])),
            revisionCriteria: criteria,
            revisionDue: new Date(Date.now() + DUE[due] * 60_000).toISOString(),
          }
        : {}),
    });
  };

  const allChecked = checked.every(Boolean);

  const checklist = task.checklist.length > 0 && (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-callout font-bold">
        {mode === 'revision' ? t('review.notAccepted') : t('review.checklistTitle')}
      </legend>
      {task.checklist.map((item, i) => (
        <CheckRow
          key={i}
          checked={checked[i] ?? false}
          onChange={(on) => setChecked(checked.map((c, j) => (j === i ? on : c)))}
        >
          {item}
        </CheckRow>
      ))}
    </fieldset>
  );

  if (mode === 'revision') {
    return (
      <BottomSheet
        open={open}
        onClose={onClose}
        title={t('review.revisionTitle')}
        footer={
          <div className="flex flex-col gap-3">
            <FormError error={mutation.error?.key} />
            <Button
              size="lg"
              block
              onClick={() => decide('revision')}
              disabled={mutation.isPending}
            >
              {t('review.sendRevision')}
            </Button>
            <Button variant="glass" block onClick={() => setMode('check')}>
              {t('common.back')}
            </Button>
            <p className="text-center text-caption text-text-2">{t('review.moneyStays')}</p>
          </div>
        }
      >
        <div className="flex flex-col gap-5 pb-2" data-testid="revision-form">
          {checklist}
          <div className="flex flex-col gap-2">
            <span className="text-callout font-bold">{t('review.criteriaTitle')}</span>
            <div className="flex flex-wrap gap-2">
              {CRITERIA.map((c) => (
                <Chip
                  key={c}
                  selected={criteria.includes(c)}
                  onClick={() =>
                    setCriteria((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))
                  }
                >
                  {t(`review.criteria.${c}`)}
                </Chip>
              ))}
            </div>
          </div>
          <TextArea
            label={t('review.whatToFix')}
            placeholder={t('review.reasonPlaceholder')}
            hint={t('review.reasonHint')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            error={errors.comment}
            maxLength={1800}
          />
          <Input
            label={t('review.marks')}
            placeholder={t('review.marksPlaceholder')}
            value={marks}
            onChange={(e) => setMarks(e.target.value)}
            maxLength={180}
          />
          <div className="flex flex-col gap-2">
            <span className="text-callout font-bold">{t('review.newDue')}</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(DUE) as (keyof typeof DUE)[]).map((k) => (
                <Chip key={k} selected={due === k} onClick={() => setDue(k)}>
                  {t(`review.due.${k}`)}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('review.title')}
      footer={
        <div className="flex flex-col gap-3">
          <FormError error={mutation.error?.key ?? errors.checklist ?? errors.comment} />
          <Button
            size="lg"
            block
            onClick={() => decide('accept')}
            disabled={mutation.isPending || !allChecked}
          >
            {t('review.accept')} · {fmt(task.reward_cents)}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="glass"
              block
              onClick={() => setMode('revision')}
              disabled={mutation.isPending}
            >
              {t('review.revision')}
            </Button>
            <Button
              variant="glass"
              block
              onClick={() => decide('dispute')}
              disabled={mutation.isPending || !pro}
            >
              {!pro && <Lock size={16} />}
              {t('review.dispute')}
            </Button>
          </div>
          {!pro && <p className="text-center text-caption text-text-2">{t('room.disputePro')}</p>}
        </div>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="tile flex items-center justify-between px-4 py-3">
          <span className="text-callout text-text-2">{t('review.amount')}</span>
          <span className="tabular text-title3 font-extrabold">{fmt(task.reward_cents)}</span>
        </div>
        {checklist}
        <p className="text-callout text-text-2">
          {t('review.acceptHint', { v: fmt(task.reward_cents) })}
        </p>
        <p className="text-callout text-text-2">{t('review.noReject')}</p>
        {pro && (
          <TextArea
            label={t('review.reason')}
            placeholder={t('review.reasonPlaceholder')}
            hint={t('review.reasonHint')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            error={errors.comment}
            maxLength={2000}
          />
        )}
      </div>
    </BottomSheet>
  );
}
