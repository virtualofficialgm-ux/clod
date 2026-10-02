'use client';

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
import { keys, useApiMutation, useFeed, useMe, useRates, useSavedSearches, useSupabase } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Bookmark,
  BookmarkCheck,
  EyeOff,
  GraduationCap,
  Info,
  LayoutDashboard,
  MapPinOff,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Glass } from '@/components/glass/Glass';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { FeedFilters, activeFilterCount } from '@/components/task/FeedFilters';
import { TakeSheet } from '@/components/task/TakeSheet';
import { TaskCard } from '@/components/task/TaskCard';
import { CenterSpinner, EmptyState, PageTitle } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';
import { useGeolocation } from '@/lib/useGeolocation';

const RECENT_KEY = 'parri.recentSearches';
const readRecent = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

function Badge({ children, tone = 'fill' }: { children: React.ReactNode; tone?: 'fill' | 'accent' | 'success' }) {
  return (
    <span
      className={clsx(
        'inline-flex h-7 items-center gap-1 rounded-pill px-2.5 text-caption',
        tone === 'accent' ? 'bg-accent-soft text-accent-text' : tone === 'success' ? 'bg-success/12 text-success' : 'bg-fill text-text-2',
      )}
    >
      {children}
    </span>
  );
}

function FeedCard({
  task,
  display,
  rub,
  onTake,
  onBookmark,
  onSkip,
}: {
  task: FeedTask;
  display: 'USD' | 'RUB';
  rub?: number;
  onTake: () => void;
  onBookmark: () => void;
  onSkip: () => void;
}) {
  return (
    <TaskCard
      href={`/tasks/${task.id}`}
      priceLabel={formatPrice(task.reward_cents, task.currency, display, rub)}
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
      badges={
        <>
          {task.match >= 60 && <Badge tone="accent">{t('feed.match', { n: task.match })}</Badge>}
          <Badge tone="success">
            <ShieldCheck size={13} strokeWidth={2.6} />
            {t('feed.reserved')}
          </Badge>
          <Badge>{t(`format.${task.result_format}` as TranslationKey)}</Badge>
        </>
      }
      footer={
        <p className="flex items-center justify-between gap-2 text-caption text-text-2">
          <span className="truncate">{task.customer_name}</span>
          <span className={task.has_responded ? 'text-accent-text' : ''}>
            {task.has_responded ? t('feed.responded') : t('feed.responses', { n: task.response_count })}
          </span>
        </p>
      }
      actions={
        <>
          <Button size="md" className="h-11 flex-1 justify-center px-4" onClick={onTake}>
            <Zap size={16} strokeWidth={2.8} />
            {t('feed.take')}
          </Button>
          <Button
            variant="glass"
            size="icon"
            className="size-11"
            aria-label={task.bookmarked ? t('feed.unsave') : t('feed.save')}
            aria-pressed={task.bookmarked}
            onClick={onBookmark}
          >
            {task.bookmarked ? <BookmarkCheck size={18} className="text-accent" /> : <Bookmark size={18} />}
          </Button>
          <Button variant="glass" size="icon" className="size-11" aria-label={t('feed.skip')} onClick={onSkip}>
            <EyeOff size={18} />
          </Button>
        </>
      }
    />
  );
}

