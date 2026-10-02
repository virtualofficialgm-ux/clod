import {
  durationBucket,
  formatDistance,
  formatMoney,
  nearby,
  parseDollars,
  routeUrl,
  t,
  walkMinutes,
  type DurationBucket,
  type FeedTask,
  type TranslationKey,
} from '@parri/shared';
import { useFeed, useMe, useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { TakeSheet } from '@/components/task/MoreSheets';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Center, EmptyState, PageTitle } from '@/components/ui/bits';
import { Card, Toggle } from '@/components/ui/kit';
import { useDeviceLocation } from '@/lib/location';

const RADII = [0.5, 1, 2, 5] as const;

export default function Nearby() {
  const sb = useSupabase();
  const me = useMe();
  const geo = useDeviceLocation(true);
  const [filters, setFilters] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(2);
  const [minReward, setMinReward] = useState('');
  const [duration, setDuration] = useState<DurationBucket | null>(null);
  const [safe, setSafe] = useState(false);
  const [taking, setTaking] = useState<FeedTask | null>(null);

  const feed = useFeed(
    {
      kind: 'nearby',
      sort: 'distance',
      maxDistanceM: radiusKm * 1000,
      minRewardCents: parseDollars(minReward) ?? null,
    },
    geo.coords,
    !!geo.coords,
  );
  const raw = useMemo(
    () => (feed.data?.pages.flat() ?? []).filter((x) => x.lat != null && x.lng != null),
    [feed.data],
  );
  const meta = useQuery({
    queryKey: ['nearby-meta', raw.map((x) => x.id)],
    queryFn: () =>
      nearby.meta(
        sb,
        raw.map((x) => x.id),
      ),
    enabled: raw.length > 0,
  });
  const metaById = useMemo(() => new Map((meta.data ?? []).map((m) => [m.id, m])), [meta.data]);
  const items = raw.filter((x) => {
    const m = metaById.get(x.id);
    if (safe && !m?.safe_place) return false;
    if (duration && durationBucket(m?.duration_min) !== duration) return false;
    return true;
  });

  return (
    <Screen
      title={t('nearby.title')}
      leading={<BackButton />}
      onRefresh={() => feed.refetch()}
      overlay={
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
      }
    >
      <PageTitle>{t('nearby.title')}</PageTitle>
      {!geo.coords ? (
        <Card testID="nearby-nogeo">
          <AppText variant="bodyStrong">{t('nearby.noGeo')}</AppText>
          {geo.state === 'denied' || geo.state === 'unavailable' ? (
            <AppText color="danger">{t('feed.geoDenied')}</AppText>
          ) : (
            <Button
              label={geo.state === 'locating' ? t('feed.geoLocating') : t('nearby.allow')}
              disabled={geo.state === 'locating'}
              onPress={() => void geo.locate()}
            />
          )}
        </Card>
      ) : (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <AppText variant="caption" color="textSecondary" style={{ flex: 1 }}>
              {geo.accuracy != null
                ? `${t('nearby.accuracy', { m: formatDistance(geo.accuracy) })} · `
                : ''}
              {t('nearby.approx')}
            </AppText>
            <Chip
              label={filters ? t('nearby.closeFilters') : t('nearby.filters')}
              selected={filters}
              onPress={() => setFilters((v) => !v)}
            />
          </View>
          {filters && (
            <Card testID="nearby-filters">
              <AppText variant="callout">{t('nearby.radius')}</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {RADII.map((r) => (
                  <Chip
                    key={r}
                    label={String(r).replace('.', ',')}
                    selected={radiusKm === r}
                    onPress={() => setRadiusKm(r)}
                  />
                ))}
              </View>
              <TextField
                label={t('nearby.minReward')}
                keyboardType="decimal-pad"
                value={minReward}
                onChangeText={setMinReward}
              />
              <AppText variant="callout">{t('nearby.duration')}</AppText>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Chip
                  label={t('nearby.anyDuration')}
                  selected={!duration}
                  onPress={() => setDuration(null)}
                />
                {(['short', 'mid', 'long'] as const).map((d) => (
                  <Chip
                    key={d}
                    label={t(`create.durations.${d}`)}
                    selected={duration === d}
                    onPress={() => setDuration(d)}
                  />
                ))}
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <AppText>{t('nearby.safe')}</AppText>
                <Toggle value={safe} onChange={setSafe} label={t('nearby.safe')} />
              </View>
              <Button
                variant="glass"
                label={t('nearby.reset')}
                onPress={() => {
                  setRadiusKm(2);
                  setMinReward('');
                  setDuration(null);
                  setSafe(false);
                }}
              />
            </Card>
          )}
          {feed.isLoading ? (
            <Center />
          ) : items.length === 0 ? (
            <EmptyState title={t('nearby.empty')} />
          ) : (
            <View testID="nearby-list" style={{ gap: 12 }}>
              {items.map((x) => {
                const m = metaById.get(x.id);
                const d = x.distance_m ?? 0;
                return (
                  <Card key={x.id}>
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => router.push(`/task/${x.id}`)}
                    >
                      <AppText variant="bodyStrong">{x.title}</AppText>
                      <AppText variant="caption" color="textSecondary">
                        {t('nearby.routeText', { d: formatDistance(d), m: walkMinutes(d) })} ·{' '}
                        {t(`category.${x.category}` as TranslationKey)}
                        {m?.duration_min
                          ? ` · ${t(`create.durations.${durationBucket(m.duration_min)!}`)}`
                          : ''}
                      </AppText>
                    </Pressable>
                    <View
                      style={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <AppText variant="title3">
                        {formatMoney(x.reward_cents, 'ru-RU', { currency: x.currency })}
                      </AppText>
                      {m?.safe_place && (
                        <AppText variant="caption" color="success">
                          ✓ {t('nearby.safe')}
                        </AppText>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      <Button
                        variant="glass"
                        size="md"
                        label={t('nearby.openRoute')}
                        onPress={() =>
                          void Linking.openURL(routeUrl({ lat: x.lat!, lng: x.lng! }, geo.coords))
                        }
                      />
                      {x.customer_id !== me.data?.profile.id && (
                        <Button size="md" label={t('task.take')} onPress={() => setTaking(x)} />
                      )}
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
