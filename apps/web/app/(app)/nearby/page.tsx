'use client';

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
import { Crosshair, Minus, Navigation, Plus, ShieldCheck, SlidersHorizontal, X, Zap } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { TakeSheet } from '@/components/task/TakeSheet';
import { Input } from '@/components/ui/Field';
import { CenterSpinner, EmptyState, PageTitle } from '@/components/ui/bits';
import { Card, Toggle } from '@/components/ui/kit';
import { useGeolocation } from '@/lib/useGeolocation';

const NearbyMap = dynamic(() => import('@/components/nearby/NearbyMap').then((m) => m.NearbyMap), { ssr: false, loading: () => <CenterSpinner /> });
const RADII = [0.5, 1, 2, 5] as const;
const PAGE = 6;

export default function NearbyPage() {
  const sb = useSupabase();
  const me = useMe();
  const geo = useGeolocation(true);
  const [view, setView] = useState<'map' | 'list'>('map');
  const [filters, setFilters] = useState(false);
  const [radiusKm, setRadiusKm] = useState<number>(2);
  const [minReward, setMinReward] = useState('');
  const [duration, setDuration] = useState<DurationBucket | null>(null);
  const [safe, setSafe] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [taking, setTaking] = useState<FeedTask | null>(null);
  const [zoom, setZoom] = useState<{ n: number; d: 1 | -1 }>({ n: 0, d: 1 });
  const [center, setCenter] = useState(0);

  const feed = useFeed(
    { kind: 'nearby', sort: 'distance', maxDistanceM: radiusKm * 1000, minRewardCents: parseDollars(minReward) ?? null },
    geo.coords,
    !!geo.coords,
  );
  const raw = useMemo(() => (feed.data?.pages.flat() ?? []).filter((x) => x.lat != null && x.lng != null), [feed.data]);
  const meta = useQuery({ queryKey: ['nearby-meta', raw.map((x) => x.id)], queryFn: () => nearby.meta(sb, raw.map((x) => x.id)), enabled: raw.length > 0 });
  const metaById = useMemo(() => new Map((meta.data ?? []).map((m) => [m.id, m])), [meta.data]);
  const items = raw.filter((x) => {
    const m = metaById.get(x.id);
    if (safe && !m?.safe_place) return false;
    if (duration && durationBucket(m?.duration_min) !== duration) return false;
    return true;
  });
  const sel = items.find((x) => x.id === selected) ?? null;
  const onSelect = useCallback((id: string) => setSelected(id), []);
  const points = useMemo(() => items.map((x) => ({ id: x.id, lat: x.lat!, lng: x.lng!, label: `${x.title} · ${formatMoney(x.reward_cents, 'ru-RU', { currency: x.currency })}` })), [items]);
  const shown = items.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <>
      <Header title={t('nearby.title')} />
      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-4 px-[var(--p-gutter)] pt-2 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PageTitle>
            {t('nearby.title')}
            <span className="text-accent">.</span>
          </PageTitle>
          <div className="flex items-center gap-2">
            <Segmented
              label={t('nearby.title')}
              value={view}
              onChange={setView}
              options={[
                { value: 'map', label: t('nearby.map') },
                { value: 'list', label: t('nearby.list') },
              ]}
            />
            <Chip selected={filters} icon={<SlidersHorizontal size={16} />} onClick={() => setFilters((v) => !v)}>
              {filters ? t('nearby.closeFilters') : t('nearby.filters')}
            </Chip>
          </div>
        </div>

        {!geo.coords ? (
          <Card className="flex flex-col items-center gap-3 py-10 text-center" data-testid="nearby-nogeo">
            <p className="text-title3 font-bold">{t('nearby.noGeo')}</p>
            {geo.state === 'denied' || geo.state === 'unavailable' ? (
              <p className="text-callout text-danger">{t('feed.geoDenied')}</p>
            ) : (
              <Button onClick={geo.request} disabled={geo.state === 'locating'}>
                <Crosshair size={18} /> {geo.state === 'locating' ? t('feed.geoLocating') : t('nearby.allow')}
              </Button>
            )}
          </Card>
        ) : (
          <>
            <p className="text-caption text-text-2">
              {geo.accuracy != null && t('nearby.accuracy', { m: formatDistance(geo.accuracy) })} · {t('nearby.approx')}
            </p>
            {filters && (
              <Card className="grid gap-4 md:grid-cols-2" data-testid="nearby-filters">
                <div className="flex flex-col gap-2">
                  <span className="text-callout font-bold">{t('nearby.radius')}</span>
                  <div className="flex flex-wrap gap-2">
                    {RADII.map((r) => (
                      <Chip key={r} selected={radiusKm === r} onClick={() => setRadiusKm(r)}>
                        {String(r).replace('.', ',')}
                      </Chip>
                    ))}
                  </div>
                </div>
                <Input label={t('nearby.minReward')} inputMode="decimal" value={minReward} onChange={(e) => setMinReward(e.target.value)} />
                <div className="flex flex-col gap-2">
                  <span className="text-callout font-bold">{t('nearby.duration')}</span>
                  <div className="flex flex-wrap gap-2">
                    <Chip selected={!duration} onClick={() => setDuration(null)}>
                      {t('nearby.anyDuration')}
                    </Chip>
                    {(['short', 'mid', 'long'] as const).map((d) => (
                      <Chip key={d} selected={duration === d} onClick={() => setDuration(d)}>
                        {t(`create.durations.${d}`)}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">{t('nearby.safe')}</span>
                    <Toggle checked={safe} onChange={setSafe} label={t('nearby.safe')} />
                  </div>
                </div>
                <div>
                  <Button
                    variant="glass"
                    onClick={() => {
                      setRadiusKm(2);
                      setMinReward('');
                      setDuration(null);
                      setSafe(false);
                    }}
                  >
                    {t('nearby.reset')}
                  </Button>
                </div>
              </Card>
            )}

            {view === 'map' && (
              <div className="card relative h-[60vh] min-h-[360px] overflow-hidden p-0">
                <NearbyMap me={geo.coords} points={points} selected={selected} onSelect={onSelect} zoomSignal={zoom} centerSignal={center} />
                <div className="absolute right-3 top-3 z-[400] flex flex-col gap-2">
                  <Button variant="glass" size="icon" aria-label={t('nearby.zoomIn')} onClick={() => setZoom((z) => ({ n: z.n + 1, d: 1 }))}>
                    <Plus size={18} />
                  </Button>
                  <Button variant="glass" size="icon" aria-label={t('nearby.zoomOut')} onClick={() => setZoom((z) => ({ n: z.n + 1, d: -1 }))}>
                    <Minus size={18} />
                  </Button>
                  <Button variant="glass" size="icon" aria-label={t('nearby.center')} onClick={() => setCenter((c) => c + 1)}>
                    <Navigation size={18} />
                  </Button>
                </div>
                {sel && (
                  <div className="glass absolute inset-x-3 bottom-3 z-[400] flex flex-col gap-2 rounded-2xl p-4" data-testid="route-preview">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-caption text-text-2">{t('nearby.routeTitle')}</p>
                        <Link href={`/tasks/${sel.id}`} className="block truncate font-bold">
                          {sel.title}
                        </Link>
                        <p className="text-callout">{t('nearby.routeText', { d: formatDistance(sel.distance_m ?? 0), m: walkMinutes(sel.distance_m ?? 0) })}</p>
                      </div>
                      <Button variant="plain" size="icon" aria-label={t('nearby.closeRoute')} onClick={() => setSelected(null)}>
                        <X size={18} />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="md" onClick={() => setTaking(sel)}>
                        <Zap size={16} /> {t('task.take')} · {formatMoney(sel.reward_cents, 'ru-RU', { currency: sel.currency })}
                      </Button>
                      <a href={routeUrl({ lat: sel.lat!, lng: sel.lng! }, geo.coords)} target="_blank" rel="noreferrer" className="glass inline-flex h-11 items-center rounded-pill px-4 text-callout font-bold">
                        {t('nearby.openRoute')}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {feed.isLoading ? (
              <CenterSpinner />
            ) : items.length === 0 ? (
              <EmptyState title={t('nearby.empty')} />
            ) : (
              <>
                <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="nearby-list">
                  {shown.map((x) => {
                    const m = metaById.get(x.id);
                    return (
                      <li key={x.id} className="card flex flex-col gap-2 p-4">
                        <button type="button" className="text-left" onClick={() => (setSelected(x.id), setView('map'))}>
                          <p className="font-bold">{x.title}</p>
                          <p className="text-caption text-text-2">
                            {formatDistance(x.distance_m ?? 0)} · {walkMinutes(x.distance_m ?? 0)} мин · {t(`category.${x.category}` as TranslationKey)}
                            {m?.duration_min ? ` · ${t(`create.durations.${durationBucket(m.duration_min)!}`)}` : ''}
                          </p>
                        </button>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="tabular text-title3 font-extrabold">{formatMoney(x.reward_cents, 'ru-RU', { currency: x.currency })}</span>
                          {m?.safe_place && (
                            <span className="inline-flex items-center gap-1 text-caption font-semibold text-success">
                              <ShieldCheck size={14} /> {t('nearby.safe')}
                            </span>
                          )}
                          {x.customer_id === me.data?.profile.id ? null : (
                            <Button size="md" onClick={() => setTaking(x)}>
                              {t('task.take')}
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {items.length > PAGE && (
                  <div className="flex justify-center gap-2">
                    <Button variant="glass" disabled={page === 0} onClick={() => setPage(page - 1)}>
                      {t('nearby.prev')}
                    </Button>
                    <Button variant="glass" disabled={(page + 1) * PAGE >= items.length} onClick={() => setPage(page + 1)}>
                      {t('nearby.next')}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
      <TakeSheet
        task={taking ? { id: taking.id, title: taking.title, reward_cents: taking.reward_cents, currency: taking.currency } : null}
        pro={me.data?.profile.plan === 'pro'}
        onClose={() => setTaking(null)}
      />
    </>
  );
}
