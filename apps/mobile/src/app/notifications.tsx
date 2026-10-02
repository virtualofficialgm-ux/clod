import {
  formatAgo,
  notificationTarget,
  notifications,
  profile as profileApi,
  t,
  type AppNotification,
} from '@parri/shared';
import { keys, useApiMutation, useMe, useNotifications } from '@parri/shared/react';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Bell, CheckCheck, Settings, Trash2 } from '@/components/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { Avatar, Center, EmptyState, PageTitle } from '@/components/ui/bits';
import { Card } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

export function notificationText(n: AppNotification) {
  return t(`notif.k.${n.kind}`, {
    actor: n.actor_name || 'Parri',
    title: String(n.payload.title ?? ''),
    body: String(n.payload.body ?? ''),
  });
}

function hrefFor(n: AppNotification): string | null {
  const x = notificationTarget(n);
  if (!x) return null;
  switch (x.to) {
    case 'task':
      return `/task/${x.id}`;
    case 'room':
      return `/task/${x.id}/room`;
    case 'responses':
      return `/task/${x.id}/responses`;
    case 'profile':
      return `/u/${x.id}`;
    case 'direct':
      return `/direct/${x.id}`;
    case 'connections':
      return `/connections?tab=${x.tab}`;
  }
}

export default function Notifications() {
  const { colors } = useTheme();
  const me = useMe();
  const { data = [], isLoading, refetch } = useNotifications();
  const inv = () => [keys.notifications, keys.unreadNotifications];
  const markRead = useApiMutation((sb, ids?: number[]) => notifications.markRead(sb, ids), {
    invalidate: inv,
  });
  const clear = useApiMutation((sb) => notifications.clear(sb), { invalidate: inv });
  const enable = useApiMutation((sb) => profileApi.saveData(sb, { notify_skill_tasks: true }), {
    invalidate: () => [keys.me],
  });
  return (
    <Screen
      title={t('notif.title')}
      leading={<BackButton />}
      onRefresh={() => refetch()}
      actions={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            variant="glass"
            size="icon"
            accessibilityLabel={t('notif.readAll')}
            icon={<CheckCheck size={18} color={colors.text} />}
            onPress={() => markRead.mutate(undefined)}
          />
          <Button
            variant="glass"
            size="icon"
            accessibilityLabel={t('notif.clearAll')}
            icon={<Trash2 size={18} color={colors.text} />}
            onPress={() => clear.mutate(undefined)}
          />
          <Button
            variant="glass"
            size="icon"
            accessibilityLabel={t('notif.settings')}
            icon={<Settings size={18} color={colors.text} />}
            onPress={() => router.push('/settings?tab=notifications')}
          />
        </View>
      }
    >
      <PageTitle>{t('notif.title')}</PageTitle>
      {me.data && !me.data.profile.notify_skill_tasks ? (
        <Card>
          <AppText variant="callout">{t('profile.skillNotifyHint')}</AppText>
          <Button label={t('notif.enableSkill')} onPress={() => enable.mutate(undefined)} />
        </Card>
      ) : null}
      {isLoading ? (
        <Center />
      ) : data.length === 0 ? (
        <EmptyState
          icon={<Bell size={36} color={colors.textSecondary} />}
          title={t('notif.empty')}
          text={t('notif.emptyText')}
        />
      ) : (
        <Card testID="notifications">
          {data.map((n) => (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              onPress={() => {
                if (!n.read_at) markRead.mutate([n.id]);
                const href = hrefFor(n);
                if (href) router.push(href as never);
              }}
              style={{
                flexDirection: 'row',
                gap: 10,
                paddingVertical: 8,
                alignItems: 'flex-start',
              }}
            >
              <Avatar name={n.actor_name || 'Parri'} url={n.actor_avatar} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant={n.read_at ? 'callout' : 'bodyStrong'}>
                  {notificationText(n)}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {formatAgo(n.created_at)}
                </AppText>
              </View>
              {!n.read_at ? (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    marginTop: 6,
                    backgroundColor: colors.accent,
                  }}
                />
              ) : null}
            </Pressable>
          ))}
        </Card>
      )}
    </Screen>
  );
}
