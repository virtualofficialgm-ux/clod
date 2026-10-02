'use client';

import {
  displayStatus,
  files as filesApi,
  formatDateTime,
  formatMoney,
  formatTimeLeft,
  responses,
  shortName,
  t,
  tasks,
  type Attachment,
  type FileRef,
  type TaskDetail,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation, useSupabase, useTaskDetail } from '@parri/shared/react';
import { ChevronLeft, Clock, FileText, GraduationCap, Globe, MapPin, MessagesSquare, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { ConfirmSheet } from '@/components/task/ConfirmSheet';
import { RespondSheet } from '@/components/task/RespondSheet';
import { ReviewSheet, SubmitSheet } from '@/components/task/WorkSheets';
import { LinkButton } from '@/components/ui/LinkButton';
import { Avatar, CenterSpinner, EmptyState, SectionTitle, StatusBadge } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';
import { FileList } from '@/components/task/FileList';

function Actions({ d }: { d: TaskDetail }) {
  const toast = useToast();
  const [sheet, setSheet] = useState<null | 'respond' | 'cancel' | 'withdraw' | 'submit' | 'review'>(null);
  const task = d.task;
  const status = displayStatus(task);
  const latest = d.submissions[0];
  const close = () => setSheet(null);

  const cancel = useApiMutation((sb) => tasks.cancel(sb, task.id), {
    invalidate: () => [keys.task(task.id), keys.me, ['my-tasks'], ['feed']],
    onSuccess: () => {
      toast(t('task.cancelled'));
      close();
    },
  });
  const republish = useApiMutation((sb) => tasks.republish(sb, task.id), {
    invalidate: () => [keys.task(task.id), keys.me, ['my-tasks'], ['feed']],
    onSuccess: () => toast(t('task.republished')),
  });
  const withdraw = useApiMutation((sb, id: string) => responses.withdraw(sb, id), {
    invalidate: () => [keys.task(task.id), ['my-tasks'], ['feed']],
    onSuccess: () => {
      toast(t('task.withdrawn'));
      close();
    },
  });

  const roomLink = (
    <LinkButton href={`/tasks/${task.id}/room`} variant="glass">
      <MessagesSquare size={18} strokeWidth={2.4} />
      {t('task.room')}
    </LinkButton>
  );

  let content: React.ReactNode = null;
  if (d.viewer_role === 'customer') {
    if (status === 'open') {
      content = (
        <>
          <LinkButton href={`/tasks/${task.id}/responses`}>
            <Users size={18} strokeWidth={2.4} />
            {t('task.responses')} · {task.response_count}
          </LinkButton>
          <Button variant="glass" onClick={() => setSheet('cancel')}>
            {t('task.cancel')}
          </Button>
        </>
      );
    } else if (status === 'archived' && (task.archive_reason === 'expired' || task.expired)) {
      content = (
        <Button onClick={() => republish.mutate(undefined)} disabled={republish.isPending}>
          {t('task.republish')} · {formatMoney(task.reward_cents + task.fee_cents)}
        </Button>
      );
    } else if (status === 'review' && latest) {
      content = (
        <>
          <Button onClick={() => setSheet('review')}>{t('task.review')}</Button>
          {roomLink}
        </>
      );
    } else if (task.executor_id) {
      content = roomLink;
    }
  } else if (d.viewer_role === 'executor') {
    content = (
      <>
        {status === 'in_progress' && <Button onClick={() => setSheet('submit')}>{t('task.submitWork')}</Button>}
        {roomLink}
      </>
    );
  } else if (d.my_response) {
    const r = d.my_response;
    content = (
      <div className="flex w-full flex-col gap-3">
        <p className="text-callout font-semibold text-text-2">
          {t('task.yourResponse')}: {formatMoney(r.price_cents)} · {t(`deadline.${r.deadline}`)} ·{' '}
          <span className="text-text">{t(`responseStatus.${r.status}` as TranslationKey)}</span>
        </p>
        {status === 'open' && r.status === 'pending' && (
          <div className="flex flex-wrap gap-2">
            <Button variant="glass" onClick={() => setSheet('respond')}>
              {t('task.editResponse')}
            </Button>
            <Button variant="glass" onClick={() => setSheet('withdraw')}>
              {t('task.withdraw')}
            </Button>
          </div>
        )}
        {status === 'open' && r.status === 'withdrawn' && <Button onClick={() => setSheet('respond')}>{t('task.respond')}</Button>}
      </div>
    );
  } else if (status === 'open') {
    content = (
      <Button size="lg" onClick={() => setSheet('respond')}>
        {t('task.respond')}
      </Button>
    );
  }

  return (
    <>
      {content && <div className="flex flex-wrap items-center gap-2">{content}</div>}
      {sheet === 'respond' && <RespondSheet open onClose={close} task={task} existing={d.my_response} />}
      {sheet === 'submit' && <SubmitSheet open onClose={close} task={task} />}
      {sheet === 'review' && latest && <ReviewSheet open onClose={close} task={task} submission={latest} />}
      <ConfirmSheet
        open={sheet === 'cancel'}
        onClose={close}
        title={t('task.cancel')}
        text={t('task.cancelConfirm')}
        confirmLabel={t('task.cancel')}
        onConfirm={() => cancel.mutate(undefined)}
        busy={cancel.isPending}
        error={cancel.error?.key}
      />
      <ConfirmSheet
        open={sheet === 'withdraw'}
        onClose={close}
        title={t('task.withdraw')}
        confirmLabel={t('task.withdraw')}
        onConfirm={() => d.my_response && withdraw.mutate(d.my_response.id)}
        busy={withdraw.isPending}
        error={withdraw.error?.key}
      />
      {(republish.error || cancel.error) && <p className="text-callout font-semibold text-danger">{t((republish.error ?? cancel.error)!.key as TranslationKey)}</p>}
    </>
  );
}

export default function TaskPage() {
  const { id } = useParams<{ id: string }>();
  const { data: d, isLoading } = useTaskDetail(id);
  const router = useRouter();

  if (isLoading) return <CenterSpinner />;
  if (!d) {
    return (
      <main className="mx-auto max-w-[var(--p-content-max)] px-[var(--p-gutter)] pt-8 md:px-8">
        <EmptyState title={t('task.notFound')} action={<LinkButton href="/feed">{t('nav.feed')}</LinkButton>} />
      </main>
    );
  }

  const task = d.task;
  const status = displayStatus(task);
  const KindIcon = task.kind === 'online' ? Globe : task.kind === 'nearby' ? MapPin : GraduationCap;
  const kindLabel =
    task.kind === 'nearby' ? [t('kind.nearby'), task.place_name].filter(Boolean).join(' · ') : task.kind === 'campus' ? d.university?.name ?? t('kind.campus') : t('kind.online');
  const isParticipant = d.viewer_role === 'customer' || d.viewer_role === 'executor';

  return (
    <>
      <Header
        title={task.title}
        leading={
          <Button variant="glass" size="icon" aria-label={t('common.back')} onClick={() => router.back()}>
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Button>
        }
      />
      <main className="mx-auto grid max-w-[var(--p-content-max)] gap-8 px-[var(--p-gutter)] pt-2 md:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <article className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className="rounded-pill bg-separator px-3 py-1 text-caption text-text-2">{t(`category.${task.category}`)}</span>
            <span className="rounded-pill bg-separator px-3 py-1 text-caption text-text-2">{t(`format.${task.result_format}`)}</span>
          </div>
          <p className="tabular text-price font-extrabold text-accent-text">{formatMoney(task.reward_cents)}</p>
          <h1 className="text-title2 font-extrabold">{task.title}</h1>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-callout font-semibold text-text-2">
            <span className="inline-flex items-center gap-1.5">
              <KindIcon size={16} strokeWidth={2.4} aria-hidden /> {kindLabel}
              {task.radius_m ? ` · ${task.radius_m} м` : ''}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock size={16} strokeWidth={2.4} aria-hidden /> {t(`deadline.${task.deadline}`)}
            </span>
            {status === 'open' && <span>{t('task.expires', { date: formatDateTime(task.expires_at) })}</span>}
            {task.due_at && ['in_progress', 'review'].includes(status) && (
              <span className="text-text">
                {t('task.due', { date: formatDateTime(task.due_at) })} · {formatTimeLeft(task.due_at)}
              </span>
            )}
            {status === 'archived' && task.archive_reason && <span>{t(`task.archived_${task.archive_reason}`)}</span>}
          </div>

          <Actions d={d} />

          <section className="card flex flex-col gap-3 p-5 md:p-6">
            <SectionTitle>{t('task.description')}</SectionTitle>
            <p className="whitespace-pre-line text-body">{task.description || task.brief}</p>
          </section>

          {task.checklist.length > 0 && (
            <section className="card flex flex-col gap-3 p-5 md:p-6">
              <SectionTitle>{t('task.checklist')}</SectionTitle>
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-body">
                {task.checklist.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ol>
            </section>
          )}

          {d.attachments.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle>{t('task.attachments')}</SectionTitle>
              <FileList items={d.attachments} />
            </section>
          )}

          {isParticipant && d.submissions.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionTitle>{t('task.versions')}</SectionTitle>
              {d.submissions.map((s) => (
                <div key={s.id} className="card flex flex-col gap-2 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold">{t('task.version', { n: s.version })}</span>
                    <span className="text-caption text-text-2">
                      {t(`submissionStatus.${s.status}` as TranslationKey)} · {formatDateTime(s.created_at)}
                    </span>
                  </div>
                  {s.link && (
                    <a href={s.link} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-accent-text underline">
                      {s.link}
                    </a>
                  )}
                  {s.comment && <p className="whitespace-pre-line text-body">{s.comment}</p>}
                  {s.files.length > 0 && <FileList items={s.files} />}
                  {s.review_comment && (
                    <p className="rounded-md bg-separator px-4 py-3 text-callout">
                      <span className="font-bold">{t('task.revisionComment')}:</span> {s.review_comment}
                    </p>
                  )}
                </div>
              ))}
            </section>
          )}
        </article>

        <aside className="flex flex-col gap-4">
          <div className="card flex items-center gap-3 p-5">
            <Avatar name={shortName(d.customer.first_name, d.customer.last_name)} url={d.customer.avatar_url} size={48} />
            <div className="min-w-0">
              <p className="text-caption text-text-2">{t('task.customer')}</p>
              <p className="truncate font-bold">{shortName(d.customer.first_name, d.customer.last_name)}</p>
              <p className="text-callout text-text-2">
                {d.customer.rating_avg ? `★ ${Number(d.customer.rating_avg).toFixed(1)}` : t('responses.noRating')}
              </p>
            </div>
          </div>
          {d.executor && (
            <div className="card flex items-center gap-3 p-5">
              <Avatar name={shortName(d.executor.first_name, d.executor.last_name)} url={d.executor.avatar_url} size={48} />
              <div className="min-w-0">
                <p className="text-caption text-text-2">{t('task.executor')}</p>
                <p className="truncate font-bold">{shortName(d.executor.first_name, d.executor.last_name)}</p>
                <p className="text-callout text-text-2">{t('responses.completed', { n: d.executor.completed_count })}</p>
              </div>
            </div>
          )}
          {d.viewer_role === 'customer' && ['open', 'in_progress', 'review', 'disputed'].includes(status) && (
            <div className="card flex flex-col gap-1 p-5">
              <p className="text-caption uppercase tracking-wide text-text-2">{t('safe.name')}</p>
              <p className="tabular text-title2 font-extrabold">{formatMoney(task.reward_cents + task.fee_cents)}</p>
              <p className="text-callout text-text-2">{t('safe.hint')}</p>
            </div>
          )}
          {status === 'disputed' && d.dispute && (
            <div className="card flex flex-col gap-2 p-5">
              <p className="font-bold text-danger">{t('task.disputed')}</p>
              <p className="text-callout">{d.dispute.reason}</p>
            </div>
          )}
          <Link href="/feed" className="text-center text-callout font-bold text-accent-text">
            {t('nav.feed')}
          </Link>
        </aside>
      </main>
    </>
  );
}