export default function FeedPage() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const toast = useToast();
  const me = useMe();
  const rates = useRates();
  const [params, setParams] = useState<FeedParams>({ kind: 'online', sort: 'recommended' });
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [display, setDisplay] = useState<'USD' | 'RUB'>('USD');
  const [rateInfo, setRateInfo] = useState(false);
  const [taking, setTaking] = useState<FeedTask | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const geo = useGeolocation(true);
  const saved = useSavedSearches();

  // Переход со страницы «Сохранённые поиски»: /feed?saved=<id>
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('saved');
    const s = id ? saved.data?.find((x) => x.id === id) : null;
    if (s) {
      setParams({ ...s.params });
      setQuery(s.params.query ?? '');
      history.replaceState(null, '', '/feed');
    }
  }, [saved.data]);

  useEffect(() => {
    setRecent(readRecent());
    if (me.data?.profile.display_currency === 'RUB') setDisplay('RUB');
  }, [me.data?.profile.display_currency]);

  const remember = (q: string) => {
    const v = q.trim();
    if (!v) return;
    const next = [v, ...recent.filter((x) => x !== v)].slice(0, 6);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  };

  const needsGeo = params.kind === 'nearby' && !geo.coords;
  const needsUni = params.kind === 'campus' && !me.data?.profile.university_id;
  const feed = useFeed({ ...params, query: deferredQuery }, params.kind === 'nearby' ? geo.coords : null, !needsGeo && !needsUni);
  const items = feed.data?.pages.flat() ?? [];
  const filters = activeFilterCount(params);
  const rub = rates.data?.RUB;

  const setKind = (kind: TaskKind) => {
    setParams((p) => ({ ...p, kind, sort: kind === 'nearby' ? 'distance' : p.sort === 'distance' ? 'recommended' : p.sort, maxDistanceM: null }));
    if (kind === 'nearby' && !geo.coords && geo.state !== 'denied') geo.request();
  };

  const invalidateFeed = () => qc.invalidateQueries({ queryKey: ['feed'] });
  const bookmark = useApiMutation((sb2, v: { id: string; on: boolean }) => taskExtras.bookmark(sb2, v.id, v.on), {
    onSuccess: (_r, v) => {
      void invalidateFeed();
      toast(v.on ? t('feed.bookmarked') : t('feed.unsave'));
    },
  });
  const skip = useApiMutation((sb2, id: string) => taskExtras.skip(sb2, id), {
    onSuccess: () => {
      void invalidateFeed();
      toast(t('feed.skipped'));
    },
  });

  const saveSearch = async (name: string, v: FeedParams) => {
    try {
      await savedSearches.create(sb, name, { ...v, query });
      await qc.invalidateQueries({ queryKey: keys.saved });
      toast(t('feed.saved'));
    } catch {
      toast(t('errors.unknown'), 'error');
    }
  };

  const ideas = ['i1', 'i2', 'i3', 'i4', 'i5'].map((k) => t(`feed.ideaList.${k}` as TranslationKey));

  return (
    <>
      <Header title={t('feed.title')} />
      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-5 px-[var(--p-gutter)] pt-2 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PageTitle>
            {t('feed.title')}
            <span className="text-accent">.</span>
          </PageTitle>
          <div className="flex items-center gap-2">
            <Segmented
              label={t('feed.currency')}
              value={display}
              onChange={setDisplay}
              options={[
                { value: 'USD', label: '$ USD' },
                { value: 'RUB', label: '₽ RUB' },
              ]}
            />
            <Button variant="glass" size="icon" aria-label={t('feed.currency')} aria-expanded={rateInfo} onClick={() => setRateInfo((v) => !v)}>
              <Info size={18} />
            </Button>
            <Button variant="glass" size="icon" aria-label={t('feed.refresh')} onClick={() => void feed.refetch()}>
              <RefreshCw size={18} />
            </Button>
            <Link href="/dashboard" aria-label={t('feed.toDashboard')} className="glass hidden size-12 items-center justify-center rounded-pill sm:flex">
              <LayoutDashboard size={18} />
            </Link>
          </div>
        </div>

        {rateInfo && rub && (
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-callout text-text-2">
              {t('feed.rateInfo', { date: formatDateTime(rub.fetched_at), value: Number(rub.per_usd).toLocaleString('ru-RU') })}
            </p>
            <Button
              variant="glass"
              size="md"
              onClick={async () => {
                await money.refreshRates(sb).catch(() => {});
                await rates.refetch();
              }}
            >
              {t('feed.rateRefresh')}
            </Button>
          </div>
        )}

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

        <div className="relative flex items-center gap-2">
          <Glass radius="pill" className="flex h-12 min-w-0 flex-1 items-center gap-2 px-4">
            <Search size={18} strokeWidth={2.4} className="shrink-0 text-text-2" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              aria-label={t('feed.searchPlaceholder')}
              placeholder={t('feed.searchPlaceholder')}
              value={query}
              onFocus={() => setFocus(true)}
              onBlur={() => setTimeout(() => setFocus(false), 150)}
              onKeyDown={(e) => e.key === 'Enter' && remember(query)}
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
          {focus && !query && (
            <div className="card absolute inset-x-0 top-14 z-20 flex flex-col gap-4 p-4">
              {recent.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-callout font-bold text-text-2">{t('feed.recent')}</span>
                    <button
                      type="button"
                      className="text-callout font-bold text-accent-text"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setRecent([]);
                        try {
                          localStorage.removeItem(RECENT_KEY);
                        } catch {}
                      }}
                    >
                      {t('feed.clear')}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <button key={r} type="button" onMouseDown={(e) => { e.preventDefault(); setQuery(r); }} className="rounded-pill bg-fill px-3 py-1.5 text-callout">
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-2">
                <span className="text-callout font-bold text-text-2">{t('feed.ideas')}</span>
                <div className="flex flex-wrap gap-2">
                  {ideas.map((r) => (
                    <button key={r} type="button" onMouseDown={(e) => { e.preventDefault(); setQuery(r); remember(r); }} className="rounded-pill bg-fill px-3 py-1.5 text-callout">
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="-mx-[var(--p-gutter)] flex gap-2 overflow-x-auto px-[var(--p-gutter)] py-1 md:mx-0 md:px-0" aria-label={t('feed.savedTitle')}>
          <Chip
            selected={!!params.bookmarked}
            icon={<BookmarkCheck size={14} strokeWidth={2.6} />}
            onClick={() => setParams((p) => ({ ...p, bookmarked: !p.bookmarked }))}
          >
            {t('feed.savedTasks')}
          </Chip>
          {(saved.data ?? []).map((s) => (
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
          <Link href="/saved" className="inline-flex h-10 shrink-0 items-center rounded-pill px-3 text-callout font-bold text-accent-text">
            {t('feed.savedSearches')} →
          </Link>
        </div>

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
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="feed-list">
              {items.map((task) => (
                <FeedCard
                  key={task.id}
                  task={task}
                  display={display}
                  rub={rub?.per_usd}
                  onTake={() => setTaking(task)}
                  onBookmark={() => bookmark.mutate({ id: task.id, on: !task.bookmarked })}
                  onSkip={() => skip.mutate(task.id)}
                />
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
      <TakeSheet task={taking} pro={me.data?.profile.plan === 'pro'} onClose={() => setTaking(null)} />
    </>
  );
}
