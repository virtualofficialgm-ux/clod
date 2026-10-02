import {
  countryName,
  formatAgo,
  formatDateTime,
  formatMoney,
  isOnline,
  languageName,
  people,
  t,
  type PublicProfile,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation, usePublicProfile, useReviewsOf } from '@parri/shared/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Share, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import {
  BadgeCheck,
  Ban,
  Ellipsis,
  MessageCircle,
  Share2,
  UserCheck,
  UserPlus,
} from '@/components/icons';
import { InviteSheet } from '@/components/social/InviteSheet';
import { ConfirmSheet } from '@/components/task/Sheets';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { Avatar, Center, EmptyState, Pill, Row, useToast } from '@/components/ui/bits';
import { Card, CardHeader, ListGroup, ListRow, StatTile } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

type Tab = 'profile' | 'portfolio' | 'reviews';

function Reviews({ userId }: { userId: string }) {
  const { data = [], isLoading } = useReviewsOf(userId);
  const [rating, setRating] = useState<number | null>(null);
  const [sort, setSort] = useState<'new' | 'old'>('new');
  const shown = useMemo(() => {
    const f = data.filter((r) => rating == null || r.rating === rating);
    return sort === 'new' ? f : [...f].reverse();
  }, [data, rating, sort]);
  if (isLoading) return <Center />;
  if (!data.length) return <EmptyState title={t('profile.noReviews')} />;
  return (
    <View style={{ gap: 12 }}>
      <Row>
        <Chip label={t('common.all')} selected={rating == null} onPress={() => setRating(null)} />
        {[5, 4, 3, 2, 1].map((n) => (
          <Chip key={n} label={`★ ${n}`} selected={rating === n} onPress={() => setRating(n)} />
        ))}
      </Row>
      <Segmented
        value={sort}
        onChange={setSort}
        options={[
          { value: 'new', label: t('profile.sortNew') },
          { value: 'old', label: t('profile.sortOld') },
        ]}
      />
      {shown.map((r) => (
        <Card key={r.id}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Avatar name={r.author_name ?? ''} url={r.author_avatar} size={36} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{r.author_name}</AppText>
              <AppText variant="caption" color="textSecondary">
                {formatDateTime(r.created_at)}
                {r.task_title ? ` · ${r.task_title}` : ''}
              </AppText>
            </View>
            <AppText variant="bodyStrong">★ {r.rating}</AppText>
          </View>
          {r.public_text ? <AppText variant="body">{r.public_text}</AppText> : null}
        </Card>
      ))}
    </View>
  );
}

