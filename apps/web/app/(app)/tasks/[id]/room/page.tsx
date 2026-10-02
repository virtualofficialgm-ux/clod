'use client';

import {
  displayStatus,
  formatDistance,
  nearby,
  toApiError,
  translator,
  files as filesApi,
  formatDateTime,
  formatMoney,
  formatTimeLeft,
  parseDollars,
  room,
  t,
  work,
  type FileRef,
  type Message,
  type Submission,
  type TaskDetail,
  type TranslationKey,
} from '@parri/shared';
import { chats } from '@parri/shared';
import {
  keys,
  useApiMutation,
  useMe,
  usePeerState,
  useRoomMessages,
  useSupabase,
  useTaskDetail,
  useTypingPing,
} from '@parri/shared/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowUp,
  CheckCheck,
  ChevronLeft,
  Clock,
  Coins,
  ExternalLink,
  Map,
  MapPin,
  Paperclip,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Glass } from '@/components/glass/Glass';
import { Header } from '@/components/glass/Header';
import { FileList } from '@/components/task/FileList';
import { ReviewSheet, SubmitSheet } from '@/components/task/WorkSheets';
import { CenterSpinner, EmptyState, StatusBadge } from '@/components/ui/bits';
import { FormError, Input } from '@/components/ui/Field';
import { Card, CardHeader, ListGroup, ListRow } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';
import { useGeolocation } from '@/lib/useGeolocation';

const ACTIVE = ['in_progress', 'review', 'disputed'];

