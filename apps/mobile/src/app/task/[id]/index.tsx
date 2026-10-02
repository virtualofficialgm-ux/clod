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
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import {
  Bookmark,
  BookmarkCheck,
  CircleCheck,
  CircleHelp,
  Clock,
  Flag,
  GraduationCap,
  Globe,
  MapPin,
  MessagesSquare,
  Play,
  Repeat,
  Share2,
  ShieldCheck,
  Star,
  Users,
  Zap,
} from '@/components/icons';
import { categoryIcon } from '@/components/task/categoryIcon';
import { FileList } from '@/components/task/FileList';
import { RateSheet, ReportSheet, ShareSheet, TakeSheet } from '@/components/task/MoreSheets';
import { ConfirmSheet, RespondSheet } from '@/components/task/Sheets';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { Avatar, Center, EmptyState, Pill, Row, StatusBadge, useToast } from '@/components/ui/bits';
import { BigNumber, Card, CardHeader, ListGroup, ListRow, ProgressBar } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

type SheetKind =
  null | 'respond' | 'take' | 'share' | 'report' | 'rate' | 'cancel' | 'withdraw' | 'refuse';
const fmt = (d: TaskDetail, c: number) => formatMoney(c, 'ru-RU', { currency: d.task.currency });

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** «Задача ваша!»: этапы, начать за 25 минут, рабочая комната, отказ */
function YoursPanel({ d, onRefuse }: { d: TaskDetail; onRefuse: () => void }) {
  const { colors } = useTheme();
  const now = useNow();
  const task = d.task;
  const status = displayStatus(task);
  const stage = status === 'completed' ? 3 : status === 'review' ? 2 : task.started_at ? 1 : 0;
  const left = d.start_deadline ? new Date(d.start_deadline).getTime() - now : null;
  const start = useApiMutation((sb) => work.start(sb, task.id), {
    invalidate: () => [keys.task(task.id), ['my-tasks']],
  });
  const stages = ['taken', 'doing', 'sent', 'paid'] as const;
  return (
    <Card testID="yours-panel" style={{ borderWidth: 2, borderColor: colors.accent }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Zap size={22} color={colors.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="title3">{t('task.yoursTitle')}</AppText>
          <AppText variant="callout" color="textSecondary">
            {task.started_at
              ? t('task.yoursStarted', { date: task.due_at ? formatDateTime(task.due_at) : '—' })
              : t('task.yoursText', { m: 25 })}
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {stages.map((s, i) => (
          <View key={s} style={{ flex: 1, gap: 4 }}>
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: i <= stage ? colors.accent : colors.fill,
              }}
            />
            <AppText
              variant="caption"
              color={i <= stage ? 'text' : 'textSecondary'}
              numberOfLines={1}
            >
              {t(`task.stages.${s}`)}
            </AppText>
          </View>
        ))}
      </View>
      {status === 'in_progress' && !task.started_at && (
        <Button
          size="lg"
          block
          icon={<Play size={18} color={colors.onAccent} />}
          label={`${t('task.start')}${left != null && left > 0 ? ` · ${t('task.startLeft', { left: formatDuration(left) })}` : ''}`}
          disabled={start.isPending || (left != null && left <= 0)}
          onPress={() => start.mutate(undefined)}
        />
      )}
      <Button
        variant={task.started_at ? 'primary' : 'glass'}
        block
        icon={<MessagesSquare size={18} color={task.started_at ? colors.onAccent : colors.text} />}
        label={t('task.openRoom')}
        onPress={() => router.push(`/task/${task.id}/room`)}
      />
      {status === 'in_progress' && (
        <Button variant="glass" block label={t('task.refuse')} onPress={onRefuse} />
      )}
      {start.error ? (
        <AppText variant="callout" color="danger">
          {t(start.error.key as TranslationKey)}
        </AppText>
      ) : null}
    </Card>
  );
}

