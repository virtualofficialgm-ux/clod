'use client';

import { t, type FeedParams, type FeedTask, type TaskKind } from '@parri/shared';
import { keys, useFeed, useMe, useSavedSearches, useSupabase } from '@parri/shared/react';
import { savedSearches } from '@parri/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Bookmark, GraduationCap, MapPinOff, Search, SlidersHorizontal, X } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Glass } from '@/components/glass/Glass';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { FeedFilters, activeFilterCount } from '@/components/task/FeedFilters';
import { TaskCard } from '@/components/task/TaskCard';
import { CenterSpinner, EmptyState, PageTitle } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';
import { useGeolocation } from '@/lib/useGeolocation';

function FeedCard({ task }: { task: FeedTask }) {
  return (
    <TaskCard
      href={`/tasks/${task.id}`}
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
        <p className="flex items-center justify-between gap-2 text-caption text-text-2">
          <span>{task.customer_name}</span>
          <span className={task.has_responded ? 'text-accent-text' : ''}>
            {task.has_responded ? t('feed.responded') : t('feed.responses', { n: task.response_count })}
          </span>
        </p>
      }
    />
  );
}

export default function FeedPage() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const toast = useToast();
  const me = useMe();
  const [params, setParams] = useState<FeedParams>({ kind: 'online', sort: 'recommended' });
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const geo = useGeolocation(true);
  const saved = useSavedSearches();

  const needsGeo = params.kind === 'nearby' && !geo.coords;
  const needsUni = params.kind === 'campus' && !me.data?.profile.university_id;
  const feed = useFeed({ ...params, query: deferredQuery }, params.kind === 'nearby' ? geo.coords : null, !needsGeo && !needsUni);
  const items = feed.data?.pages.flat() ?? [];
  const filters = activeFilterCount(params);

  const setKind = (kind: TaskKind) => {
    setParams((p) => ({ ...p, kind, sort: kind === 'nearby' ? 'distance' : p.sort === 'distance' ? 'recommended' : p.sort, maxDistanceM: null }));
    if (kind === 'nearby' && !geo.coords && geo.state !== 'denied') geo.request();
  };

  const saveSearch = async (name: string, v: FeedParams) => {
    try {
      await savedSearches.create(sb, name, { ...v, query });
      await qc.invalidateQueries({ queryKey: keys.saved });
      toast(t('feed.saved'));
    } catch {
      toast(t('errors.unknown'), 'error');
    }
  };

  return (
    <>
      <Header title={t('feed.title')} />
      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-6 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle>
          {t('feed.title')}
          <span className="text-accent">.</span>
        </PageTitle>

        <Segmented<TaskKind>
          label={t('feed.title')}
          value={params.kind}
          onChange={setKind}
          options={[
            { value: 'online', label: t('kind.online') },
            { value: 'nearby', label: t('kind.nearby') },
            { value: 'campus', label: t('kind.campus') },
          ]}
        />

        <div className="flex items-center gap-2">
          <Glass radius="pill" className="flex h-12 min-w-0 flex-1 items-center gap-2 px-4">
            <Search size={18} strokeWidth={2.4} className="shrink-0 text-text-2" aria-hidden />
            <input
              type="search"
              aria-label={t('feed.searchPlaceholder')}
              placeholder={t('feed.searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-2"
            />
            {query && (
              <button type="button" aria-label={t('feed.reset')} onClick={() => setQuery('')} className="text-text-2">
                <X size={18} />
              </button>
            )}
          </Glass>
          <Chip selected={filters > 0} icon={<SlidersHorizontal size={16} strokeWidth={2.6} />} onClick={() => setFiltersOpen(true)}>
            {filters ? t('feed.filtersActive', { n: filters }) : t('feed.filters')}
          </Chip>
        </div>

        {!!saved.data?.length && (
          <div className="-mx-[var(--p-gutter)] flex gap-2 overflow-x-auto px-[var(--p-gutter)] py-1 md:mx-0 md:px-0" aria-label={t('feed.savedTitle')}>
            {saved.data.map((s) => (
              <Chip
                key={s.id}
                icon={<Bookmark size={14} strokeWidth={2.6} />}
                onClick={() => {
                  setParams({ ...s.params });
                  setQuery(s.params.query ?? '');
                  if (s.params.kind === 'nearby' && !geo.coords) geo.request();
                }}
              >
                {s.name}
              </Chip>
            ))}
          </div>
        )}

        {needsGeo ? (
          <EmptyState
            icon={<MapPinOff size={36} strokeWidth={2.2} />}
            title={t('feed.nearbyNoGeo')}
            text={geo.state === 'denied' || geo.state === 'unavailable' ? t('feed.geoDenied') : t('feed.nearbyNoGeoText')}
            action={
              geo.state === 'locating' ? (
                <p className="text-callout font-semibold text-text-2">{t('feed.geoLocating')}</p>
              ) : geo.state !== 'denied' ? (
                <Button onClick={geo.request}>{t('feed.allowGeo')}</Button>
              ) : null
            }
          />
        ) : needsUni ? (
          <EmptyState
            icon={<GraduationCap size={36} strokeWidth={2.2} />}
            title={t('feed.campusNoUni')}
            text={t('feed.campusNoUniText')}
            action={
              <Link href="/account" className="font-bold text-accent-text">
                {t('account.title')}
              </Link>
            }
          />
        ) : feed.isLoading ? (
          <CenterSpinner />
        ) : items.length === 0 ? (
          <EmptyState title={t('feed.empty')} text={t('feed.emptyHint')} />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2" data-testid="feed-list">
              {items.map((task) => (
                <FeedCard key={task.id} task={task} />
              ))}
            </div>
            {feed.hasNextPage && (
              <div className="flex justify-center">
                <Button variant="glass" disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
                  {t('feed.loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      <FeedFilters
        key={filtersOpen ? 'open' : 'closed'}
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        value={params}
        onApply={(v) => {
          setParams(v);
          setFiltersOpen(false);
        }}
        onSave={saveSearch}
      />
    </>
  );
}
