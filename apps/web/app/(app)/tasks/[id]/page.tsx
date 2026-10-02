'use client';

import {
  displayStatus,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatTimeLeft,
  languageName,
  responses,
  shortName,
  t,
  taskExtras,
  tasks,
  work,
  type TaskDetail,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation, useMe, useTaskDetail } from '@parri/shared/react';
import clsx from 'clsx';
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Flag,
  GraduationCap,
  Globe,
  HelpCircle,
  MapPin,
  MessagesSquare,
  Play,
  Repeat,
  Share2,
  ShieldCheck,
  Star,
  Users,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { ConfirmSheet } from '@/components/task/ConfirmSheet';
import { FileList } from '@/components/task/FileList';
import { RateSheet } from '@/components/task/RateSheet';
import { ReportSheet } from '@/components/task/ReportSheet';
import { RespondSheet } from '@/components/task/RespondSheet';
import { ShareSheet } from '@/components/task/ShareSheet';
import { TakeSheet } from '@/components/task/TakeSheet';
import { categoryIcon } from '@/components/task/categoryIcon';
import { LinkButton } from '@/components/ui/LinkButton';
import { Avatar, CenterSpinner, EmptyState, StatusBadge } from '@/components/ui/bits';
import { BigNumber, Card, CardHeader, ProgressBar } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

const fmt = (d: TaskDetail, cents: number) => formatMoney(cents, 'ru-RU', { currency: d.task.currency });

