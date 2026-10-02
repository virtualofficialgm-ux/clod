import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  formatDateTime,
  formatPrice,
  money,
  savedSearches,
  t,
  taskExtras,
  type FeedParams,
  type FeedTask,
  type TaskKind,
  type TranslationKey,
} from '@parri/shared';
import {
  keys,
  useApiMutation,
  useFeed,
  useMe,
  useRates,
  useSavedSearches,
  useSupabase,
} from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  Bookmark,
  BookmarkCheck,
  EyeOff,
  GraduationCap,
  Info,
  MapPinOff,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
  Zap,
} from '@/components/icons';
import { useDeferredValue, useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Segmented } from '@/components/glass/Segmented';
import { FeedFilters, activeFilterCount } from '@/components/task/FeedFilters';
import { TakeSheet } from '@/components/task/MoreSheets';
import { Card } from '@/components/ui/kit';
import { TaskCard } from '@/components/task/TaskCard';
import { Screen } from '@/components/ui/Screen';
import { Center, EmptyState, PageTitle } from '@/components/ui/bits';
import { useToast } from '@/components/ui/bits';
import { useDeviceLocation } from '@/lib/location';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

const RECENT_KEY = 'parri.recentSearches';

function Badge({
  children,
  tone = 'fill',
}: {
  children: React.ReactNode;
  tone?: 'fill' | 'accent' | 'success';
}) {
  const { colors } = useTheme();
  const bg =
    tone === 'accent'
      ? colors.accentSoft
      : tone === 'success'
        ? 'rgba(52,199,89,0.14)'
        : colors.fill;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        height: 26,
        paddingHorizontal: 10,
        borderRadius: 999,
        backgroundColor: bg,
      }}
    >
      {children}
    </View>
  );
}