function Actions({ p }: { p: PublicProfile }) {
  const { colors } = useTheme();
  const toast = useToast();
  const [block, setBlock] = useState(false);
  const [offer, setOffer] = useState(false);
  const [more, setMore] = useState(false);
  const r = p.relation;
  const inv = () => [keys.profile(p.username ?? p.id), keys.profile(p.id), ['connections']];
  const follow = useApiMutation((sb) => people.follow(sb, p.id, !r.following), { invalidate: inv });
  const contact = useApiMutation(
    (sb) =>
      r.contact === 'none'
        ? people.contactRequest(sb, p.id)
        : r.contact === 'incoming'
          ? people.contactRespond(sb, p.id, true)
          : people.contactRemove(sb, p.id),
    { invalidate: inv },
  );
  const blockM = useApiMutation((sb) => people.block(sb, p.id, !r.blocked), {
    invalidate: inv,
    onSuccess: () => {
      setBlock(false);
      toast(r.blocked ? t('settings.unblocked') : t('common.done'));
      if (!r.blocked) router.replace('/people');
    },
  });
  if (r.self)
    return <Button block label={t('profile.edit')} onPress={() => router.push('/account-edit')} />;
  const contactLabel = {
    none: t('profile.addContact'),
    outgoing: t('profile.cancelRequest'),
    incoming: t('profile.acceptRequest'),
    accepted: t('profile.removeContact'),
  }[r.contact];
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {r.can_follow || r.following ? (
          <Button
            variant={r.following ? 'glass' : 'primary'}
            icon={
              r.following ? (
                <UserCheck size={18} color={colors.text} />
              ) : (
                <UserPlus size={18} color={colors.onAccent} />
              )
            }
            label={r.following ? t('profile.following') : t('profile.follow')}
            disabled={follow.isPending}
            onPress={() => follow.mutate(undefined)}
          />
        ) : null}
        <Button
          variant="glass"
          label={contactLabel}
          disabled={contact.isPending}
          onPress={() => contact.mutate(undefined)}
        />
        {r.can_message ? (
          <Button
            variant="glass"
            icon={<MessageCircle size={18} color={colors.text} />}
            label={t('profile.write')}
            onPress={() => router.push(`/direct/${p.id}`)}
          />
        ) : null}
        {r.can_invite && p.platform_role !== 'customer' ? (
          <Button label={t('profile.offerTask')} onPress={() => setOffer(true)} />
        ) : null}
        <Button
          variant="glass"
          size="icon"
          accessibilityLabel={t('common.more')}
          icon={<Ellipsis size={18} color={colors.text} />}
          onPress={() => setMore((v) => !v)}
        />
      </View>
      {more ? (
        <ListGroup>
          <ListRow
            icon={(c) => <Share2 size={18} color={c} />}
            title={t('profile.share')}
            onPress={() =>
              void Share.share({
                message: `${process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/u/${p.username ?? p.id}`,
              })
            }
          />
          <ListRow
            icon={(c) => <Ban size={18} color={c} />}
            title={r.blocked ? t('profile.unblock') : t('profile.block')}
            danger
            onPress={() => setBlock(true)}
          />
        </ListGroup>
      ) : null}
      {follow.error || contact.error ? (
        <AppText variant="callout" color="danger">
          {t((follow.error ?? contact.error)!.key as TranslationKey)}
        </AppText>
      ) : null}
      <ConfirmSheet
        open={block}
        onClose={() => setBlock(false)}
        title={
          r.blocked
            ? t('settings.unblockTitle', { name: p.name })
            : t('profile.blockTitle', { name: p.name })
        }
        text={r.blocked ? undefined : t('profile.blockText')}
        confirmLabel={r.blocked ? t('profile.unblock') : t('profile.block')}
        onConfirm={() => blockM.mutate(undefined)}
        busy={blockM.isPending}
        error={blockM.error?.key}
      />
      <InviteSheet
        user={offer ? { id: p.id, name: p.name } : null}
        onClose={() => setOffer(false)}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const { handle, tab: tabParam } = useLocalSearchParams<{ handle: string; tab?: string }>();
  const { colors } = useTheme();
  const { data: p, isLoading, refetch } = usePublicProfile(handle);
  const [tab, setTab] = useState<Tab>(
    tabParam === 'reviews' || tabParam === 'portfolio' ? tabParam : 'profile',
  );
  if (isLoading)
    return (
      <Screen title="" leading={<BackButton />}>
        <Center />
      </Screen>
    );
  if (!p)
    return (
      <Screen title="" leading={<BackButton />}>
        <EmptyState title={t('profile.notFound')} />
      </Screen>
    );
  if (p.private)
    return (
      <Screen title={p.name} leading={<BackButton />}>
        <View style={{ alignItems: 'center', gap: 12, paddingTop: 24 }}>
          <Avatar name={p.name} url={p.avatar_url} size={96} />
          <AppText variant="title2">{p.name}</AppText>
          <AppText variant="body" color="textSecondary">
            {t('profile.private')}
          </AppText>
        </View>
      </Screen>
    );
  const online = isOnline(p.last_seen_at);
  const s = p.stats;
  return (
    <Screen title={p.name} leading={<BackButton />} onRefresh={() => refetch()}>
      <Card>
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
          <View>
            <Avatar name={p.name} url={p.avatar_url} size={80} />
            {online ? (
              <View
                style={{
                  position: 'absolute',
                  right: 2,
                  bottom: 2,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: colors.success,
                  borderWidth: 3,
                  borderColor: colors.background,
                }}
              />
            ) : null}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <AppText variant="title3" testID="profile-name">
                {p.display_name || p.name}
              </AppText>
              {p.verified ? <BadgeCheck size={18} color={colors.accent} /> : null}
            </View>
            <AppText variant="callout" color="textSecondary">
              {p.username ? `@${p.username} · ` : ''}
              {t(`profile.role.${p.platform_role}`)}
            </AppText>
            {p.headline || p.profession ? (
              <AppText variant="bodyStrong">{p.headline || p.profession}</AppText>
            ) : null}
            <AppText variant="caption" color="textSecondary">
              {[
                [p.city, p.country_code ? countryName(p.country_code) : null]
                  .filter(Boolean)
                  .join(', '),
                t(`people.availability.${p.availability}`),
                online
                  ? t('profile.online')
                  : p.last_seen_at
                    ? t('profile.lastSeen', { ago: formatAgo(p.last_seen_at) })
                    : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </AppText>
          </View>
        </View>
        <Actions p={p} />
      </Card>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          [s.rating_avg ? Number(s.rating_avg).toFixed(1) : '—', t('profile.rating')],
          [s.completed, t('profile.completed')],
          [s.followers, t('profile.followers')],
        ].map(([v, l]) => (
          <View key={String(l)} style={{ flex: 1 }}>
            <StatTile value={v as string} label={l as string} />
          </View>
        ))}
      </View>
      <Segmented
        value={tab}
        onChange={setTab}
        options={(['profile', 'portfolio', 'reviews'] as const).map((v) => ({
          value: v,
          label: t(`profile.tabs.${v}`),
        }))}
      />
      {tab === 'profile' ? (
        <>
          {p.bio ? (
            <Card>
              <CardHeader title={t('profile.about')} />
              <AppText variant="body">{p.bio}</AppText>
            </Card>
          ) : null}
          {p.skills.length > 0 ? (
            <Card>
              <CardHeader title={t('profile.skills')} />
              <Row>
                {p.skills.map((x) => (
                  <Pill key={x.slug}>
                    {t(`skill.${x.slug}` as TranslationKey)}
                    {x.level ? ` · ${x.level.toUpperCase()}` : ''}
                  </Pill>
                ))}
              </Row>
            </Card>
          ) : null}
          {p.aspects && Object.values(p.aspects).some((v) => v != null) ? (
            <ListGroup title={t('profile.aspects')}>
              {Object.entries(p.aspects)
                .filter(([, v]) => v != null)
                .map(([k, v]) => (
                  <ListRow key={k} title={t(`rate.${k}` as TranslationKey)} value={`★ ${v}`} />
                ))}
            </ListGroup>
          ) : null}
          {p.languages.length > 0 ? (
            <ListGroup title={t('profile.languages')}>
              {p.languages.map((l) => (
                <ListRow
                  key={l.code}
                  title={languageName(l.code)}
                  value={t(`onb.levels.${l.level}` as TranslationKey)}
                />
              ))}
            </ListGroup>
          ) : null}
          {p.experience.length > 0 || p.university ? (
            <ListGroup title={`${t('profile.experience')} · ${t('profile.education')}`}>
              {p.experience.map((e) => (
                <ListRow
                  key={e.id}
                  title={e.position}
                  subtitle={`${e.company}${e.from_year ? ` · ${e.from_year}–${e.to_year ?? '…'}` : ''}`}
                />
              ))}
              {p.university ? <ListRow title={p.university.name} /> : null}
            </ListGroup>
          ) : null}
          {p.links.length > 0 ? (
            <ListGroup title={t('profile.links')}>
              {p.links.map((l) => (
                <ListRow
                  key={l.url}
                  title={l.title || l.url}
                  onPress={() => Linking.openURL(l.url)}
                />
              ))}
            </ListGroup>
          ) : null}
          {p.open_tasks.length > 0 ? (
            <ListGroup title={t('profile.openTasks')}>
              {p.open_tasks.map((x) => (
                <ListRow
                  key={x.id}
                  title={x.title}
                  value={formatMoney(x.reward_cents, 'ru-RU', { currency: x.currency })}
                  onPress={() => router.push(`/task/${x.id}`)}
                />
              ))}
            </ListGroup>
          ) : null}
        </>
      ) : tab === 'portfolio' ? (
        p.portfolio.length === 0 ? (
          <EmptyState title={t('profile.noPortfolio')} />
        ) : (
          <ListGroup>
            {p.portfolio.map((w) => (
              <ListRow
                key={w.id}
                title={w.title}
                subtitle={w.category ? t(`category.${w.category}`) : undefined}
                onPress={w.url ? () => Linking.openURL(w.url!) : undefined}
              />
            ))}
          </ListGroup>
        )
      ) : (
        <Reviews userId={p.id} />
      )}
    </Screen>
  );
}
