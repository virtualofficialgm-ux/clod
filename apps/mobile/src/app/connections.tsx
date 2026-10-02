import {
  formatDateTime,
  formatMoney,
  people,
  t,
  type Connection,
  type ConnectionKind,
  type Invitation,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation, useConnections, useInvitations } from '@parri/shared/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Avatar, Center, EmptyState, PageTitle, useToast } from '@/components/ui/bits';
import { Card } from '@/components/ui/kit';

type Tab = ConnectionKind | 'invitations';
const TABS: Tab[] = ['followers', 'following', 'contacts', 'requests', 'invitations'];

function PersonRow({ c, kind }: { c: Connection; kind: ConnectionKind }) {
  const inv = () => [['connections'], ['profile']];
  const remove = useApiMutation(
    (sb) =>
      kind === 'following' ? people.follow(sb, c.id, false) : people.contactRemove(sb, c.id),
    { invalidate: inv },
  );
  const respond = useApiMutation((sb, accept: boolean) => people.contactRespond(sb, c.id, accept), {
    invalidate: inv,
  });
  return (
    <Card>
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push(`/u/${c.username ?? c.id}`)}
        style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}
      >
        <Avatar name={c.name} url={c.avatar_url} size={44} />
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {c.name}
          </AppText>
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {[c.headline, c.city].filter(Boolean).join(' · ') || formatDateTime(c.since)}
          </AppText>
        </View>
      </Pressable>
      {kind === 'requests' && c.incoming ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            label={t('connections.accept')}
            disabled={respond.isPending}
            onPress={() => respond.mutate(true)}
          />
          <Button
            variant="glass"
            label={t('connections.decline')}
            disabled={respond.isPending}
            onPress={() => respond.mutate(false)}
          />
        </View>
      ) : kind === 'requests' ? (
        <Button
          variant="glass"
          label={t('connections.cancel')}
          onPress={() => remove.mutate(undefined)}
        />
      ) : kind !== 'followers' ? (
        <Button
          variant="glass"
          label={t('connections.remove')}
          onPress={() => remove.mutate(undefined)}
        />
      ) : null}
    </Card>
  );
}

function InvitationRow({ i }: { i: Invitation }) {
  const toast = useToast();
  const respond = useApiMutation(
    (sb, accept: boolean) => people.respondInvitation(sb, i.id, accept),
    {
      invalidate: () => [keys.invitations, ['my-tasks'], keys.task(i.task_id)],
      onSuccess: (_r, accept) => {
        if (accept) {
          toast(t('connections.accepted'));
          router.push(`/task/${i.task_id}/room`);
        }
      },
    },
  );
  return (
    <Card testID="invitation">
      <AppText variant="bodyStrong">{i.title}</AppText>
      <AppText variant="caption" color="textSecondary">
        {i.incoming ? i.from_name : `→ ${i.to_name}`} ·{' '}
        {formatMoney(i.reward_cents, 'ru-RU', { currency: i.currency })} ·{' '}
        {t(`connections.inviteStatus.${i.status}`)}
      </AppText>
      {i.message ? <AppText variant="callout">{i.message}</AppText> : null}
      {i.status === 'pending' ? (
        <AppText variant="caption" color="textSecondary">
          {t('connections.respondBy', { date: formatDateTime(i.respond_by) })}
        </AppText>
      ) : null}
      {i.incoming && i.status === 'pending' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button
            label={t('connections.accept')}
            disabled={respond.isPending}
            onPress={() => respond.mutate(true)}
          />
          <Button
            variant="glass"
            label={t('connections.decline')}
            disabled={respond.isPending}
            onPress={() => respond.mutate(false)}
          />
        </View>
      ) : null}
      <Button
        variant="glass"
        label={t('connections.viewTask')}
        onPress={() => router.push(`/task/${i.task_id}`)}
      />
      {respond.error ? (
        <AppText variant="callout" color="danger">
          {t(respond.error.key as TranslationKey)}
        </AppText>
      ) : null}
    </Card>
  );
}

function List({ kind, q }: { kind: ConnectionKind; q: string }) {
  const { data = [], isLoading } = useConnections(kind);
  const needle = q.trim().toLowerCase();
  const items = data.filter(
    (c) => !needle || `${c.name} ${c.headline ?? ''}`.toLowerCase().includes(needle),
  );
  if (isLoading) return <Center />;
  if (!items.length)
    return (
      <EmptyState
        title={t('connections.empty')}
        action={
          <Button label={t('connections.findPeople')} onPress={() => router.push('/people')} />
        }
      />
    );
  return (
    <View style={{ gap: 10 }} testID="connections">
      {items.map((c) => (
        <PersonRow key={c.id} c={c} kind={kind} />
      ))}
    </View>
  );
}

function Invitations() {
  const { data = [], isLoading } = useInvitations();
  if (isLoading) return <Center />;
  if (!data.length) return <EmptyState title={t('connections.empty')} />;
  return (
    <View style={{ gap: 10 }}>
      {data.map((i) => (
        <InvitationRow key={i.id} i={i} />
      ))}
    </View>
  );
}

export default function Connections() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(
    params.tab && TABS.includes(params.tab) ? params.tab : 'followers',
  );
  const [q, setQ] = useState('');
  return (
    <Screen title={t('connections.title')} leading={<BackButton />}>
      <PageTitle subtitle={t('connections.followNote')}>{t('connections.title')}</PageTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {TABS.map((x) => (
          <Chip
            key={x}
            label={t(`connections.tabs.${x}`)}
            selected={tab === x}
            onPress={() => setTab(x)}
          />
        ))}
      </ScrollView>
      {tab !== 'invitations' ? (
        <TextField label={t('connections.search')} value={q} onChangeText={setQ} />
      ) : null}
      {tab === 'invitations' ? <Invitations /> : <List kind={tab} q={q} />}
      <Button
        variant="glass"
        label={t('connections.privacy')}
        onPress={() => router.push('/settings?tab=privacy')}
      />
    </Screen>
  );
}
