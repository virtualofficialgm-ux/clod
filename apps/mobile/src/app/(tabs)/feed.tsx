import { savedSearches, t, type FeedParams, type TaskKind } from '@parri/shared';
import { keys, useFeed, useMe, useSavedSearches, useSupabase } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Bookmark, GraduationCap, MapPinOff, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useDeferredValue, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Segmented } from '@/components/glass/Segmented';
import { FeedFilters, activeFilterCount } from '@/components/task/FeedFilters';
import { TaskCard } from '@/components/task/TaskCard';
import { Screen } from '@/components/ui/Screen';
import { Center, EmptyState, PageTitle } from '@/components/ui/bits';
import { useToast } from '@/components/ui/bits';
import { useDeviceLocation } from '@/lib/location';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

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

  const needsGeo = params.kind === 'nearby' && !geo.coords;
  const needsUni = params.kind === 'campus' && !me.data?.profile.university_id;
  const feed = useFeed({ ...params, query: q }, params.kind === 'nearby' ? geo.coords : null, !needsGeo && !needsUni);
  const items = feed.data?.pages.flat() ?? [];
  const filters = activeFilterCount(params);

  const setKind = (kind: TaskKind) => {
    setParams((p) => ({ ...p, kind, sort: kind === 'nearby' ? 'distance' : p.sort === 'distance' ? 'recommended' : p.sort, maxDistanceM: null }));
    if (kind === 'nearby' && !geo.coords && geo.state !== 'denied') void geo.locate();
  };

  return (
    <Screen
      title={t('feed.title')}
      tabBar
      onRefresh={() => feed.refetch()}
      overlay={
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
      }
    >
      <PageTitle>{t('feed.title')}</PageTitle>
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
        <GlassSurface radius={999} style={{ flex: 1, height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 }}>
          <Search size={18} strokeWidth={2.4} color={colors.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('feed.searchPlaceholder')}
            accessibilityLabel={t('feed.searchPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            style={{ flex: 1, color: colors.text, fontSize: 17, fontFamily: familyByWeight['500'], height: '100%' }}
          />
          {query ? (
            <Pressable accessibilityLabel={t('feed.reset')} onPress={() => setQuery('')} hitSlop={10}>
              <X size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
        </GlassSurface>
        <Button
          variant={filters ? 'primary' : 'glass'}
          size="icon"
          accessibilityLabel={filters ? t('feed.filtersActive', { n: filters }) : t('feed.filters')}
          icon={<SlidersHorizontal size={20} strokeWidth={2.4} color={filters ? colors.onAccent : colors.text} />}
          onPress={() => setFiltersOpen(true)}
        />
      </View>

      {!!saved.data?.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginVertical: -12 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
          {saved.data.map((s) => (
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
      )}

      {needsGeo ? (
        <EmptyState
          icon={<MapPinOff size={36} strokeWidth={2.2} color={colors.textSecondary} />}
          title={t('feed.nearbyNoGeo')}
          text={geo.state === 'denied' || geo.state === 'unavailable' ? t('feed.geoDenied') : t('feed.nearbyNoGeoText')}
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
                footer={task.has_responded ? t('feed.responded') : `${task.customer_name} · ${t('feed.responses', { n: task.response_count })}`}
                onPress={() => router.push(`/task/${task.id}`)}
              />
            </View>
          ))}
          {feed.hasNextPage && <Button variant="glass" label={t('feed.loadMore')} disabled={feed.isFetchingNextPage} onPress={() => feed.fetchNextPage()} />}
        </View>
      )}
    </Screen>
  );
}
