import {
  displayStatus,
  formatDateTime,
  formatMoney,
  formatTimeLeft,
  responses,
  shortName,
  t,
  tasks,
  type TaskDetail,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation, useTaskDetail } from '@parri/shared/react';
import { router, useLocalSearchParams } from 'expo-router';
import { Clock, GraduationCap, Globe, MapPin, MessagesSquare, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { FileList } from '@/components/task/FileList';
import { ConfirmSheet, RespondSheet, ReviewSheet, SubmitSheet } from '@/components/task/Sheets';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { Avatar, Card, Center, EmptyState, Pill, Row, SectionTitle, StatusBadge, useToast } from '@/components/ui/bits';
import { useTheme } from '@/theme/ThemeProvider';

type SheetKind = null | 'respond' | 'cancel' | 'withdraw' | 'submit' | 'review';

function Actions({ d, open }: { d: TaskDetail; open: (s: SheetKind) => void }) {
  const toast = useToast();
  const { colors } = useTheme();
  const task = d.task;
  const status = displayStatus(task);
  const republish = useApiMutation((sb) => tasks.republish(sb, task.id), {
    invalidate: () => [keys.task(task.id), keys.me, ['my-tasks'], ['feed']],
    onSuccess: () => toast(t('task.republished')),
  });
  const room = (
    <Button
      variant="glass"
      block
      label={t('task.room')}
      icon={<MessagesSquare size={18} color={colors.text} />}
      onPress={() => router.push(`/task/${task.id}/room`)}
    />
  );

  if (d.viewer_role === 'customer') {
    if (status === 'open')
      return (
        <View style={{ gap: 10 }}>
          <Button
            block
            label={`${t('task.responses')} · ${task.response_count}`}
            icon={<Users size={18} color={colors.onAccent} />}
            onPress={() => router.push(`/task/${task.id}/responses`)}
          />
          <Button variant="glass" block label={t('task.cancel')} onPress={() => open('cancel')} />
        </View>
      );
    if (status === 'archived' && (task.archive_reason === 'expired' || task.expired))
      return <Button block label={`${t('task.republish')} · ${formatMoney(task.reward_cents + task.fee_cents)}`} disabled={republish.isPending} onPress={() => republish.mutate(undefined)} />;
    if (status === 'review' && d.submissions[0])
      return (
        <View style={{ gap: 10 }}>
          <Button block label={t('task.review')} onPress={() => open('review')} />
          {room}
        </View>
      );
    return task.executor_id ? room : null;
  }
  if (d.viewer_role === 'executor') {
    return (
      <View style={{ gap: 10 }}>
        {status === 'in_progress' && <Button block label={t('task.submitWork')} onPress={() => open('submit')} />}
        {room}
      </View>
    );
  }
  if (d.my_response) {
    const r = d.my_response;
    return (
      <Card>
        <AppText variant="callout" color="textSecondary">
          {t('task.yourResponse')}: {formatMoney(r.price_cents)} · {t(`deadline.${r.deadline}`)} · {t(`responseStatus.${r.status}` as TranslationKey)}
        </AppText>
        {status === 'open' && r.status === 'pending' && (
          <Row>
            <Button variant="glass" label={t('task.editResponse')} onPress={() => open('respond')} />
            <Button variant="glass" label={t('task.withdraw')} onPress={() => open('withdraw')} />
          </Row>
        )}
        {status === 'open' && r.status === 'withdrawn' && <Button label={t('task.respond')} onPress={() => open('respond')} />}
      </Card>
    );
  }
  return status === 'open' ? <Button size="lg" block label={t('task.respond')} onPress={() => open('respond')} /> : null;
}

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: d, isLoading, refetch } = useTaskDetail(id);
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

  if (isLoading) return <Screen title="" leading={<BackButton />}><Center /></Screen>;
  if (!d) return <Screen title="" leading={<BackButton />}><EmptyState title={t('task.notFound')} /></Screen>;

  const task = d.task;
  const status = displayStatus(task);
  const KindIcon = task.kind === 'online' ? Globe : task.kind === 'nearby' ? MapPin : GraduationCap;
  const kindLabel = task.kind === 'nearby' ? [t('kind.nearby'), task.place_name].filter(Boolean).join(' · ') : task.kind === 'campus' ? d.university?.name ?? t('kind.campus') : t('kind.online');
  const isParticipant = d.viewer_role === 'customer' || d.viewer_role === 'executor';
  const meta = (Icon: typeof Clock, text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon size={16} strokeWidth={2.4} color={colors.textSecondary} />
      <AppText variant="callout" color="textSecondary">
        {text}
      </AppText>
    </View>
  );

  return (
    <Screen
      title={task.title}
      leading={<BackButton />}
      onRefresh={() => refetch()}
      overlay={
        <>
          {sheet === 'respond' && <RespondSheet open onClose={close} task={task} existing={d.my_response} />}
          {sheet === 'submit' && <SubmitSheet open onClose={close} task={task} />}
          {sheet === 'review' && d.submissions[0] && <ReviewSheet open onClose={close} task={task} submission={d.submissions[0]} />}
          <ConfirmSheet open={sheet === 'cancel'} onClose={close} title={t('task.cancel')} text={t('task.cancelConfirm')} confirmLabel={t('task.cancel')} onConfirm={() => cancel.mutate(undefined)} busy={cancel.isPending} error={cancel.error?.key} />
          <ConfirmSheet open={sheet === 'withdraw'} onClose={close} title={t('task.withdraw')} confirmLabel={t('task.withdraw')} onConfirm={() => d.my_response && withdraw.mutate(d.my_response.id)} busy={withdraw.isPending} error={withdraw.error?.key} />
        </>
      }
    >
      <Row>
        <StatusBadge status={status} />
        <Pill>{t(`category.${task.category}`)}</Pill>
        <Pill>{t(`format.${task.result_format}`)}</Pill>
      </Row>
      <View style={{ gap: 8 }}>
        <AppText variant="price" color="accentText" tabular>
          {formatMoney(task.reward_cents)}
        </AppText>
        <AppText variant="title2" accessibilityRole="header">
          {task.title}
        </AppText>
        {meta(KindIcon, kindLabel + (task.radius_m ? ` · ${task.radius_m} м` : ''))}
        {meta(Clock, t(`deadline.${task.deadline}`))}
        {status === 'open' && meta(Clock, t('task.expires', { date: formatDateTime(task.expires_at) }))}
        {task.due_at && ['in_progress', 'review'].includes(status) && meta(Clock, `${t('task.due', { date: formatDateTime(task.due_at) })} · ${formatTimeLeft(task.due_at)}`)}
        {status === 'archived' && task.archive_reason && (
          <AppText variant="callout" color="textSecondary">
            {t(`task.archived_${task.archive_reason}`)}
          </AppText>
        )}
      </View>

      <Actions d={d} open={setSheet} />

      <Card>
        <SectionTitle>{t('task.description')}</SectionTitle>
        <AppText variant="body">{task.description || task.brief}</AppText>
      </Card>
      {task.checklist.length > 0 && (
        <Card>
          <SectionTitle>{t('task.checklist')}</SectionTitle>
          {task.checklist.map((c, i) => (
            <AppText key={i} variant="body">
              {i + 1}. {c}
            </AppText>
          ))}
        </Card>
      )}
      {d.attachments.length > 0 && (
        <View style={{ gap: 10 }}>
          <SectionTitle>{t('task.attachments')}</SectionTitle>
          <FileList items={d.attachments} />
        </View>
      )}

      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={shortName(d.customer.first_name, d.customer.last_name)} url={d.customer.avatar_url} />
        <View style={{ flex: 1 }}>
          <AppText variant="caption" color="textSecondary">
            {t('task.customer')}
          </AppText>
          <AppText variant="bodyStrong">{shortName(d.customer.first_name, d.customer.last_name)}</AppText>
        </View>
      </Card>
      {d.executor && (
        <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar name={shortName(d.executor.first_name, d.executor.last_name)} url={d.executor.avatar_url} />
          <View style={{ flex: 1 }}>
            <AppText variant="caption" color="textSecondary">
              {t('task.executor')}
            </AppText>
            <AppText variant="bodyStrong">{shortName(d.executor.first_name, d.executor.last_name)}</AppText>
          </View>
        </Card>
      )}
      {d.viewer_role === 'customer' && ['open', 'in_progress', 'review', 'disputed'].includes(status) && (
        <Card>
          <AppText variant="caption" color="textSecondary" style={{ textTransform: 'uppercase' }}>
            {t('safe.name')}
          </AppText>
          <AppText variant="title2" tabular>
            {formatMoney(task.reward_cents + task.fee_cents)}
          </AppText>
          <AppText variant="callout" color="textSecondary">
            {t('safe.hint')}
          </AppText>
        </Card>
      )}
      {isParticipant && d.submissions.length > 0 && (
        <View style={{ gap: 10 }}>
          <SectionTitle>{t('task.versions')}</SectionTitle>
          {d.submissions.map((s) => (
            <Card key={s.id}>
              <AppText variant="bodyStrong">
                {t('task.version', { n: s.version })} · {t(`submissionStatus.${s.status}` as TranslationKey)}
              </AppText>
              {s.link ? (
                <AppText variant="body" color="accentText" onPress={() => s.link && Linking.openURL(s.link)}>
                  {s.link}
                </AppText>
              ) : null}
              {s.comment ? <AppText variant="body">{s.comment}</AppText> : null}
              {s.files.length > 0 && <FileList items={s.files} />}
              {s.review_comment ? (
                <AppText variant="callout" color="textSecondary">
                  {t('task.revisionComment')}: {s.review_comment}
                </AppText>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
