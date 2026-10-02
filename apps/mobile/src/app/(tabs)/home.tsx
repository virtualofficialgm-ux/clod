import {
  ACTIVE_STATUSES,
  deadlineDays,
  earnedThisMonth,
  formatAgo,
  formatMoney,
  formatTimeLeft,
  profileCompleteness,
  shortName,
  t,
  type TranslationKey,
} from '@parri/shared';
import { useFeed, useLedger, useMe, useMyTasks } from '@parri/shared/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Segmented } from '@/components/glass/Segmented';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  CircleCheck,
  Plus,
  Search,
  Sparkles,
  TrendingUp,
  Wallet,
} from '@/components/icons';
import { TaskCard } from '@/components/task/TaskCard';
import { Screen } from '@/components/ui/Screen';
import { Avatar, StatusBadge } from '@/components/ui/bits';
import {
  BigNumber,
  Card,
  CardHeader,
  ListGroup,
  ListRow,
  PillButton,
  ProgressBar,
  ProgressRing,
  QuickAction,
  StatTile,
  WeekStrip,
  dayKey,
} from '@/components/ui/kit';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

export default function Home() {
  const { colors } = useTheme();
  const me = useMe();
  const asExecutor = useMyTasks('executor');
  const asCustomer = useMyTasks('customer');
  const ledger = useLedger();
  const feed = useFeed({ kind: 'online', sort: 'recommended' }, null);
  const [role, setRole] = useState<'executor' | 'customer'>('executor');
  const [day, setDay] = useState(() => dayKey(new Date()));

  const p = me.data?.profile;
  const available = me.data?.wallet.available_cents ?? 0;
  const reserved = me.data?.wallet.safe_cents ?? 0;
  const all = useMemo(() => [...(asExecutor.data ?? []), ...(asCustomer.data ?? [])], [asExecutor.data, asCustomer.data]);
  const days = useMemo(() => deadlineDays(all), [all]);
  const active = (role === 'executor' ? asExecutor.data : asCustomer.data)?.filter((x) => ACTIVE_STATUSES.has(x.status)) ?? [];
  const activeCount = all.filter((x) => ACTIVE_STATUSES.has(x.status)).length;
  const earned = earnedThisMonth(ledger.data ?? []);
  const completeness = profileCompleteness(me.data);
  const dayTasks = days.get(day) ?? [];

  return (
    <Screen
      title={t('dashboard.title')}
      tabBar
      onRefresh={() => Promise.all([me.refetch(), asExecutor.refetch(), asCustomer.refetch(), ledger.refetch(), feed.refetch()])}
      actions={
        <Pressable accessibilityRole="button" accessibilityLabel={t('nav.profile')} onPress={() => router.push('/account')} hitSlop={8}>
          <Avatar name={shortName(p?.first_name, p?.last_name)} url={p?.avatar_url} size={40} />
        </Pressable>
      }
    >
      <View style={{ gap: 4 }}>
        <AppText variant="callout" color="textSecondary" style={{ fontFamily: familyByWeight['600'] }}>
          {new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        </AppText>
        <AppText variant="title1" accessibilityRole="header">
          {t('dashboard.hello', { name: p?.first_name ?? '' })}
          <AppText variant="title1" style={{ color: colors.accent }}>
            .
          </AppText>
        </AppText>
      </View>

      <WeekStrip marks={new Set(days.keys())} selected={day} onSelect={setDay} />
      {dayTasks.length > 0 && (
        <View style={{ gap: 8, marginTop: -8 }}>
          {dayTasks.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => router.push(`/task/${task.id}/room`)}
              style={{ backgroundColor: colors.fill, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}
            >
              <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                {task.title}
              </AppText>
              <AppText variant="callout" color="accentText" style={{ fontFamily: familyByWeight['700'] }}>
                {formatTimeLeft(task.due_at!)}
              </AppText>
            </Pressable>
          ))}
        </View>
      )}

      {/* Главная карточка — как карточка калорий в Cal AI: большая цифра и кольцо */}
      <Card testID="balance-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 12 }}>
          <BigNumber value={formatMoney(available)} label={t('dashboard.available')} />
          <AppText variant="callout" color="textSecondary">
            {t('dashboard.reserved')}:{' '}
            <AppText variant="callout" tabular style={{ fontFamily: familyByWeight['700'] }}>
              {formatMoney(reserved)}
            </AppText>
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <PillButton label={t('dashboard.topUp')} icon={(c) => <Plus size={16} strokeWidth={2.8} color={c} />} onPress={() => router.push('/balance')} />
            <PillButton tone="fill" label={t('dashboard.withdraw')} icon={(c) => <ArrowUpRight size={16} strokeWidth={2.8} color={c} />} onPress={() => router.push('/balance')} />
          </View>
        </View>
        <ProgressRing value={available + reserved ? reserved / (available + reserved) : 0} size={96} stroke={10} label={`${t('dashboard.reserved')}: ${formatMoney(reserved)}`}>
          <Wallet size={24} strokeWidth={2.4} color={colors.accent} />
        </ProgressRing>
      </Card>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatTile
          value={activeCount}
          label={t('dashboard.inWork')}
          ring={Math.min(1, activeCount / 5)}
          color={colors.chart[0]}
          icon={<Briefcase size={18} strokeWidth={2.4} color={colors.chart[0]} />}
          onPress={() => router.navigate('/tasks')}
        />
        <StatTile
          value={p?.completed_count ?? 0}
          label={t('dashboard.done')}
          ring={Math.min(1, (p?.completed_count ?? 0) / 10)}
          color={colors.chart[2]}
          icon={<CircleCheck size={18} strokeWidth={2.4} color={colors.chart[2]} />}
          onPress={() => router.navigate('/tasks')}
        />
        <StatTile
          value={formatMoney(earned, 'ru-RU', { compact: true })}
          label={t('dashboard.earnedMonth')}
          ring={Math.min(1, earned / 50000)}
          color={colors.chart[3]}
          icon={<TrendingUp size={18} strokeWidth={2.4} color={colors.chart[3]} />}
          onPress={() => router.push('/balance')}
        />
      </View>

      <View style={{ flexDirection: 'row' }}>
        <QuickAction icon={(c) => <Plus size={24} strokeWidth={2.6} color={c} />} label={t('dashboard.createTask')} onPress={() => router.push('/task/new')} />
        <QuickAction icon={(c) => <Search size={22} strokeWidth={2.6} color={c} />} label={t('dashboard.findTask')} onPress={() => router.navigate('/feed')} />
        <QuickAction icon={(c) => <ArrowDownLeft size={22} strokeWidth={2.6} color={c} />} label={t('dashboard.topUp')} onPress={() => router.push('/balance')} />
        <QuickAction icon={(c) => <ArrowUpRight size={22} strokeWidth={2.6} color={c} />} label={t('dashboard.withdraw')} onPress={() => router.push('/balance')} />
      </View>

      <Card>
        <CardHeader title={t('dashboard.activeTasks')} />
        <Segmented
          value={role}
          onChange={setRole}
          options={[
            { value: 'executor', label: t('dashboard.iDo') },
            { value: 'customer', label: t('dashboard.iOrder') },
          ]}
        />
        {active.length === 0 ? (
          <View style={{ gap: 12, alignItems: 'flex-start' }}>
            <AppText variant="body" color="textSecondary">
              {t('dashboard.noActive')}
            </AppText>
            <PillButton
              tone="accent"
              label={role === 'executor' ? t('dashboard.findTask') : t('dashboard.createTask')}
              onPress={() => (role === 'executor' ? router.navigate('/feed') : router.push('/task/new'))}
            />
          </View>
        ) : (
          active.slice(0, 5).map((task) => (
            <Pressable key={task.id} onPress={() => router.push(`/task/${task.id}/room`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 }}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {task.title}
                </AppText>
                <AppText variant="callout" color="textSecondary" numberOfLines={1}>
                  {task.due_at ? formatTimeLeft(task.due_at) : t(`deadline.${task.deadline}`)} · {task.counterpart_name}
                </AppText>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <AppText variant="bodyStrong" tabular style={{ fontFamily: familyByWeight['800'] }}>
                  {formatMoney(task.reward_cents)}
                </AppText>
                <StatusBadge status={task.status} />
              </View>
            </Pressable>
          ))
        )}
      </Card>

      {completeness.percent < 100 && (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Sparkles size={20} color={colors.accent} />
            <AppText variant="bodyStrong">{t('dashboard.profileFill', { n: completeness.percent })}</AppText>
          </View>
          <ProgressBar value={completeness.percent / 100} label={t('dashboard.profileFill', { n: completeness.percent })} />
          <Pressable onPress={() => router.push('/account')}>
            <AppText variant="callout" color="accentText" style={{ fontFamily: familyByWeight['700'] }}>
              {t('dashboard.improveProfile')} →
            </AppText>
          </Pressable>
        </Card>
      )}

      {!!ledger.data?.length && (
        <ListGroup title={t('dashboard.transactions')}>
          {ledger.data.slice(0, 4).map((e) => (
            <ListRow
              key={e.id}
              icon={(c) => (e.amount_cents > 0 ? <ArrowDownLeft size={18} color={c} /> : <ArrowUpRight size={18} color={c} />)}
              title={t(`ledgerKind.${e.kind}` as TranslationKey)}
              subtitle={formatAgo(e.created_at)}
              value={`${e.amount_cents > 0 ? '+' : '−'}${formatMoney(Math.abs(e.amount_cents))}`}
            />
          ))}
        </ListGroup>
      )}

      <View style={{ gap: 12 }}>
        <CardHeader
          title={t('dashboard.recommended')}
          action={
            <Pressable onPress={() => router.navigate('/feed')}>
              <AppText variant="callout" color="accentText" style={{ fontFamily: familyByWeight['700'] }}>
                {t('common.seeAll')}
              </AppText>
            </Pressable>
          }
        />
        {(feed.data?.pages.flat() ?? []).slice(0, 4).map((task) => (
          <TaskCard
            key={task.id}
            task={{
              id: task.id,
              title: task.title,
              rewardCents: task.reward_cents,
              kind: task.kind,
              category: task.category,
              deadline: task.deadline,
            }}
            onPress={() => router.push(`/task/${task.id}`)}
          />
        ))}
      </View>
    </Screen>
  );
}
