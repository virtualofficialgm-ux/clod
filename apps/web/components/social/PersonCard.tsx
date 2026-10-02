'use client';

import { t, type PersonCard as Person, type TranslationKey } from '@parri/shared';
import { BadgeCheck, MapPin, Star } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/glass/Button';
import { Avatar } from '@/components/ui/bits';

export function PersonCard({ p, onOffer }: { p: Person; onOffer?: () => void }) {
  return (
    <article className="card flex flex-col gap-3 p-5" data-testid="person">
      <Link href={`/u/${p.username ?? p.id}`} className="flex items-center gap-3">
        <Avatar name={p.name} url={p.avatar_url} size={56} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate text-body font-bold">
            {p.name}
            {p.verified && (
              <BadgeCheck
                size={16}
                className="shrink-0 text-accent"
                aria-label={t('people.verified')}
              />
            )}
            {p.plan === 'pro' && (
              <span className="rounded-pill bg-ink px-1.5 text-[11px] font-bold text-on-ink">
                PRO
              </span>
            )}
          </span>
          {p.headline && (
            <span className="block truncate text-callout text-text-2">{p.headline}</span>
          )}
        </span>
      </Link>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-2">
        <span className="inline-flex items-center gap-1">
          <Star size={13} className={p.rating_avg ? 'fill-accent text-accent' : ''} />
          {p.rating_avg
            ? `${Number(p.rating_avg).toFixed(1)} · ${p.rating_count}`
            : t('people.new')}
        </span>
        <span>{t('people.done', { n: p.completed_count })}</span>
        {p.city && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={13} /> {p.city}
          </span>
        )}
        <span className={p.availability === 'available' ? 'text-success' : ''}>
          {t(`people.availability.${p.availability}`)}
        </span>
      </div>
      {p.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {p.skills.slice(0, 4).map((s) => (
            <span key={s} className="rounded-pill bg-fill px-2.5 py-1 text-caption">
              {t(`skill.${s}` as TranslationKey)}
            </span>
          ))}
        </div>
      )}
      <div className="mt-auto flex gap-2">
        <Link
          href={`/u/${p.username ?? p.id}`}
          className="glass inline-flex h-10 flex-1 items-center justify-center rounded-pill text-callout font-bold"
        >
          {t('people.open')}
        </Link>
        {onOffer && (
          <Button size="md" className="flex-1 justify-center" onClick={onOffer}>
            {t('people.offer')}
          </Button>
        )}
      </div>
    </article>
  );
}
