'use client';

import { t, type PeopleQuery, type TranslationKey } from '@parri/shared';
import { usePeople, useSkills } from '@parri/shared/react';
import { Search, SlidersHorizontal, Users } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Glass } from '@/components/glass/Glass';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { InviteSheet } from '@/components/social/InviteSheet';
import { PersonCard } from '@/components/social/PersonCard';
import { Input, Select } from '@/components/ui/Field';
import { CenterSpinner, EmptyState, PageTitle } from '@/components/ui/bits';
import { Toggle } from '@/components/ui/kit';

const EMPTY: PeopleQuery = {
  role: 'all',
  skill: null,
  city: null,
  minRating: null,
  available: false,
  sort: 'relevance',
};

export default function PeoplePage() {
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query);
  const [f, setF] = useState<PeopleQuery>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [offer, setOffer] = useState<{ id: string; name: string } | null>(null);
  const skills = useSkills().data ?? [];
  const list = usePeople({ ...f, query: q });
  const items = list.data?.pages.flat() ?? [];
  const active = [f.skill, f.city, f.minRating, f.available || null].filter(Boolean).length;

  return (
    <>
      <Header title={t('people.title')} />
      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-5 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle>
          {t('people.title')}
          <span className="text-accent">.</span>
        </PageTitle>
        <Segmented
          label={t('people.title')}
          value={f.role ?? 'all'}
          onChange={(role) => setF((s) => ({ ...s, role }))}
          options={(['all', 'executors', 'customers'] as const).map((v) => ({
            value: v,
            label: t(`people.role.${v}`),
          }))}
        />
        <div className="flex items-center gap-2">
          <Glass radius="pill" className="flex h-12 min-w-0 flex-1 items-center gap-2 px-4">
            <Search size={18} className="shrink-0 text-text-2" aria-hidden />
            <input
              type="search"
              aria-label={t('people.search')}
              placeholder={t('people.search')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-text-2"
            />
          </Glass>
          <Chip
            selected={active > 0 || showFilters}
            icon={<SlidersHorizontal size={16} />}
            onClick={() => setShowFilters((v) => !v)}
          >
            {t('people.filters')}
            {active ? ` · ${active}` : ''}
          </Chip>
        </div>
        {showFilters && (
          <div className="card grid gap-4 p-5 md:grid-cols-2" data-testid="people-filters">
            <Select
              label={t('people.skill')}
              value={f.skill ?? ''}
              onChange={(e) => setF((s) => ({ ...s, skill: e.target.value || null }))}
              placeholder={t('people.anySkill')}
              options={skills.map((s) => ({
                value: s.slug,
                label: t(`skill.${s.slug}` as TranslationKey),
              }))}
            />
            <Input
              label={t('people.city')}
              value={f.city ?? ''}
              onChange={(e) => setF((s) => ({ ...s, city: e.target.value || null }))}
            />
            <div className="flex flex-col gap-2">
              <span className="text-callout font-bold">{t('people.rating')}</span>
              <div className="flex gap-2">
                {([null, 4, 4.5] as const).map((r) => (
                  <Chip
                    key={String(r)}
                    selected={(f.minRating ?? null) === r}
                    onClick={() => setF((s) => ({ ...s, minRating: r }))}
                  >
                    {r == null
                      ? t('people.ratingAny')
                      : r === 4
                        ? t('people.rating40')
                        : t('people.rating45')}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-callout font-bold">{t('people.available')}</span>
              <Toggle
                checked={!!f.available}
                onChange={(available) => setF((s) => ({ ...s, available }))}
                label={t('people.available')}
              />
            </div>
            <Select
              label={t('feed.sort')}
              value={f.sort ?? 'relevance'}
              onChange={(e) => setF((s) => ({ ...s, sort: e.target.value as PeopleQuery['sort'] }))}
              options={(['relevance', 'rating', 'experience'] as const).map((v) => ({
                value: v,
                label: t(`people.sort.${v}`),
              }))}
            />
            <div className="flex items-end">
              <Button variant="glass" onClick={() => setF({ ...EMPTY, role: f.role })}>
                {t('people.reset')}
              </Button>
            </div>
          </div>
        )}
        {list.isLoading ? (
          <CenterSpinner />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Users size={36} />}
            title={t('people.empty')}
            text={t('people.emptyText')}
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="people-list">
              {items.map((p) => (
                <PersonCard
                  key={p.id}
                  p={p}
                  onOffer={
                    p.platform_role !== 'customer'
                      ? () => setOffer({ id: p.id, name: p.name })
                      : undefined
                  }
                />
              ))}
            </div>
            {list.hasNextPage && (
              <Button
                variant="glass"
                className="self-center"
                disabled={list.isFetchingNextPage}
                onClick={() => list.fetchNextPage()}
              >
                {t('people.loadMore')}
              </Button>
            )}
          </>
        )}
      </main>
      <InviteSheet user={offer} onClose={() => setOffer(null)} />
    </>
  );
}