function Bubble({ m, mine, read }: { m: Message; mine: boolean; read?: boolean }) {
  const sb = useSupabase();
  const [translated, setTranslated] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [trError, setTrError] = useState<string | null>(null);
  if (m.kind === 'system') {
    return (
      <p className="mx-auto max-w-md rounded-pill bg-fill px-4 py-2 text-center text-caption text-text-2">
        {t(`event.${m.body}` as TranslationKey, {
          version: String((m.meta?.version as number | undefined) ?? ''),
        })}
        {typeof m.meta?.distance_m === 'number' && ` · ${formatDistance(m.meta.distance_m as number)}`}
        {typeof m.meta?.amount_cents === 'number' &&
          ` · ${formatMoney(m.meta.amount_cents as number, 'ru-RU', { currency: (m.meta.currency as 'USD' | 'USDT') ?? 'USD' })}`}
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
        {m.body && <p className="whitespace-pre-line break-words">{translated && !showOriginal ? translated : m.body}</p>}
      </div>
      {!mine && m.body && (
        <button
          type="button"
          className="px-2 text-caption font-bold text-accent-text"
          onClick={async () => {
            if (translated) return setShowOriginal((v) => !v);
            try {
              setTranslated(await translator.translate(sb, m.body, 'ru'));
              setTrError(null);
            } catch (e) {
              setTrError(toApiError(e).key);
            }
          }}
        >
          {translated && !showOriginal ? t('room.original') : t('room.translate')}
        </button>
      )}
      {trError && <span className="px-2 text-caption text-danger">{t(trError as TranslationKey)}</span>}
      {m.files.length > 0 && (
        <div className="w-full max-w-[85%]">
          <FileList items={m.files} />
        </div>
      )}
      <span className="inline-flex items-center gap-1 px-2 text-caption text-text-2">
        {formatDateTime(m.created_at)}
        {mine && (
          <span className={clsx('inline-flex items-center gap-0.5', read && 'text-accent-text')}>
            · <CheckCheck size={14} aria-hidden /> {read ? t('room.read') : t('room.delivered')}
          </span>
        )}
      </span>
    </div>
  );
}

const EXT_MINUTES = [15, 30, 60, 180, 1440] as const;

function ExtensionSheet({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const toast = useToast();
  const [minutes, setMinutes] = useState<number>(60);
  const [reason, setReason] = useState('');
  const m = useApiMutation((sb) => work.requestExtension(sb, taskId, minutes, reason), {
    invalidate: () => [keys.task(taskId), keys.messages(taskId)],
    onSuccess: () => {
      toast(t('room.extensionSent'));
      onClose();
    },
  });
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t('room.extensionTitle')}
      footer={
        <div className="flex flex-col gap-2">
          <FormError error={m.error?.key} />
          <Button size="lg" block onClick={() => m.mutate(undefined)} disabled={m.isPending}>
            {t('room.extension')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <span className="text-callout font-bold">{t('room.extensionMinutes')}</span>
        <div className="flex flex-wrap gap-2">
          {EXT_MINUTES.map((x) => (
            <Chip key={x} selected={minutes === x} onClick={() => setMinutes(x)}>
              {t(`room.minutes.${x}`)}
            </Chip>
          ))}
        </div>
        <Input
          label={t('room.extensionReason')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={300}
        />
      </div>
    </BottomSheet>
  );
}

function TipSheet({ d, onClose }: { d: TaskDetail; onClose: () => void }) {
  const toast = useToast();
  const [preset, setPreset] = useState<number | null>(300);
  const [custom, setCustom] = useState('');
  const cents = preset ?? parseDollars(custom) ?? 0;
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: d.task.currency });
  const m = useApiMutation((sb) => work.tip(sb, d.task.id, cents), {
    invalidate: () => [keys.task(d.task.id), keys.messages(d.task.id), keys.me, keys.ledger],
    onSuccess: () => {
      toast(t('room.tipSent'));
      onClose();
    },
  });
  return (
    <BottomSheet
      open
      onClose={onClose}
      title={t('room.tipTitle')}
      footer={
        <div className="flex flex-col gap-2">
          <FormError error={m.error?.key} />
          <Button
            size="lg"
            block
            onClick={() => m.mutate(undefined)}
            disabled={m.isPending || cents < 100}
          >
            {t('room.tipSend', { v: fmt(cents) })}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-callout text-text-2">{t('room.tipHint')}</p>
        <div className="flex flex-wrap gap-2">
          {[100, 300, 500, 1000].map((c) => (
            <Chip key={c} selected={preset === c} onClick={() => setPreset(c)}>
              {fmt(c)}
            </Chip>
          ))}
          <Chip selected={preset === null} onClick={() => setPreset(null)}>
            {t('room.tipCustom')}
          </Chip>
        </div>
        {preset === null && (
          <Input
            label={t('room.tipCustom')}
            inputMode="decimal"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
        )}
      </div>
    </BottomSheet>
  );
}

function Versions({ items, task }: { items: Submission[]; task: TaskDetail['task'] }) {
  if (!items.length) return null;
  return (
    <Card>
      <CardHeader title={t('room.versions')} />
      <ol className="flex flex-col gap-3">
        {items.map((s) => (
          <li key={s.id} className="tile flex flex-col gap-1.5 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">
                {t('task.version', { n: s.version })}
                {s.stage === 'intermediate' && (
                  <span className="ml-2 text-caption text-text-2">
                    {t('room.stageIntermediate')}
                  </span>
                )}
              </span>
              <span className="text-caption font-semibold">
                {t(`submissionStatus.${s.status}`)}
              </span>
            </div>
            {s.comment && <p className="whitespace-pre-line text-callout">{s.comment}</p>}
            {s.link && (
              <a
                href={s.link}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 truncate text-callout font-semibold text-accent-text"
              >
                <ExternalLink size={14} /> {s.link}
              </a>
            )}
            {s.files.length > 0 && <FileList items={s.files} />}
            {s.note && <p className="text-caption text-text-2">{s.note}</p>}
            {s.review_comment && (
              <p className="rounded-md bg-warning/12 px-3 py-2 text-callout">
                {s.review_comment}
                {s.revision_items?.length
                  ? ` · ${s.revision_items
                      .map((i) => task.checklist[i])
                      .filter(Boolean)
                      .join(', ')}`
                  : ''}
                {s.revision_due
                  ? ` · ${t('room.revisionDue', { date: formatDateTime(s.revision_due) })}`
                  : ''}
              </p>
            )}
            <span className="text-caption text-text-2">{formatDateTime(s.created_at)}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function InfoPanel({
  d,
  onExtension,
  onTip,
}: {
  d: TaskDetail;
  onExtension: () => void;
  onTip: () => void;
}) {
  const task = d.task;
  const status = displayStatus(task);
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: task.currency });
  const executor = d.viewer_role === 'executor';
  const sbc = useSupabase();
  const geo = useGeolocation();
  const checkins = useQuery({ queryKey: ['checkins', task.id], queryFn: () => nearby.checkins(sbc, task.id), enabled: task.kind === 'nearby' });
  const [checkinMsg, setCheckinMsg] = useState<string | null>(null);
  const checkin = useApiMutation((s, c: { lat: number; lng: number }) => nearby.checkin(s, task.id, c.lat, c.lng, geo.accuracy), {
    invalidate: () => [['checkins', task.id], keys.messages(task.id)],
    onSuccess: (r) => setCheckinMsg(r.within ? t('room.checkinOk') : t('room.checkinFar', { d: formatDistance(r.distance_m) })),
  });
  useEffect(() => {
    if (geo.coords && checkin.isIdle && geo.state === 'granted' && checkinRequested.current) {
      checkinRequested.current = false;
      checkin.mutate(geo.coords);
    }
  }, [geo.coords, geo.state, checkin]);
  const checkinRequested = useRef(false);
  const ext = d.extension;
  const toast = useToast();
  const decide = useApiMutation(
    (sb, accept: boolean) => work.decideExtension(sb, ext!.id, accept),
    {
      invalidate: () => [keys.task(task.id), keys.messages(task.id)],
      onSuccess: (_r, accept) =>
        toast(accept ? t('event.extension_accepted') : t('event.extension_declined')),
    },
  );
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3">
        <CardHeader title={t('room.info')} />
        <ListGroup>
          <ListRow title={t('task.reward')} value={fmt(task.reward_cents)} />
          <ListRow title={t('room.reserved')} value={fmt(task.reward_cents)} />
          {task.due_at && (
            <ListRow
              title={t('room.deadline')}
              subtitle={formatDateTime(task.due_at)}
              value={
                ['in_progress', 'review'].includes(status) ? formatTimeLeft(task.due_at) : undefined
              }
            />
          )}
          <ListRow
            title={t('task.resultFormat')}
            value={t(`format.${task.result_format}` as TranslationKey)}
          />
        </ListGroup>
        {task.checklist.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-callout font-bold">{t('room.whatToSubmit')}</p>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-callout">
              {task.checklist.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        {d.attachments.length > 0 && <FileList items={d.attachments} />}
        <div className="flex flex-wrap gap-2">
          {task.kind === 'nearby' && task.lat != null && task.lng != null && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${task.lat},${task.lng}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-pill bg-fill px-4 text-callout font-bold"
            >
              <Map size={16} /> {t('room.openMaps')}
            </a>
          )}
          <Link
            href={`/tasks/${task.id}`}
            className="inline-flex h-10 items-center rounded-pill bg-fill px-4 text-callout font-bold"
          >
            {t('room.openTask')}
          </Link>
          {executor && task.kind === 'nearby' && ['in_progress', 'review'].includes(status) && (
            <Button
              size="md"
              onClick={() => {
                if (geo.coords) checkin.mutate(geo.coords);
                else {
                  checkinRequested.current = true;
                  geo.request();
                }
              }}
              disabled={checkin.isPending || geo.state === 'locating'}
            >
              <MapPin size={16} /> {t('room.checkin')}
            </Button>
          )}
        </div>
        {checkinMsg && <p className="text-callout font-semibold" data-testid="checkin-result">{checkinMsg}</p>}
        {checkin.error && <p className="text-callout font-semibold text-danger">{t(checkin.error.key as TranslationKey)}</p>}
        {(checkins.data ?? []).length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-callout font-bold">{t('room.checkins')}</p>
            {checkins.data!.map((c) => (
              <p key={c.id} className={clsx('text-caption', c.within ? 'text-success' : 'text-danger')}>
                {formatDateTime(c.created_at)} · {formatDistance(c.distance_m)}
              </p>
            ))}
          </div>
        )}
      </Card>

      {ext?.status === 'pending' && (
        <Card
          className="flex flex-col gap-3 ring-2 ring-warning/40"
          data-testid="extension-pending"
        >
          <p className="flex items-center gap-2 font-bold">
            <Clock size={18} />{' '}
            {t('room.extensionPending', { m: t(`room.minutes.${ext.minutes}` as TranslationKey) })}
          </p>
          {ext.reason && <p className="text-callout text-text-2">{ext.reason}</p>}
          {!executor && (
            <div className="flex gap-2">
              <Button onClick={() => decide.mutate(true)} disabled={decide.isPending}>
                {t('room.extensionAccept')}
              </Button>
              <Button
                variant="glass"
                onClick={() => decide.mutate(false)}
                disabled={decide.isPending}
              >
                {t('room.extensionDecline')}
              </Button>
            </div>
          )}
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {executor && ['in_progress', 'review'].includes(status) && ext?.status !== 'pending' && (
          <Button variant="glass" onClick={onExtension}>
            <Clock size={18} /> {t('room.extension')}
          </Button>
        )}
        {!executor && ['in_progress', 'review', 'completed'].includes(status) && (
          <Button variant="glass" onClick={onTip}>
            <Coins size={18} /> {t('room.tip')}
          </Button>
        )}
      </div>
      <Versions items={d.submissions} task={task} />
    </div>
  );
}

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const detail = useTaskDetail(id);
  const messages = useRoomMessages(id);
  const sb = useSupabase();
  const qc = useQueryClient();
  const participant =
    detail.data?.viewer_role === 'customer' || detail.data?.viewer_role === 'executor';
  const count = messages.data?.length ?? 0;
  // Открытый чат = прочитанный: обновляем отметку при каждом новом сообщении
  useEffect(() => {
    if (!participant || !detail.data?.task.executor_id) return;
    chats
      .markRead(sb, id)
      .then(() => qc.invalidateQueries({ queryKey: keys.chats }))
      .catch(() => {});
  }, [participant, detail.data?.task.executor_id, count, sb, id, qc]);
  const [text, setText] = useState('');
  const [pending, setPending] = useState<File[]>([]);
  const [sheet, setSheet] = useState<null | 'submit' | 'review' | 'extension' | 'tip'>(null);
  const where = useMemo(() => ({ taskId: id }), [id]);
  const peer = usePeerState(where, participant);
  const readAt = peer?.read_at;
  const ping = useTypingPing(where);
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
  if (
    !d ||
    !(d.viewer_role === 'customer' || d.viewer_role === 'executor') ||
    !d.task.executor_id
  ) {
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
          <Button
            variant="glass"
            size="icon"
            aria-label={t('common.back')}
            onClick={() => router.push(`/tasks/${id}`)}
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Button>
        }
      />
      <main className="mx-auto grid max-w-[var(--p-content-max)] gap-6 px-[var(--p-gutter)] pt-2 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="card flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
              <p className="text-caption uppercase tracking-wide text-text-2">{t('room.title')}</p>
              <h1 className="truncate text-title3 font-bold">{task.title}</h1>
              {peer?.typing && (
                <p className="text-callout font-semibold text-success" data-testid="typing">
                  {(d.viewer_role === 'customer' ? d.executor?.first_name : d.customer.first_name) ?? ''} {t('direct.typing')}
                </p>
              )}
              {task.due_at && active && (
                <p className="text-callout font-semibold text-text-2">
                  {t('room.deadline')}: {formatDateTime(task.due_at)} ·{' '}
                  {formatTimeLeft(task.due_at)}
                </p>
              )}
            </div>
            <StatusBadge status={status} />
            {d.viewer_role === 'executor' && status === 'in_progress' && (
              <Button onClick={() => setSheet('submit')}>{t('task.submitWork')}</Button>
            )}
            {d.viewer_role === 'customer' && status === 'review' && latest && (
              <Button onClick={() => setSheet('review')}>{t('task.review')}</Button>
            )}
          </div>

          <section
            aria-label={t('room.title')}
            aria-live="polite"
            className="flex min-h-[40vh] flex-col gap-3 pb-40 md:pb-28"
          >
            {messages.isLoading ? (
              <CenterSpinner />
            ) : (
              (messages.data ?? []).map((m) => (
                <Bubble
                  key={m.id}
                  m={m}
                  mine={m.sender_id === uid}
                  read={!!readAt && new Date(readAt) >= new Date(m.created_at)}
                />
              ))
            )}
            <div ref={endRef} />
          </section>
        </div>
        <aside className="order-first lg:order-none">
          <details className="group lg:hidden">
            <summary className="card cursor-pointer list-none p-4 font-bold">
              {t('room.info')}
            </summary>
            <div className="pt-3">
              <InfoPanel
                d={d}
                onExtension={() => setSheet('extension')}
                onTip={() => setSheet('tip')}
              />
            </div>
          </details>
          <div className="sticky top-24 hidden lg:block">
            <InfoPanel
              d={d}
              onExtension={() => setSheet('extension')}
              onTip={() => setSheet('tip')}
            />
          </div>
        </aside>
      </main>

      <div className="fixed inset-x-0 bottom-[92px] z-30 px-[var(--p-gutter)] md:bottom-4 md:pl-[calc(var(--p-sidebar-width)+16px)]">
        <div className="mx-auto max-w-[var(--p-content-max)] md:px-8 lg:pr-[392px]">
          {active ? (
            <Glass as="form" radius="2xl" onSubmit={submit} className="flex flex-col gap-2 p-2">
              {pending.length > 0 && (
                <div className="flex flex-wrap gap-2 px-2 pt-1">
                  {pending.map((f, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-pill bg-separator px-3 py-1 text-caption"
                    >
                      {f.name}
                      <button
                        type="button"
                        aria-label={t('common.remove')}
                        onClick={() => setPending(pending.filter((_, j) => j !== i))}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <label
                  className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-pill text-text hover:bg-separator"
                  aria-label={t('room.attach')}
                >
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
                  onChange={(e) => {
                    setText(e.target.value);
                    ping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) submit(e);
                  }}
                  className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-body outline-none placeholder:text-text-2"
                />
                <Button
                  type="submit"
                  size="icon"
                  aria-label={t('common.send')}
                  disabled={send.isPending || (!text.trim() && !pending.length)}
                >
                  <ArrowUp size={20} strokeWidth={2.8} />
                </Button>
              </div>
              {send.error && (
                <p className="px-3 text-callout font-semibold text-danger">
                  {t(send.error.key as TranslationKey)}
                </p>
              )}
            </Glass>
          ) : (
            <Glass
              radius="pill"
              className="px-5 py-3 text-center text-callout font-semibold text-text-2"
            >
              {t('room.readonly')}
            </Glass>
          )}
        </div>
      </div>

      {sheet === 'submit' && <SubmitSheet open onClose={() => setSheet(null)} task={task} />}
      {sheet === 'review' && latest && (
        <ReviewSheet open onClose={() => setSheet(null)} task={task} submission={latest} />
      )}
      {sheet === 'extension' && <ExtensionSheet taskId={task.id} onClose={() => setSheet(null)} />}
      {sheet === 'tip' && <TipSheet d={d} onClose={() => setSheet(null)} />}
    </>
  );
}
