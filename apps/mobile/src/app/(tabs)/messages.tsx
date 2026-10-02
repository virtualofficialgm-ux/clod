import { displayStatus, formatAgo, formatMoney, t, type TranslationKey } from '@parri/shared';
import { useChats, useMe } from '@parri/shared/react';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Segmented } from '@/components/glass/Segmented';
import { MessageCircle, Search } from '@/components/icons';
import { Screen } from '@/components/ui/Screen';
import { Avatar, Center, EmptyState, PageTitle, StatusBadge } from '@/components/ui/bits';
import { Card, PillButton } from '@/components/ui/kit';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

export default function Messages() {
  const { colors } = useTheme();
  const me = useMe();
  const chats = useChats();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const myId = me.data?.profile.id;

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (chats.data ?? [])
      .filter((c) => filter === 'all' || c.unread > 0)
      .filter((c) => !q || `${c.title} ${c.counterpart_name} ${c.last_body ?? ''}`.toLowerCase().includes(q));
  }, [chats.data, query, filter]);

  return (
    <Screen title={t('messages.title')} tabBar onRefresh={() => chats.refetch()}>
      <PageTitle>{t('messages.title')}</PageTitle>
      <GlassSurface radius={999} style={styles.search}>
        <Search size={18} strokeWidth={2.4} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('messages.search')}
          accessibilityLabel={t('messages.search')}
          placeholderTextColor={colors.textSecondary}
          style={{ flex: 1, color: colors.text, fontSize: 17, fontFamily: familyByWeight['500'], height: '100%' }}
        />
      </GlassSurface>
      <Segmented
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: t('messages.all') },
          { value: 'unread', label: t('messages.unread') },
        ]}
      />
      {chats.isLoading ? (
        <Center />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<MessageCircle size={36} color={colors.textSecondary} />}
          title={t('messages.empty')}
          text={t('messages.emptyText')}
          action={
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <PillButton tone="accent" label={t('messages.findTasks')} onPress={() => router.navigate('/feed')} />
              <PillButton tone="fill" label={t('messages.myTasks')} onPress={() => router.navigate('/tasks')} />
            </View>
          }
        />
      ) : (
        <Card style={{ padding: 0, gap: 0, overflow: 'hidden' }} testID="chats">
          {list.map((c, i) => {
            const preview =
              c.last_kind === 'system'
                ? t(`event.${c.last_body}` as TranslationKey, { version: '' })
                : c.last_body
                  ? (c.last_sender === myId ? t('messages.you') : '') + c.last_body
                  : t('messages.noMessages');
            return (
              <Pressable
                key={c.task_id}
                accessibilityRole="button"
                onPress={() => router.push(`/task/${c.task_id}/room`)}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
                  pressed && { backgroundColor: colors.fill },
                ]}
              >
                <Avatar name={c.counterpart_name} url={c.counterpart_avatar} size={52} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <View style={styles.line}>
                    <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
                      {c.counterpart_name}
                    </AppText>
                    {c.last_at ? (
                      <AppText variant="caption" color="textSecondary">
                        {formatAgo(c.last_at)}
                      </AppText>
                    ) : null}
                  </View>
                  <AppText variant="callout" color="textSecondary" numberOfLines={1} style={{ fontFamily: familyByWeight['600'] }}>
                    {c.title} · {formatMoney(c.reward_cents)}
                  </AppText>
                  <View style={styles.line}>
                    <AppText variant="callout" color={c.unread ? 'text' : 'textSecondary'} numberOfLines={1} style={{ flex: 1 }}>
                      {preview}
                    </AppText>
                    {c.unread > 0 ? (
                      <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                        <AppText variant="caption" color="onAccent">
                          {c.unread}
                        </AppText>
                      </View>
                    ) : (
                      <StatusBadge status={displayStatus(c)} />
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
});
