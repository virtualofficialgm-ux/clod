import {
  MY_TABS,
  displayStatus,
  formatDateTime,
  formatMoney,
  formatTimeLeft,
  myTaskNext,
  myTaskProgress,
  myTaskTab,
  t,
  taskExtras,
  tasks,
  type MyRole,
  type MyTab,
  type MyTask,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation, useMyTasks, useSupabase, useTaskDrafts } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import { FileText, Trash2 } from '@/components/icons';
import { categoryIcon } from '@/components/task/categoryIcon';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Center, EmptyState, PageTitle, StatusBadge, useToast } from '@/components/ui/bits';
import { Card, ProgressBar, StatTile } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

type Sort = 'new' | 'deadline' | 'pay';

function nextHref(task: MyTask, role: MyRole) {
  const { action, target } = myTaskNext(task, role);
  const page = `/task/${task.id}`;
  const href = {
    page,
    room: `${page}/room`,
    responses: `${page}/responses`,
    repeat: `/task/new?repeat=${task.id}`,
  }[target];
  return { label: t(`my.actions.${action}`), href, primary: !['open', 'repeat'].includes(action) };
}

function Row({ task, role }: { task: MyTask; role: MyRole }) {
  const toast = useToast();
  const { colors } = useTheme();
  const status = displayStatus(task);
  const expired = task.expired || task.archive_reason === 'expired';
  const Icon = categoryIcon(task.category);
  const fmt = (c: number) => formatMoney(c, 'ru-RU', { currency: task.currency });
  const republish = useApiMutation((sb) => tasks.republish(sb, task.id), {
    invalidate: () => [keys.mine('customer'), keys.me, ['feed']],
    onSuccess: () => toast(t('task.republished')),
  });
  const progress = ['in_progress', 'review'].includes(status) ? myTaskProgress(task) : null;
  const next = nextHref(task, role);
  const sub = [
    status === 'open' && role === 'customer'
      ? t('task.responsesCount', { n: task.response_count })
      : null,
    progress != null && task.due_at ? formatTimeLeft(task.due_at) : null,
    status === 'completed' && task.completed_at ? formatDateTime(task.completed_at) : null,
    status === 'archived' ? t(expired ? 'task.archived_expired' : 'task.archived_cancelled') : null,
    task.counterpart_name,
    role === 'executor' && task.my_response_status && task.my_response_status !== 'accepted'
      ? t(`responseStatus.${task.my_response_status}` as TranslationKey)
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={task.title}
        onPress={() => router.push(`/task/${task.id}`)}
        style={{ gap: 8 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: colors.fill,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={18} color={colors.text} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <StatusBadge status={status} />
              {role === 'customer' && task.new_responses > 0 ? (
                <AppText variant="caption" color="accentText">
                  {t('my.newResponses', { n: task.new_responses })}
                </AppText>
              ) : null}
            </View>
          </View>
          <AppText variant="title3" tabular>
            {fmt(task.reward_cents)}
          </AppText>
        </View>
        <AppText variant="bodyStrong">{task.title}</AppText>
        {sub ? (
          <AppText variant="callout" color="textSecondary">
            {sub}
          </AppText>
        ) : null}
        {progress != null ? <ProgressBar value={progress} label={t('my.cols.progress')} /> : null}
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button
          variant={next.primary ? 'primary' : 'glass'}
          label={next.label}
          onPress={() => router.push(next.href as never)}
        />
        {role === 'customer' && status === 'archived' && expired && (
          <Button
            variant="glass"
            label={t('task.republish')}
            disabled={republish.isPending}
            onPress={() => republish.mutate(undefined)}
          />
        )}
      </View>
    </Card>
  );
}

function Drafts() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const { colors } = useTheme();
  const { data = [], isLoading } = useTaskDrafts();
  if (isLoading) return <Center />;
  if (!data.length)
    return (
      <EmptyState
        title={t('my.emptyTab')}
        action={<Button label={t('my.create')} onPress={() => router.push('/task/new')} />}
      />
    );
  return (
    <View style={{ gap: 10 }}>
      {data.map((d) => (
        <Card key={d.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <FileText size={20} color={colors.textSecondary} />
          <Pressable
            style={{ flex: 1 }}
            accessibilityRole="link"
            onPress={() => router.push(`/task/new?draft=${d.id}`)}
          >
            <AppText variant="bodyStrong" numberOfLines={1}>
              {String(d.data.title || '') || t('my.draftUntitled')}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {formatDateTime(d.updated_at)} · {t('my.actions.edit')}
            </AppText>
          </Pressable>
          <Button
            variant="glass"
            size="icon"
            accessibilityLabel={t('create.draftDelete')}
            icon={<Trash2 size={18} color={colors.text} />}
            onPress={() =>
              taskExtras
                .deleteDraft(sb, d.id)
                .then(() => qc.invalidateQueries({ queryKey: keys.drafts }))
            }
          />
        </Card>
      ))}
    </View>
  );
}

export default function MyTasks() {
  const [role, setRole] = useState<MyRole>('executor');
  const [tab, setTab] = useState<MyTab>('active');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('new');
  const list = useMyTasks(role);
  const drafts = useTaskDrafts(role === 'customer');
  const data = useMemo(() => list.data ?? [], [list.data]);

  const counts = useMemo(() => {
    const c: Partial<Record<MyTab, number>> = {};
    for (const x of data) c[myTaskTab(x, role)] = (c[myTaskTab(x, role)] ?? 0) + 1;
    c.drafts = drafts.data?.length ?? 0;
    return c;
  }, [data, role, drafts.data]);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const f = data.filter(
      (x) => myTaskTab(x, role) === tab && (!needle || x.title.toLowerCase().includes(needle)),
    );
    const by: Record<Sort, (a: MyTask, b: MyTask) => number> = {
      new: (a, b) => b.published_at.localeCompare(a.published_at),
      deadline: (a, b) => (a.due_at ?? a.expires_at).localeCompare(b.due_at ?? b.expires_at),
      pay: (a, b) => b.reward_cents - a.reward_cents,
    };
    return [...f].sort(by[sort]);
  }, [data, role, tab, q, sort]);
  const activeSum = data
    .filter(
      (x) =>
        ['in_progress', 'review', 'disputed'].includes(displayStatus(x)) ||
        (role === 'customer' && displayStatus(x) === 'open'),
    )
    .reduce((a, x) => a + x.reward_cents, 0);

  return (
    <Screen
      title={t('my.title')}
      tabBar
      onRefresh={() => Promise.all([list.refetch(), drafts.refetch()])}
    >
      <PageTitle>{t('my.title')}</PageTitle>
      <Segmented
        value={role}
        onChange={(r) => {
          setRole(r);
          setTab(MY_TABS[r][0]!);
        }}
        options={[
          { value: 'executor', label: t('my.doing') },
          { value: 'customer', label: t('my.mine') },
        ]}
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <StatTile
            value={formatMoney(activeSum, 'ru-RU', { compact: true })}
            label={t('my.stats.reserved')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <StatTile value={counts.done ?? 0} label={t('my.tabs.done')} />
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {MY_TABS[role].map((x) => (
          <Chip
            key={x}
            label={`${t(`my.tabs.${x}`)} · ${counts[x] ?? 0}`}
            selected={tab === x}
            onPress={() => setTab(x)}
          />
        ))}
      </ScrollView>
      {tab !== 'drafts' && (
        <>
          <TextField label={t('my.search')} value={q} onChangeText={setQ} />
          <Segmented
            value={sort}
            onChange={setSort}
            options={(['new', 'deadline', 'pay'] as const).map((v) => ({
              value: v,
              label: t(`my.sort.${v}`),
            }))}
          />
        </>
      )}
      {tab === 'drafts' ? (
        <Drafts />
      ) : list.isLoading ? (
        <Center />
      ) : data.length === 0 ? (
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
      ) : shown.length === 0 ? (
        <EmptyState title={t('my.emptyTab')} />
      ) : (
        <View style={{ gap: 12 }} testID="my-tasks">
          {shown.map((task) => (
            <Row key={task.id} task={task} role={role} />
          ))}
        </View>
      )}
    </Screen>
  );
}
