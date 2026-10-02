'use client';

import { savedSearches, t, type SavedSearch, type TranslationKey } from '@parri/shared';
import { keys, useApiMutation, useSavedSearches } from '@parri/shared/react';
import { Bookmark, Copy, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/glass/Header';
import { LinkButton } from '@/components/ui/LinkButton';
import { CenterSpinner, EmptyState, PageTitle } from '@/components/ui/bits';
import { Card } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

function summary(s: SavedSearch): string {
  const p = s.params;
  return [
    t(`kind.${p.kind}`),
    p.query ? `«${p.query}»` : null,
    ...(p.categories ?? []).map((c) => t(`category.${c}`)),
    p.sort ? t(`sort.${p.sort}` as TranslationKey) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export default function SavedSearchesPage() {
  const saved = useSavedSearches();
  const toast = useToast();
  const copy = useApiMutation((sb, s: SavedSearch) => savedSearches.create(sb, `${s.name} ${t('saved.copySuffix')}`.slice(0, 60), s.params), {
    invalidate: () => [keys.saved],
    onSuccess: () => toast(t('saved.copied')),
  });
  const remove = useApiMutation((sb, id: string) => savedSearches.remove(sb, id), { invalidate: () => [keys.saved] });
  return (
    <>
      <Header title={t('saved.title')} />
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle subtitle={t('saved.everywhere')}>
          {t('saved.title')}
          <span className="text-accent">.</span>
        </PageTitle>
        {saved.isLoading ? (
          <CenterSpinner />
        ) : !saved.data?.length ? (
          <EmptyState icon={<Bookmark size={36} />} title={t('saved.empty')} action={<LinkButton href="/feed">{t('saved.new')}</LinkButton>} />
        ) : (
          saved.data.map((s) => (
            <Card key={s.id} className="flex flex-col gap-3">
              <div>
                <h2 className="text-title3 font-bold">{s.name}</h2>
                <p className="text-callout text-text-2">{summary(s)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/feed?saved=${s.id}`} className="inline-flex h-11 items-center rounded-pill bg-ink px-5 font-bold text-on-ink">
                  {t('saved.show')}
                </Link>
                <button type="button" onClick={() => copy.mutate(s)} className="inline-flex h-11 items-center gap-2 rounded-pill bg-fill px-4 font-bold">
                  <Copy size={16} />
                  {t('saved.copy')}
                </button>
                <button type="button" onClick={() => remove.mutate(s.id)} className="inline-flex h-11 items-center gap-2 rounded-pill bg-fill px-4 font-bold text-danger">
                  <Trash2 size={16} />
                  {t('saved.delete')}
                </button>
              </div>
            </Card>
          ))
        )}
        <LinkButton href="/feed" variant="glass">
          {t('saved.new')}
        </LinkButton>
      </main>
    </>
  );
}