function CompletedPanel({ d, onRate }: { d: TaskDetail; onRate: () => void }) {
  const { colors } = useTheme();
  const task = d.task;
  const executor = d.viewer_role === 'executor';
  const spent =
    task.completed_at && task.assigned_at
      ? new Date(task.completed_at).getTime() - new Date(task.assigned_at).getTime()
      : null;
  return (
    <Card>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <CircleCheck size={28} color={colors.success} />
        <AppText variant="title3">{t('task.completedTitle')}</AppText>
      </View>
      {executor && (
        <BigNumber
          value={`+${fmt(d, task.reward_cents)}`}
          label={t('task.completedText', { sum: fmt(d, task.reward_cents) })}
        />
      )}
      <ListGroup>
        {spent != null ? (
          <ListRow title={t('task.timeSpent')} value={formatDuration(spent)} />
        ) : null}
        {d.my_review ? (
          <ListRow title={t('rate.yourReview')} value={`★ ${d.my_review.rating}`} />
        ) : null}
      </ListGroup>
      {!d.my_review && (
        <Button
          block
          icon={<Star size={18} color={colors.onAccent} />}
          label={t('rate.leave')}
          onPress={onRate}
        />
      )}
      {executor ? (
        <Button
          variant="glass"
          block
          label={t('task.nextTask')}
          onPress={() => router.push('/feed')}
        />
      ) : (
        <Button
          variant="glass"
          block
          icon={<Repeat size={18} color={colors.text} />}
          label={t('task.repeat')}
          onPress={() => router.push(`/task/new?repeat=${task.id}`)}
        />
      )}
    </Card>
  );
}