/** Секундомер для «начать за 25 минут» */
function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Экран «Задача ваша!»: этапы, старт за 25 минут, рабочая комната, отказ */
function YoursPanel({ d }: { d: TaskDetail }) {
  const toast = useToast();
  const router = useRouter();
  const now = useNow();
  const [refuse, setRefuse] = useState(false);
  const task = d.task;
  const status = displayStatus(task);
  const stage = status === 'completed' ? 3 : status === 'review' ? 2 : task.started_at ? 1 : 0;
  const startLeft = d.start_deadline ? new Date(d.start_deadline).getTime() - now : null;
  const start = useApiMutation((sb) => work.start(sb, task.id), { invalidate: () => [keys.task(task.id), ['my-tasks']] });
  const refuseM = useApiMutation((sb) => work.refuse(sb, task.id), {
    invalidate: () => [keys.task(task.id), ['my-tasks'], ['feed']],
    onSuccess: () => {
      toast(t('task.refused'));
      router.push('/feed');
    },
  });
  const stages = ['taken', 'doing', 'sent', 'paid'] as const;
  return (
    <Card className="flex flex-col gap-5 ring-2 ring-accent/40">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-on-accent">
          <Zap size={22} strokeWidth={2.6} />
        </span>
        <div>
          <h2 className="text-title3 font-extrabold">{t('task.yoursTitle')}</h2>
          <p className="text-callout text-text-2">
            {task.started_at ? t('task.yoursStarted', { date: task.due_at ? formatDateTime(task.due_at) : '—' }) : t('task.yoursText', { m: 25 })}
          </p>
        </div>
      </div>
      <ol className="grid grid-cols-4 gap-2" aria-label={t('task.history')}>
        {stages.map((s, i) => (
          <li key={s} className="flex flex-col gap-1.5">
            <span className={clsx('h-1.5 rounded-pill', i <= stage ? 'bg-accent' : 'bg-fill')} />
            <span className={clsx('text-caption', i <= stage ? 'text-text' : 'text-text-2')}>{t(`task.stages.${s}`)}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        {status === 'in_progress' && !task.started_at && (
          <Button size="lg" disabled={start.isPending || (startLeft != null && startLeft <= 0)} onClick={() => start.mutate(undefined)}>
            <Play size={18} strokeWidth={2.6} />
            {t('task.start')}
            {startLeft != null && startLeft > 0 && <span className="tabular opacity-80">· {t('task.startLeft', { left: formatDuration(startLeft) })}</span>}
          </Button>
        )}
        <LinkButton href={`/tasks/${task.id}/room`} variant={task.started_at ? 'primary' : 'glass'}>
          <MessagesSquare size={18} />
          {t('task.openRoom')}
        </LinkButton>
        {status === 'in_progress' && (
          <Button variant="plain" onClick={() => setRefuse(true)} className="text-danger">
            {t('task.refuse')}
          </Button>
        )}
      </div>
      {(start.error || refuseM.error) && <p className="text-callout font-semibold text-danger">{t((start.error ?? refuseM.error)!.key as TranslationKey)}</p>}
      <ConfirmSheet
        open={refuse}
        onClose={() => setRefuse(false)}
        title={t('task.refuseTitle')}
        text={task.started_at ? t('task.refuseAfter') : t('task.refuseBefore')}
        confirmLabel={t('task.refuse')}
        onConfirm={() => refuseM.mutate(undefined)}
        busy={refuseM.isPending}
        error={refuseM.error?.key}
      />
    </Card>
  );
}

/** «Задача выполнена» для исполнителя и отзыв для обеих сторон */
function CompletedPanel({ d, onRate }: { d: TaskDetail; onRate: () => void }) {
  const task = d.task;
  const executor = d.viewer_role === 'executor';
  const spent = task.completed_at && task.assigned_at ? new Date(task.completed_at).getTime() - new Date(task.assigned_at).getTime() : null;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
          <CheckCircle2 size={24} />
        </span>
        <h2 className="text-title3 font-extrabold">{t('task.completedTitle')}</h2>
      </div>
      {executor && <BigNumber value={`+${fmt(d, task.reward_cents)}`} label={t('task.completedText', { sum: fmt(d, task.reward_cents) })} accent />}
      <div className="grid grid-cols-2 gap-2">
        {spent != null && (
          <div className="tile px-4 py-3">
            <p className="text-caption text-text-2">{t('task.timeSpent')}</p>
            <p className="font-bold">{formatDuration(spent)}</p>
          </div>
        )}
        {d.my_review && (
          <div className="tile px-4 py-3">
            <p className="text-caption text-text-2">{t('rate.yourReview')}</p>
            <p className="flex items-center gap-1 font-bold">
              <Star size={16} className="fill-accent text-accent" /> {d.my_review.rating}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {!d.my_review && (
          <Button onClick={onRate}>
            <Star size={18} />
            {t('rate.leave')}
          </Button>
        )}
        {executor ? (
          <LinkButton href="/feed" variant="glass">
            {t('task.nextTask')}
          </LinkButton>
        ) : (
          <LinkButton href={`/tasks/new?repeat=${task.id}`} variant="glass">
            <Repeat size={18} />
            {t('task.repeat')}
          </LinkButton>
        )}
        <LinkButton href="/balance" variant="glass">
          {t('task.transaction')}
        </LinkButton>
      </div>
    </Card>
  );
}

function Actions({ d, onRespond, onTake }: { d: TaskDetail; onRespond: () => void; onTake: () => void }) {
  const toast = useToast();
  const [sheet, setSheet] = useState<null | 'cancel' | 'withdraw'>(null);
  const task = d.task;
  const status = displayStatus(task);
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

  let content: React.ReactNode = null;
  if (d.viewer_role === 'customer') {
    if (status === 'open') {
      content = (
        <>
          <LinkButton href={`/tasks/${task.id}/responses`}>
            <Users size={18} strokeWidth={2.4} />
            {t('task.viewResponses')} · {task.response_count}
          </LinkButton>
          <Button variant="glass" onClick={() => setSheet('cancel')}>
            {t('task.cancel')}
          </Button>
        </>
      );
    } else if (status === 'archived') {
      content = (
        <Button onClick={() => republish.mutate(undefined)} disabled={republish.isPending}>
          {t('task.republish')} · {fmt(d, task.reward_cents + task.fee_cents)}
        </Button>
      );
    } else if (['in_progress', 'review', 'disputed'].includes(status)) {
      content = (
        <LinkButton href={`/tasks/${task.id}/room`}>
          <MessagesSquare size={18} strokeWidth={2.4} />
          {status === 'review' ? t('task.review') : t('task.room')}
        </LinkButton>
      );
    }
  } else if (d.viewer_role === 'candidate' && d.my_response) {
    const r = d.my_response;
    content = (
      <div className="flex w-full flex-col gap-3">
        <Link href={`/responses/${r.id}`} className="tile flex items-center justify-between gap-3 px-4 py-3">
          <span className="font-semibold">
            {t('task.yourResponse')}: {fmt(d, r.price_cents)} · {t(`deadline.${r.deadline}`)}
          </span>
          <span className="text-callout font-bold text-accent-text">{t('task.viewResponse')} →</span>
        </Link>
        {status === 'open' && r.status === 'pending' && (
          <div className="flex flex-wrap gap-2">
            <Button variant="glass" onClick={onRespond}>
              {t('task.editResponse')}
            </Button>
            <Button variant="glass" onClick={() => setSheet('withdraw')}>
              {t('task.withdraw')}
            </Button>
          </div>
        )}
        {status === 'open' && r.status === 'withdrawn' && <Button onClick={onRespond}>{t('task.respond')}</Button>}
      </div>
    );
  } else if (status === 'open') {
    content = (
      <div className="flex w-full flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={onTake} disabled={d.takes_left <= 0}>
            <Zap size={18} strokeWidth={2.6} />
            {t('task.take')}
          </Button>
          <Button size="lg" variant="glass" onClick={onRespond}>
            {t('task.respondOwn')}
          </Button>
        </div>
        <p className="text-callout text-text-2">
          {t('task.takeHint')} {t('task.takesLeft', { n: Math.max(0, d.takes_left) })}
        </p>
      </div>
    );
  }

  return (
    <>
      {content && <div className="flex flex-wrap items-center gap-2">{content}</div>}
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

function History({ d }: { d: TaskDetail }) {
  const task = d.task;
  const items: [string, string | null][] = [
    [t('task.h_published'), task.published_at],
    [t('task.h_reserved'), task.published_at],
    [t('task.h_assigned'), task.assigned_at],
    [t('task.h_submitted'), d.submissions.length ? d.submissions[d.submissions.length - 1]!.created_at : null],
    [t('task.h_completed'), task.completed_at],
  ];
  return (
    <ol className="flex flex-col gap-3">
      {items
        .filter(([, at]) => at)
        .map(([label, at], i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-accent" />
            <div>
              <p className="font-semibold">{label}</p>
              <p className="text-caption text-text-2">{formatDateTime(at!)}</p>
            </div>
          </li>
        ))}
    </ol>
  );
}

export default function TaskPage() {
  const { id } = useParams<{ id: string }>();
  const { data: d, isLoading } = useTaskDetail(id);
  const me = useMe();
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<null | 'respond' | 'take' | 'share' | 'report' | 'rate'>(null);
  const bookmark = useApiMutation((sb, on: boolean) => taskExtras.bookmark(sb, id, on), {
    invalidate: () => [keys.task(id), ['feed']],
    onSuccess: (_r, on) => toast(on ? t('feed.bookmarked') : t('feed.unsave')),
  });

  if (isLoading) return <CenterSpinner />;
  if (!d) {
    return (
      <main className="mx-auto max-w-[var(--p-content-max)] px-[var(--p-gutter)] pt-8 md:px-8">
        <EmptyState
          title={t('task.notAvailable')}
          text={t('task.notFound')}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <LinkButton href="/feed">{t('task.backToFeed')}</LinkButton>
              <LinkButton href="/saved" variant="glass">
                {t('task.mySaved')}
              </LinkButton>
            </div>
          }
        />
      </main>
    );
  }

  const task = d.task;
  const status = displayStatus(task);
  const KindIcon = task.kind === 'online' ? Globe : task.kind === 'nearby' ? MapPin : GraduationCap;
  const CatIcon = categoryIcon(task.category);
  const kindLabel =
    task.kind === 'nearby'
      ? [t('kind.nearby'), task.place_name, task.radius_m ? `${task.radius_m} м` : null].filter(Boolean).join(' · ')
      : task.kind === 'campus'
        ? [d.university?.name ?? t('kind.campus'), task.campus_building].filter(Boolean).join(' · ')
        : t('kind.online');
  const isParticipant = d.viewer_role === 'customer' || d.viewer_role === 'executor';
  const customerName = shortName(d.customer.first_name, d.customer.last_name);
  const left = task.due_at && ['in_progress', 'review'].includes(status) ? formatTimeLeft(task.due_at) : status === 'open' ? formatTimeLeft(task.expires_at) : null;
  const details: [string, React.ReactNode][] = [
    [t('task.resultFormat'), t(`format.${task.result_format}` as TranslationKey)],
    [t('create.deadline'), t(`deadline.${task.deadline}`)],
    ...(task.language ? [[t('task.language'), languageName(task.language)] as [string, string]] : []),
    ...(task.required_level ? [[t('task.level'), t(`onb.exp.${task.required_level}`)] as [string, string]] : []),
    ...(task.proofs.length ? [[t('task.proofs'), task.proofs.map((p) => t(`create.proofs.${p}` as TranslationKey)).join(', ')] as [string, string]] : []),
    ...(task.visit_window ? [[t('task.visitWindow'), task.visit_window] as [string, string]] : []),
  ];

  return (
    <>
      <Header
        title={task.title}
        leading={
          <Button variant="glass" size="icon" aria-label={t('task.backToFeed')} onClick={() => router.back()}>
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Button>
        }
        actions={
          <>
            <Button variant="glass" size="icon" aria-label={d.bookmarked ? t('feed.unsave') : t('task.save')} aria-pressed={d.bookmarked} onClick={() => bookmark.mutate(!d.bookmarked)}>
              {d.bookmarked ? <BookmarkCheck size={20} className="text-accent" /> : <Bookmark size={20} />}
            </Button>
            <Button variant="glass" size="icon" aria-label={t('task.share')} onClick={() => setSheet('share')}>
              <Share2 size={20} />
            </Button>
            {d.viewer_role !== 'customer' && (
              <Button variant="glass" size="icon" aria-label={t('task.report')} onClick={() => setSheet('report')}>
                <Flag size={20} />
              </Button>
            )}
          </>
        }
      />
      <main className="mx-auto grid max-w-[var(--p-content-max)] gap-8 px-[var(--p-gutter)] pt-2 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className="inline-flex h-7 items-center gap-1.5 rounded-pill bg-accent-soft px-3 text-caption text-accent-text">
              <CatIcon size={14} />
              {t(`category.${task.category}`)}
            </span>
            <span className="inline-flex h-7 items-center gap-1.5 rounded-pill bg-fill px-3 text-caption text-text-2">
              <KindIcon size={14} /> {kindLabel}
            </span>
          </div>
          <h1 className="text-title2 font-extrabold">{task.title}</h1>
          <p className="text-caption text-text-2">
            {t('task.id')}: <span className="font-mono">{task.id.slice(0, 8)}</span> · {t('task.posted')} {formatDateTime(task.published_at)}
          </p>

          {d.viewer_role === 'executor' && ['in_progress', 'review'].includes(status) && <YoursPanel d={d} />}
          {status === 'completed' && isParticipant && <CompletedPanel d={d} onRate={() => setSheet('rate')} />}

          <Actions d={d} onRespond={() => setSheet('respond')} onTake={() => setSheet('take')} />

          <Card>
            <CardHeader title={t('task.description')} />
            <p className="whitespace-pre-line text-body">{task.description || task.brief}</p>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {details.map(([k, v]) => (
                <div key={k} className="tile flex flex-col px-4 py-3">
                  <dt className="text-caption text-text-2">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            {task.skills.length > 0 && (
              <div className="mt-4 flex flex-col gap-2">
                <h3 className="text-callout font-bold text-text-2">{t('task.skills')}</h3>
                <div className="flex flex-wrap gap-1.5">
                  {task.skills.map((s) => (
                    <span key={s} className="rounded-pill bg-fill px-3 py-1 text-caption">
                      {t(`skill.${s}` as TranslationKey)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {task.checklist.length > 0 && (
            <Card>
              <CardHeader title={t('task.criteria')} />
              <ol className="flex flex-col gap-2">
                {task.checklist.map((c, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-caption text-on-ink">{i + 1}</span>
                    <span className="text-body">{c}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {d.attachments.length > 0 && (
            <Card>
              <CardHeader title={t('task.materials')} />
              <FileList items={d.attachments} />
            </Card>
          )}

          <Link href={`/tasks/${task.id}/questions`} className="card flex items-center gap-3 p-5 transition-colors hover:bg-fill/40">
            <span className="flex size-10 items-center justify-center rounded-full bg-fill">
              <HelpCircle size={20} />
            </span>
            <span className="flex-1 font-bold">{t('task.questionsN', { n: d.questions_count })}</span>
            <span className="text-callout font-bold text-accent-text">→</span>
          </Link>
        </article>

        <aside className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <p className="text-caption uppercase text-text-2">{t('task.budget')}</p>
            <p className="tabular text-number font-extrabold">{fmt(d, task.reward_cents)}</p>
            <p className="inline-flex items-center gap-1.5 text-callout font-semibold text-success">
              <ShieldCheck size={16} /> {t('feed.safeDeal')} · {t('feed.reserved')}
            </p>
            {left && (
              <div className="flex flex-col gap-2">
                <p className="inline-flex items-center gap-1.5 text-callout font-semibold">
                  <Clock size={16} /> {t('task.deadlineLeft', { left })}
                </p>
                {task.due_at && task.assigned_at && (
                  <ProgressBar
                    value={(Date.now() - new Date(task.assigned_at).getTime()) / (new Date(task.due_at).getTime() - new Date(task.assigned_at).getTime())}
                    label={t('create.deadline')}
                  />
                )}
              </div>
            )}
            <p className="text-callout text-text-2">{t('task.proposals', { n: task.response_count })}</p>
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Avatar name={customerName} url={d.customer.avatar_url} size={52} />
              <div className="min-w-0">
                <p className="text-caption text-text-2">{t('task.customer')}</p>
                <p className="truncate font-bold">{customerName}</p>
                <p className="text-callout text-text-2">
                  {d.customer.rating_avg ? `★ ${Number(d.customer.rating_avg).toFixed(1)} · ${d.customer.rating_count}` : t('responses.noRating')}
                </p>
              </div>
            </div>
            <p className="text-callout text-text-2">
              {t('task.customerStats', { done: d.customer.customer_completed, open: d.customer.customer_open })}
              <br />
              {t('task.customerSince', { date: new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(d.customer.created_at)) })}
            </p>
            <LinkButton href={`/u/${d.customer.username ?? d.customer.id}`} variant="glass" size="md">
              {t('task.openProfile')}
            </LinkButton>
          </Card>

          {d.executor && (
            <Card className="flex items-center gap-3">
              <Avatar name={shortName(d.executor.first_name, d.executor.last_name)} url={d.executor.avatar_url} size={48} />
              <div className="min-w-0">
                <p className="text-caption text-text-2">{t('task.executor')}</p>
                <p className="truncate font-bold">{shortName(d.executor.first_name, d.executor.last_name)}</p>
                <p className="text-callout text-text-2">{t('responses.completed', { n: d.executor.completed_count })}</p>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title={t('task.history')} />
            <History d={d} />
          </Card>

          {status === 'disputed' && d.dispute && (
            <Card className="flex flex-col gap-2">
              <p className="font-bold text-danger">{t('task.disputed')}</p>
              <p className="text-callout">{d.dispute.reason}</p>
            </Card>
          )}
          <Link href="/feed" className="text-center text-callout font-bold text-accent-text">
            {t('task.backToFeed')}
          </Link>
        </aside>
      </main>

      {sheet === 'respond' && <RespondSheet open onClose={() => setSheet(null)} task={task} existing={d.my_response} />}
      <TakeSheet
        task={sheet === 'take' ? { id: task.id, title: task.title, reward_cents: task.reward_cents, currency: task.currency } : null}
        takesLeft={d.takes_left}
        pro={me.data?.profile.plan === 'pro'}
        onClose={() => setSheet(null)}
      />
      <ShareSheet open={sheet === 'share'} onClose={() => setSheet(null)} taskId={task.id} title={task.title} />
      <ReportSheet open={sheet === 'report'} onClose={() => setSheet(null)} taskId={task.id} />
      {sheet === 'rate' && <RateSheet d={d} onClose={() => setSheet(null)} />}
    </>
  );
}
