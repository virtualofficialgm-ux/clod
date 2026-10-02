import { displayStatus, formatDateTime, formatMoney, formatTimeLeft, t, tasks, type MyTask, type TranslationKey } from '@parri/shared';
import { keys, useApiMutation, useMyTasks } from '@parri/shared/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Segmented } from '@/components/glass/Segmented';
import { Screen } from '@/components/ui/Screen';
import { Card, Center, EmptyState, PageTitle, StatusBadge, useToast } from '@/components/ui/bits';

type Role = 'executor' | 'customer';
const ORDER = ['review', 'in_progress', 'disputed', 'open', 'completed', 'archived'];

function Row({ task, role }: { task: MyTask; role: Role }) {
  const toast = useToast();
  const status = displayStatus(task);
  const expired = task.expired || task.archive_reason === 'expired';
  const republish = useApiMutation((sb) => tasks.republish(sb, task.id), {
    invalidate: () => [keys.mine('customer'), keys.me, ['feed']],
    onSuccess: () => toast(t('task.republished')),
  });
  const sub =
    status === 'open' && role === 'customer'
      ? t('task.responsesCount', { n: task.response_count })
      : ['in_progress', 'review'].includes(status) && task.due_at
        ? formatTimeLeft(task.due_at)
        : status === 'completed' && task.completed_at
          ? formatDateTime(task.completed_at)
          : status === 'archived'
            ? t(expired ? 'task.archived_expired' : 'task.archived_cancelled')
            : '';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={task.title} onPress={() => router.push(`/task/${task.id}`)}>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <StatusBadge status={status} />
          <AppText variant="title3" color="accentText" tabular>
            {formatMoney(task.reward_cents)}
          </AppText>
        </View>
        <AppText variant="bodyStrong">{task.title}</AppText>
        <AppText variant="callout" color="textSecondary">
          {[sub, task.counterpart_name, role === 'executor' && task.my_response_status && task.my_response_status !== 'accepted' ? t(`responseStatus.${task.my_response_status}` as TranslationKey) : null]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
        {role === 'customer' && status === 'archived' && expired && (
          <Button variant="glass" label={t('task.republish')} disabled={republish.isPending} onPress={() => republish.mutate(undefined)} />
        )}
      </Card>
    </Pressable>
  );
}

export default function MyTasks() {
  const [role, setRole] = useState<Role>('executor');
  const q = useMyTasks(role);
  const sorted = [...(q.data ?? [])].sort((a, b) => ORDER.indexOf(displayStatus(a)) - ORDER.indexOf(displayStatus(b)));
  return (
    <Screen title={t('my.title')} tabBar onRefresh={() => q.refetch()}>
      <PageTitle>{t('my.title')}</PageTitle>
      <Segmented
        value={role}
        onChange={setRole}
        options={[
          { value: 'executor', label: t('my.doing') },
          { value: 'customer', label: t('my.mine') },
        ]}
      />
      {q.isLoading ? (
        <Center />
      ) : sorted.length === 0 ? (
        <EmptyState
          title={role === 'executor' ? t('my.emptyDoing') : t('my.emptyMine')}
          action={
            role === 'executor' ? (
              <Button label={t('my.findTasks')} onPress={() => router.navigate('/feed')} />
            ) : (
              <Button label={t('my.create')} onPress={() => router.push('/task/new')} />
            )
          }
        />
      ) : (
        <View style={{ gap: 12 }} testID="my-tasks">
          {sorted.map((task) => (
            <Row key={task.id} task={task} role={role} />
          ))}
        </View>
      )}
    </Screen>
  );
}