function Actions({ d, open }: { d: TaskDetail; open: (s: SheetKind) => void }) {
  const toast = useToast();
  const { colors } = useTheme();
  const task = d.task;
  const status = displayStatus(task);
  const republish = useApiMutation((sb) => tasks.republish(sb, task.id), {
    invalidate: () => [keys.task(task.id), keys.me, ['my-tasks'], ['feed']],
    onSuccess: () => toast(t('task.republished')),
  });

  if (d.viewer_role === 'customer') {
    if (status === 'open')
      return (
        <View style={{ gap: 10 }}>
          <Button
            block
            label={`${t('task.viewResponses')} · ${task.response_count}`}
            icon={<Users size={18} color={colors.onAccent} />}
            onPress={() => router.push(`/task/${task.id}/responses`)}
          />
          <Button variant="glass" block label={t('task.cancel')} onPress={() => open('cancel')} />
        </View>
      );
    if (status === 'archived')
      return (
        <Button
          block
          label={`${t('task.republish')} · ${fmt(d, task.reward_cents + task.fee_cents)}`}
          disabled={republish.isPending}
          onPress={() => republish.mutate(undefined)}
        />
      );
    if (['in_progress', 'review', 'disputed'].includes(status))
      return (
        <Button
          block
          label={status === 'review' ? t('task.review') : t('task.room')}
          icon={<MessagesSquare size={18} color={colors.onAccent} />}
          onPress={() => router.push(`/task/${task.id}/room`)}
        />
      );
    return null;
  }
  if (d.viewer_role === 'candidate' && d.my_response) {
    const r = d.my_response;
    return (
      <Card>
        <Pressable accessibilityRole="link" onPress={() => router.push(`/response/${r.id}`)}>
          <AppText variant="bodyStrong">
            {t('task.yourResponse')}: {fmt(d, r.price_cents)} · {t(`deadline.${r.deadline}`)}
          </AppText>
          <AppText variant="callout" color="accentText">
            {t('task.viewResponse')} →
          </AppText>
        </Pressable>
        {status === 'open' && r.status === 'pending' && (
          <Row>
            <Button
              variant="glass"
              label={t('task.editResponse')}
              onPress={() => open('respond')}
            />
            <Button variant="glass" label={t('task.withdraw')} onPress={() => open('withdraw')} />
          </Row>
        )}
        {status === 'open' && r.status === 'withdrawn' && (
          <Button label={t('task.respond')} onPress={() => open('respond')} />
        )}
      </Card>
    );
  }
  if (status !== 'open' || d.viewer_role !== 'visitor') return null;
  return (
    <View style={{ gap: 10 }}>
      <Button
        size="lg"
        block
        testID="take"
        icon={<Zap size={18} color={colors.onAccent} />}
        label={t('task.take')}
        disabled={d.takes_left <= 0}
        onPress={() => open('take')}
      />
      <Button
        size="lg"
        variant="glass"
        block
        label={t('task.respondOwn')}
        onPress={() => open('respond')}
      />
      <AppText variant="caption" color="textSecondary">
        {t('task.takeHint')} {t('task.takesLeft', { n: Math.max(0, d.takes_left) })}
      </AppText>
    </View>
  );
}

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: d, isLoading, refetch } = useTaskDetail(id);
  const me = useMe();
  const { colors } = useTheme();
  const toast = useToast();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const close = () => setSheet(null);
  const cancel = useApiMutation((sb) => tasks.cancel(sb, id!), {
    invalidate: () => [keys.task(id!), keys.me, ['my-tasks'], ['feed']],
    onSuccess: () => {
      toast(t('task.cancelled'));
      close();
    },
  });
  const withdraw = useApiMutation((sb, rid: string) => responses.withdraw(sb, rid), {
    invalidate: () => [keys.task(id!), ['my-tasks'], ['feed']],
    onSuccess: () => {
      toast(t('task.withdrawn'));
      close();
    },
  });
  const refuse = useApiMutation((sb) => work.refuse(sb, id!), {
    invalidate: () => [keys.task(id!), ['my-tasks'], ['feed']],
    onSuccess: () => {
      toast(t('task.refused'));
      close();
      router.replace('/feed');
    },
  });
  const bookmark = useApiMutation((sb, on: boolean) => taskExtras.bookmark(sb, id!, on), {
    invalidate: () => [keys.task(id!), ['feed']],
    onSuccess: (_r, on) => toast(on ? t('feed.bookmarked') : t('feed.unsave')),
  });

  if (isLoading)
    return (
      <Screen title="" leading={<BackButton />}>
        <Center />
      </Screen>
    );
  if (!d)
    return (
      <Screen title="" leading={<BackButton />}>
        <EmptyState
          title={t('task.notAvailable')}
          text={t('task.notFound')}
          action={<Button label={t('task.backToFeed')} onPress={() => router.replace('/feed')} />}
        />
      </Screen>
    );

  const task = d.task;
  const status = displayStatus(task);
  const KindIcon = task.kind === 'online' ? Globe : task.kind === 'nearby' ? MapPin : GraduationCap;
  const CatIcon = categoryIcon(task.category);
  const kindLabel =
    task.kind === 'nearby'
      ? [t('kind.nearby'), task.place_name, task.radius_m ? `${task.radius_m} м` : null]
          .filter(Boolean)
          .join(' · ')
      : task.kind === 'campus'
        ? [d.university?.name ?? t('kind.campus'), task.campus_building].filter(Boolean).join(' · ')
        : t('kind.online');
  const isParticipant = d.viewer_role === 'customer' || d.viewer_role === 'executor';
  const customerName = shortName(d.customer.first_name, d.customer.last_name);
  const left =
    task.due_at && ['in_progress', 'review'].includes(status)
      ? formatTimeLeft(task.due_at)
      : status === 'open'
        ? formatTimeLeft(task.expires_at)
        : null;
  const details: [string, string][] = [
    [t('task.resultFormat'), t(`format.${task.result_format}` as TranslationKey)],
    [t('create.deadline'), t(`deadline.${task.deadline}`)],
    ...(task.language
      ? [[t('task.language'), languageName(task.language)] as [string, string]]
      : []),
    ...(task.required_level
      ? [[t('task.level'), t(`onb.exp.${task.required_level}`)] as [string, string]]
      : []),
    ...(task.proofs.length
      ? [
          [
            t('task.proofs'),
            task.proofs.map((p) => t(`create.proofs.${p}` as TranslationKey)).join(', '),
          ] as [string, string],
        ]
      : []),
    ...(task.visit_window ? [[t('task.visitWindow'), task.visit_window] as [string, string]] : []),
  ];
  const history: [string, string | null][] = [
    [t('task.h_published'), task.published_at],
    [t('task.h_assigned'), task.assigned_at],
    [
      t('task.h_submitted'),
      d.submissions.length ? d.submissions[d.submissions.length - 1]!.created_at : null,
    ],
    [t('task.h_completed'), task.completed_at],
  ];

  return (
    <Screen
      title={task.title}
      leading={<BackButton />}
      actions={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            variant="glass"
            size="icon"
            accessibilityLabel={d.bookmarked ? t('feed.unsave') : t('task.save')}
            icon={
              d.bookmarked ? (
                <BookmarkCheck size={20} color={colors.accent} />
              ) : (
                <Bookmark size={20} color={colors.text} />
              )
            }
            onPress={() => bookmark.mutate(!d.bookmarked)}
          />
          <Button
            variant="glass"
            size="icon"
            accessibilityLabel={t('task.share')}
            icon={<Share2 size={20} color={colors.text} />}
            onPress={() => setSheet('share')}
          />
          {d.viewer_role !== 'customer' && (
            <Button
              variant="glass"
              size="icon"
              accessibilityLabel={t('task.report')}
              icon={<Flag size={20} color={colors.text} />}
              onPress={() => setSheet('report')}
            />
          )}
        </View>
      }
      onRefresh={() => refetch()}
      overlay={
        <>
          {sheet === 'respond' && (
            <RespondSheet open onClose={close} task={task} existing={d.my_response} />
          )}
          <TakeSheet
            task={
              sheet === 'take'
                ? {
                    id: task.id,
                    title: task.title,
                    reward_cents: task.reward_cents,
                    currency: task.currency,
                  }
                : null
            }
            takesLeft={d.takes_left}
            pro={me.data?.profile.plan === 'pro'}
            onClose={close}
          />
          <ShareSheet
            open={sheet === 'share'}
            onClose={close}
            taskId={task.id}
            title={task.title}
          />
          <ReportSheet open={sheet === 'report'} onClose={close} taskId={task.id} />
          {sheet === 'rate' && <RateSheet d={d} onClose={close} />}
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
          <ConfirmSheet
            open={sheet === 'refuse'}
            onClose={close}
            title={t('task.refuseTitle')}
            text={task.started_at ? t('task.refuseAfter') : t('task.refuseBefore')}
            confirmLabel={t('task.refuse')}
            onConfirm={() => refuse.mutate(undefined)}
            busy={refuse.isPending}
            error={refuse.error?.key}
          />
        </>
      }
    >
      <Row>
        <StatusBadge status={status} />
        <Pill>
          <CatIcon size={13} color={colors.textSecondary} /> {t(`category.${task.category}`)}
        </Pill>
      </Row>
      <View style={{ gap: 8 }}>
        <AppText variant="title2" accessibilityRole="header">
          {task.title}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <KindIcon size={16} color={colors.textSecondary} />
          <AppText variant="callout" color="textSecondary" style={{ flex: 1 }}>
            {kindLabel}
          </AppText>
        </View>
        <AppText variant="caption" color="textSecondary">
          {t('task.id')}: {task.id.slice(0, 8)} · {t('task.posted')}{' '}
          {formatDateTime(task.published_at)}
        </AppText>
      </View>

      <Card>
        <AppText variant="caption" color="textSecondary" style={{ textTransform: 'uppercase' }}>
          {t('task.budget')}
        </AppText>
        <AppText variant="number" tabular>
          {fmt(d, task.reward_cents)}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={16} color={colors.success} />
          <AppText variant="callout" color="success">
            {t('feed.safeDeal')} · {t('feed.reserved')}
          </AppText>
        </View>
        {left ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Clock size={16} color={colors.text} />
            <AppText variant="callout">{t('task.deadlineLeft', { left })}</AppText>
          </View>
        ) : null}
        {task.due_at && task.assigned_at && ['in_progress', 'review'].includes(status) ? (
          <ProgressBar
            value={
              (Date.now() - new Date(task.assigned_at).getTime()) /
              (new Date(task.due_at).getTime() - new Date(task.assigned_at).getTime())
            }
            label={t('create.deadline')}
          />
        ) : null}
        <AppText variant="callout" color="textSecondary">
          {t('task.proposals', { n: task.response_count })}
        </AppText>
      </Card>

      {d.viewer_role === 'executor' && ['in_progress', 'review'].includes(status) && (
        <YoursPanel d={d} onRefuse={() => setSheet('refuse')} />
      )}
      {status === 'completed' && isParticipant && (
        <CompletedPanel d={d} onRate={() => setSheet('rate')} />
      )}

      <Actions d={d} open={setSheet} />

      <Card>
        <CardHeader title={t('task.description')} />
        <AppText variant="body">{task.description || task.brief}</AppText>
        <ListGroup>
          {details.map(([k, v]) => (
            <ListRow key={k} title={k} value={v} />
          ))}
        </ListGroup>
        {task.skills.length > 0 && (
          <Row>
            {task.skills.map((s) => (
              <Pill key={s}>{t(`skill.${s}` as TranslationKey)}</Pill>
            ))}
          </Row>
        )}
      </Card>
      {task.checklist.length > 0 && (
        <Card>
          <CardHeader title={t('task.criteria')} />
          {task.checklist.map((c, i) => (
            <AppText key={i} variant="body">
              {i + 1}. {c}
            </AppText>
          ))}
        </Card>
      )}
      {d.attachments.length > 0 && (
        <Card>
          <CardHeader title={t('task.materials')} />
          <FileList items={d.attachments} />
        </Card>
      )}
      <ListGroup>
        <ListRow
          icon={(c) => <CircleHelp size={18} color={c} />}
          title={t('task.questionsN', { n: d.questions_count })}
          onPress={() => router.push(`/task/${task.id}/questions`)}
        />
      </ListGroup>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={customerName} url={d.customer.avatar_url} size={52} />
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color="textSecondary">
              {t('task.customer')}
            </AppText>
            <AppText variant="bodyStrong">{customerName}</AppText>
            <AppText variant="callout" color="textSecondary">
              {d.customer.rating_avg
                ? `★ ${Number(d.customer.rating_avg).toFixed(1)} · ${d.customer.rating_count}`
                : t('responses.noRating')}
            </AppText>
          </View>
        </View>
        <AppText variant="callout" color="textSecondary">
          {t('task.customerStats', {
            done: d.customer.customer_completed,
            open: d.customer.customer_open,
          })}
        </AppText>
      </Card>
      {d.executor && (
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar
            name={shortName(d.executor.first_name, d.executor.last_name)}
            url={d.executor.avatar_url}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color="textSecondary">
              {t('task.executor')}
            </AppText>
            <AppText variant="bodyStrong">
              {shortName(d.executor.first_name, d.executor.last_name)}
            </AppText>
          </View>
        </Card>
      )}
      <Card>
        <CardHeader title={t('task.history')} />
        {history
          .filter(([, at]) => at)
          .map(([label, at]) => (
            <View key={label} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  marginTop: 6,
                  backgroundColor: colors.accent,
                }}
              />
              <View>
                <AppText variant="bodyStrong">{label}</AppText>
                <AppText variant="caption" color="textSecondary">
                  {formatDateTime(at!)}
                </AppText>
              </View>
            </View>
          ))}
      </Card>
      {status === 'disputed' && d.dispute ? (
        <Card>
          <AppText variant="bodyStrong" color="danger">
            {t('task.disputed')}
          </AppText>
          <AppText variant="callout">{d.dispute.reason}</AppText>
        </Card>
      ) : null}
    </Screen>
  );
}