export default function Feed() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const toast = useToast();
  const { colors } = useTheme();
  const me = useMe();
  const geo = useDeviceLocation(true);
  const saved = useSavedSearches();
  const [params, setParams] = useState<FeedParams>({ kind: 'online', sort: 'recommended' });
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [display, setDisplay] = useState<'USD' | 'RUB'>('USD');
  const [rateInfo, setRateInfo] = useState(false);
  const [taking, setTaking] = useState<FeedTask | null>(null);
  const rates = useRates();
  const rub = rates.data?.RUB;

  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then((v) => setRecent(v ? (JSON.parse(v) as string[]) : []))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (me.data?.profile.display_currency === 'RUB') setDisplay('RUB');
  }, [me.data?.profile.display_currency]);
  const remember = (v: string) => {
    const x = v.trim();
    if (!x) return;
    const next = [x, ...recent.filter((r) => r !== x)].slice(0, 6);
    setRecent(next);
    void AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => undefined);
  };
  const bookmark = useApiMutation(
    (sb2, v: { id: string; on: boolean }) => taskExtras.bookmark(sb2, v.id, v.on),
    {
      invalidate: () => [['feed']],
      onSuccess: (_r, v) => toast(v.on ? t('feed.bookmarked') : t('feed.unsave')),
    },
  );
  const skip = useApiMutation((sb2, id: string) => taskExtras.skip(sb2, id), {
    invalidate: () => [['feed']],
    onSuccess: () => toast(t('feed.skipped')),
  });
  const ideas = ['i1', 'i2', 'i3', 'i4', 'i5'].map((k) =>
    t(`feed.ideaList.${k}` as TranslationKey),
  );

  const needsGeo = params.kind === 'nearby' && !geo.coords;
  const needsUni = params.kind === 'campus' && !me.data?.profile.university_id;
  const feed = useFeed(
    { ...params, query: q },
    params.kind === 'nearby' ? geo.coords : null,
    !needsGeo && !needsUni,
  );
  const items = feed.data?.pages.flat() ?? [];
  const filters = activeFilterCount(params);

  const setKind = (kind: TaskKind) => {
    setParams((p) => ({
      ...p,
      kind,
      sort: kind === 'nearby' ? 'distance' : p.sort === 'distance' ? 'recommended' : p.sort,
      maxDistanceM: null,
    }));
    if (kind === 'nearby' && !geo.coords && geo.state !== 'denied') void geo.locate();
  };

  return (
    <Screen
      title={t('feed.title')}
      tabBar
      onRefresh={() => feed.refetch()}
      overlay={
        <>
          <TakeSheet
            task={
              taking
                ? {
                    id: taking.id,
                    title: taking.title,
                    reward_cents: taking.reward_cents,
                    currency: taking.currency,
                  }
                : null
            }
            pro={me.data?.profile.plan === 'pro'}
            onClose={() => setTaking(null)}
          />
          <FeedFilters
            key={filtersOpen ? 'o' : 'c'}
            open={filtersOpen}
            onClose={() => setFiltersOpen(false)}
            value={params}
            onApply={(v) => {
              setParams(v);
              setFiltersOpen(false);
            }}
            onSave={async (name, v) => {
              try {
                await savedSearches.create(sb, name, { ...v, query });
                await qc.invalidateQueries({ queryKey: keys.saved });
                toast(t('feed.saved'));
              } catch {
                toast(t('errors.unknown'), 'error');
              }
            }}
          />
        </>
      }
    >
      <PageTitle>{t('feed.title')}</PageTitle>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Segmented
            value={display}
            onChange={setDisplay}
            options={[
              { value: 'USD', label: '$ USD' },
              { value: 'RUB', label: '₽ RUB' },
            ]}
          />
        </View>
        <Button
          variant="glass"
          size="icon"
          accessibilityLabel={t('feed.currency')}
          icon={<Info size={18} color={colors.text} />}
          onPress={() => setRateInfo((v) => !v)}
        />
      </View>
      {rateInfo && rub ? (
        <Card>
          <AppText variant="callout" color="textSecondary">
            {t('feed.rateInfo', {
              date: formatDateTime(rub.fetched_at),
              value: Number(rub.per_usd).toLocaleString('ru-RU'),
            })}
          </AppText>
          <Button
            variant="glass"
            label={t('feed.rateRefresh')}
            onPress={async () => {
              await money.refreshRates(sb).catch(() => undefined);
              await rates.refetch();
            }}
          />
        </Card>
      ) : null}
      <Segmented
        value={params.kind}
        onChange={setKind}
        options={[
          { value: 'online', label: t('kind.online') },
          { value: 'nearby', label: t('kind.nearby') },
          { value: 'campus', label: t('kind.campus') },
        ]}
      />
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <GlassSurface
          radius={999}
          style={{
            flex: 1,
            height: 48,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            gap: 8,
          }}
        >
          <Search size={18} strokeWidth={2.4} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            onSubmitEditing={() => remember(query)}
            placeholder={t('feed.searchPlaceholder')}
            accessibilityLabel={t('feed.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            style={{
              flex: 1,
              color: colors.text,
              fontSize: 17,
              fontFamily: familyByWeight['500'],
              height: '100%',
            }}
          />
          {query ? (
            <Pressable
              accessibilityLabel={t('feed.reset')}
              onPress={() => setQuery('')}
              hitSlop={10}
            >
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </GlassSurface>
        <Button
          variant={filters ? 'primary' : 'glass'}
          size="icon"
          accessibilityLabel={filters ? t('feed.filtersActive', { n: filters }) : t('feed.filters')}
          icon={
            <SlidersHorizontal
              size={20}
              strokeWidth={2.4}
              color={filters ? colors.onAccent : colors.text}
            />
          }
          onPress={() => setFiltersOpen(true)}
        />
      </View>

      {focus && !query ? (
        <Card>
          {recent.length > 0 && (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <AppText variant="callout" color="textSecondary">
                  {t('feed.recent')}
                </AppText>
                <AppText
                  variant="callout"
                  color="accentText"
                  onPress={() => {
                    setRecent([]);
                    void AsyncStorage.removeItem(RECENT_KEY).catch(() => undefined);
                  }}
                >
                  {t('feed.clear')}
                </AppText>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {recent.map((r) => (
                  <Chip key={r} label={r} onPress={() => setQuery(r)} />
                ))}
              </View>
            </>
          )}
          <AppText variant="callout" color="textSecondary">
            {t('feed.ideas')}
          </AppText>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ideas.map((r) => (
              <Chip
                key={r}
                label={r}
                onPress={() => {
                  setQuery(r);
                  remember(r);
                }}
              />
            ))}
          </View>
        </Card>
      ) : null}

      {
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginHorizontal: -16, marginVertical: -12 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
        >
          <Chip
            label={t('feed.savedTasks')}
            icon={
              <BookmarkCheck
                size={14}
                strokeWidth={2.6}
                color={params.bookmarked ? colors.onAccent : colors.text}
              />
            }
            selected={!!params.bookmarked}
            onPress={() => setParams((p) => ({ ...p, bookmarked: !p.bookmarked }))}
          />
          {(saved.data ?? []).map((s) => (
            <Chip
              key={s.id}
              label={s.name}
              icon={<Bookmark size={14} strokeWidth={2.6} color={colors.text} />}
              onPress={() => {
                setParams({ ...s.params });
                setQuery(s.params.query ?? '');
                if (s.params.kind === 'nearby' && !geo.coords) void geo.locate();
              }}
            />
          ))}
        </ScrollView>
      }

      {needsGeo ? (
        <EmptyState
          icon={<MapPinOff size={36} strokeWidth={2.2} color={colors.textSecondary} />}
          title={t('feed.nearbyNoGeo')}
          text={
            geo.state === 'denied' || geo.state === 'unavailable'
              ? t('feed.geoDenied')
              : t('feed.nearbyNoGeoText')
          }
          action={
            geo.state === 'locating' ? (
              <AppText variant="callout" color="textSecondary">
                {t('feed.geoLocating')}
              </AppText>
            ) : geo.state !== 'denied' ? (
              <Button label={t('feed.allowGeo')} onPress={() => void geo.locate()} />
            ) : null
          }
        />
      ) : needsUni ? (
        <EmptyState
          icon={<GraduationCap size={36} strokeWidth={2.2} color={colors.textSecondary} />}
          title={t('feed.campusNoUni')}
          text={t('feed.campusNoUniText')}
        />
      ) : feed.isLoading ? (
        <Center />
      ) : items.length === 0 ? (
        <EmptyState title={t('feed.empty')} text={t('feed.emptyHint')} />
      ) : (
        <View style={{ gap: 12 }} testID="feed-list">
          {items.map((task) => (
            <View key={task.id} style={{ gap: 0 }}>
              <TaskCard
                priceLabel={formatPrice(task.reward_cents, task.currency, display, rub?.per_usd)}
                badges={
                  <>
                    {task.match >= 60 ? (
                      <Badge tone="accent">
                        <AppText variant="caption" color="accentText">
                          {t('feed.match', { n: task.match })}
                        </AppText>
                      </Badge>
                    ) : null}
                    <Badge tone="success">
                      <ShieldCheck size={12} color={colors.success} />
                      <AppText variant="caption" color="success">
                        {t('feed.reserved')}
                      </AppText>
                    </Badge>
                  </>
                }
                actions={
                  <>
                    <View style={{ flex: 1 }}>
                      <Button
                        block
                        label={t('feed.take')}
                        icon={<Zap size={16} color={colors.onAccent} />}
                        onPress={() => setTaking(task)}
                      />
                    </View>
                    <Button
                      variant="glass"
                      size="icon"
                      accessibilityLabel={task.bookmarked ? t('feed.unsave') : t('feed.save')}
                      icon={
                        task.bookmarked ? (
                          <BookmarkCheck size={18} color={colors.accent} />
                        ) : (
                          <Bookmark size={18} color={colors.text} />
                        )
                      }
                      onPress={() => bookmark.mutate({ id: task.id, on: !task.bookmarked })}
                    />
                    <Button
                      variant="glass"
                      size="icon"
                      accessibilityLabel={t('feed.skip')}
                      icon={<EyeOff size={18} color={colors.text} />}
                      onPress={() => skip.mutate(task.id)}
                    />
                  </>
                }
                task={{
                  id: task.id,
                  title: task.title,
                  rewardCents: task.reward_cents,
                  kind: task.kind,
                  category: task.category,
                  deadline: task.deadline,
                  distanceM: task.distance_m ?? undefined,
                  campusName: task.university_name ?? undefined,
                }}
                footer={
                  task.has_responded
                    ? t('feed.responded')
                    : `${task.customer_name} · ${t('feed.responses', { n: task.response_count })}`
                }
                onPress={() => router.push(`/task/${task.id}`)}
              />
            </View>
          ))}
          {feed.hasNextPage && (
            <Button
              variant="glass"
              label={t('feed.loadMore')}
              disabled={feed.isFetchingNextPage}
              onPress={() => feed.fetchNextPage()}
            />
          )}
        </View>
      )}
    </Screen>
  );
}
