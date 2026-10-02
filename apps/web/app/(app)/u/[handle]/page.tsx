'use client';

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
import clsx from 'clsx';
import {
  BadgeCheck,
  Ban,
  ChevronLeft,
  ExternalLink,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Star,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { InviteSheet } from '@/components/social/InviteSheet';
import { ConfirmSheet } from '@/components/task/ConfirmSheet';
import { categoryIcon } from '@/components/task/categoryIcon';
import { LinkButton } from '@/components/ui/LinkButton';
import { Avatar, CenterSpinner, EmptyState } from '@/components/ui/bits';
import { Card, CardHeader, StatTile } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

type Tab = 'profile' | 'portfolio' | 'reviews';

function Actions({ p }: { p: PublicProfile }) {
  const toast = useToast();
  const router = useRouter();
  const [more, setMore] = useState(false);
  const [block, setBlock] = useState(false);
  const [offer, setOffer] = useState(false);
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
      if (!r.blocked) router.push('/people');
    },
  });
  const contactLabel = {
    none: t('profile.addContact'),
    outgoing: t('profile.cancelRequest'),
    incoming: t('profile.acceptRequest'),
    accepted: t('profile.removeContact'),
  }[r.contact];
  const err = follow.error ?? contact.error;

  if (r.self) {
    return (
      <div className="flex flex-wrap gap-2">
        <LinkButton href="/account/edit">{t('profile.edit')}</LinkButton>
        <LinkButton href="/account" variant="glass">
          {t('account.title')}
        </LinkButton>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {(r.can_follow || r.following) && (
          <Button
            variant={r.following ? 'glass' : 'primary'}
            onClick={() => follow.mutate(undefined)}
            disabled={follow.isPending}
          >
            {r.following ? <UserCheck size={18} /> : <UserPlus size={18} />}
            {r.following ? t('profile.following') : t('profile.follow')}
          </Button>
        )}
        <Button
          variant="glass"
          onClick={() => contact.mutate(undefined)}
          disabled={contact.isPending}
        >
          {contactLabel}
        </Button>
        {r.can_message && (
          <LinkButton href={`/messages/u/${p.id}`} variant="glass">
            <MessageCircle size={18} /> {t('profile.write')}
          </LinkButton>
        )}
        {r.can_invite && p.platform_role !== 'customer' && (
          <Button onClick={() => setOffer(true)}>{t('profile.offerTask')}</Button>
        )}
        <div className="relative">
          <Button
            variant="glass"
            size="icon"
            aria-label={t('common.more')}
            aria-expanded={more}
            onClick={() => setMore((v) => !v)}
          >
            <MoreHorizontal size={18} />
          </Button>
          {more && (
            <div className="card absolute right-0 top-14 z-20 flex w-60 flex-col p-2">
              <button
                type="button"
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-callout font-semibold hover:bg-fill"
                onClick={() => {
                  setMore(false);
                  void navigator.clipboard?.writeText(location.href);
                  toast(t('task.linkCopied'));
                }}
              >
                <Share2 size={16} /> {t('profile.share')}
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-callout font-semibold text-danger hover:bg-fill"
                onClick={() => {
                  setMore(false);
                  setBlock(true);
                }}
              >
                <Ban size={16} /> {r.blocked ? t('profile.unblock') : t('profile.block')}
              </button>
            </div>
          )}
        </div>
      </div>
      {err && (
        <p className="text-callout font-semibold text-danger">{t(err.key as TranslationKey)}</p>
      )}
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
    </div>
  );
}

function Reviews({ userId }: { userId: string }) {
  const { data = [], isLoading } = useReviewsOf(userId);
  const [rating, setRating] = useState<number | null>(null);
  const [sort, setSort] = useState<'new' | 'old'>('new');
  const shown = useMemo(() => {
    const f = data.filter((r) => rating == null || r.rating === rating);
    return sort === 'new' ? f : [...f].reverse();
  }, [data, rating, sort]);
  if (isLoading) return <CenterSpinner />;
  if (!data.length) return <EmptyState title={t('profile.noReviews')} />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip selected={rating == null} onClick={() => setRating(null)}>
          {t('common.all')}
        </Chip>
        {[5, 4, 3, 2, 1].map((n) => (
          <Chip key={n} selected={rating === n} onClick={() => setRating(n)}>
            ★ {n}
          </Chip>
        ))}
        <div className="ml-auto">
          <Segmented
            label={t('feed.sort')}
            value={sort}
            onChange={setSort}
            options={[
              { value: 'new', label: t('profile.sortNew') },
              { value: 'old', label: t('profile.sortOld') },
            ]}
          />
        </div>
      </div>
      <ul className="flex flex-col gap-3" data-testid="reviews">
        {shown.map((r) => (
          <li key={r.id} className="card flex flex-col gap-2 p-5">
            <div className="flex items-center gap-3">
              <Avatar name={r.author_name ?? ''} url={r.author_avatar} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{r.author_name}</p>
                <p className="text-caption text-text-2">
                  {formatDateTime(r.created_at)}
                  {r.task_title ? ` · ${r.task_title}` : ''}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 font-bold">
                <Star size={16} className="fill-accent text-accent" /> {r.rating}
              </span>
            </div>
            {r.public_text && <p className="whitespace-pre-line">{r.public_text}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PublicProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const router = useRouter();
  const { data: p, isLoading } = usePublicProfile(decodeURIComponent(handle));
  const [tab, setTab] = useState<Tab>('profile');
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('tab');
    if (q === 'reviews' || q === 'portfolio') setTab(q);
  }, []);

  if (isLoading) return <CenterSpinner />;
  if (!p) {
    return (
      <main className="mx-auto max-w-[var(--p-content-max)] px-[var(--p-gutter)] pt-8 md:px-8">
        <EmptyState
          title={t('profile.notFound')}
          action={<LinkButton href="/people">{t('people.title')}</LinkButton>}
        />
      </main>
    );
  }
  if (p.private) {
    return (
      <main className="mx-auto flex max-w-[760px] flex-col items-center gap-4 px-[var(--p-gutter)] pt-12 text-center md:px-8">
        <Avatar name={p.name} url={p.avatar_url} size={96} />
        <h1 className="text-title2 font-extrabold">{p.name}</h1>
        <p className="text-text-2">{t('profile.private')}</p>
      </main>
    );
  }

  const online = isOnline(p.last_seen_at);
  const s = p.stats;
  const aspects = p.aspects && Object.entries(p.aspects).filter(([, v]) => v != null);

  return (
    <>
      <Header
        title={p.name}
        leading={
          <Button
            variant="glass"
            size="icon"
            aria-label={t('common.back')}
            onClick={() => router.back()}
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Button>
        }
      />
      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-6 px-[var(--p-gutter)] pt-2 md:px-8">
        <Card className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="relative self-start">
            <Avatar name={p.name} url={p.avatar_url} size={104} />
            {online && (
              <span
                className="absolute bottom-1 right-1 size-5 rounded-full border-4 border-[var(--p-card)] bg-success"
                aria-label={t('profile.online')}
              />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <h1
              className="flex flex-wrap items-center gap-2 text-title2 font-extrabold"
              data-testid="profile-name"
            >
              {p.display_name || p.name}
              {p.verified && (
                <BadgeCheck size={22} className="text-accent" aria-label={t('people.verified')} />
              )}
              {p.plan === 'pro' && (
                <span className="rounded-pill bg-ink px-2 py-0.5 text-caption font-bold text-on-ink">
                  PRO
                </span>
              )}
            </h1>
            <p className="text-callout text-text-2">
              {p.username ? `@${p.username} · ` : ''}
              {t(`profile.role.${p.platform_role}`)}
            </p>
            {(p.headline || p.profession) && (
              <p className="text-body font-semibold">{p.headline || p.profession}</p>
            )}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-text-2">
              {(p.city || p.country_code) && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={13} />{' '}
                  {[p.city, p.country_code ? countryName(p.country_code) : null]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              )}
              <span className={p.availability === 'available' ? 'text-success' : ''}>
                {t(`people.availability.${p.availability}`)}
              </span>
              {online ? (
                <span className="text-success">{t('profile.online')}</span>
              ) : p.last_seen_at ? (
                <span>{t('profile.lastSeen', { ago: formatAgo(p.last_seen_at) })}</span>
              ) : null}
              {p.response_time && (
                <span>{t('profile.responseTime', { t: t(`profile.rt.${p.response_time}`) })}</span>
              )}
              <span>
                {t('profile.memberSince', {
                  date: new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(
                    new Date(p.created_at),
                  ),
                })}
              </span>
            </p>
          </div>
          <Actions p={p} />
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile
            value={s.rating_avg ? Number(s.rating_avg).toFixed(1) : '—'}
            label={t('profile.rating')}
          />
          <StatTile value={s.completed} label={t('profile.completed')} />
          <StatTile value={s.rating_count} label={t('profile.reviews')} />
          <StatTile value={s.followers} label={t('profile.followers')} />
          <StatTile value={s.contacts} label={t('profile.contacts')} />
        </div>

        <Segmented
          label={t('profile.tabs.profile')}
          value={tab}
          onChange={setTab}
          options={(['profile', 'portfolio', 'reviews'] as const).map((v) => ({
            value: v,
            label: t(`profile.tabs.${v}`),
          }))}
        />

        {tab === 'profile' && (
          <div className="grid gap-4 lg:grid-cols-2">
            {p.bio && (
              <Card>
                <CardHeader title={t('profile.about')} />
                <p className="whitespace-pre-line">{p.bio}</p>
              </Card>
            )}
            {(p.skills.length > 0 || p.custom_skills.length > 0) && (
              <Card>
                <CardHeader title={t('profile.skills')} />
                <div className="flex flex-wrap gap-1.5">
                  {p.skills.map((x) => (
                    <span key={x.slug} className="rounded-pill bg-fill px-3 py-1.5 text-callout">
                      {t(`skill.${x.slug}` as TranslationKey)}
                      {x.level && (
                        <span className="ml-1 text-caption uppercase text-text-2">{x.level}</span>
                      )}
                    </span>
                  ))}
                  {p.custom_skills.map((x) => (
                    <span key={x} className="rounded-pill bg-fill px-3 py-1.5 text-callout">
                      {x}
                    </span>
                  ))}
                </div>
              </Card>
            )}
            {aspects && aspects.length > 0 && (
              <Card>
                <CardHeader title={t('profile.aspects')} />
                <dl className="grid grid-cols-2 gap-2">
                  {aspects.map(([k, v]) => (
                    <div key={k} className="tile px-4 py-3">
                      <dt className="text-caption text-text-2">
                        {t(`rate.${k}` as TranslationKey)}
                      </dt>
                      <dd className="font-bold">★ {v}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}
            {p.languages.length > 0 && (
              <Card>
                <CardHeader title={t('profile.languages')} />
                <ul className="flex flex-col gap-1">
                  {p.languages.map((l) => (
                    <li key={l.code} className="flex justify-between">
                      <span>{languageName(l.code)}</span>
                      <span className="text-text-2">
                        {t(`onb.levels.${l.level}` as TranslationKey)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {(p.experience.length > 0 || p.university) && (
              <Card>
                <CardHeader title={`${t('profile.experience')} · ${t('profile.education')}`} />
                <ul className="flex flex-col gap-2">
                  {p.experience.map((e) => (
                    <li key={e.id}>
                      <p className="font-bold">{e.position}</p>
                      <p className="text-callout text-text-2">
                        {e.company}
                        {e.from_year ? ` · ${e.from_year}–${e.to_year ?? '…'}` : ''}
                      </p>
                    </li>
                  ))}
                  {p.university && <li className="font-semibold">{p.university.name}</li>}
                </ul>
              </Card>
            )}
            {p.links.length > 0 && (
              <Card>
                <CardHeader title={t('profile.links')} />
                <ul className="flex flex-col gap-1.5">
                  {p.links.map((l) => (
                    <li key={l.url}>
                      <a
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-1.5 font-semibold text-accent-text"
                      >
                        <ExternalLink size={14} /> {l.title || l.url}
                      </a>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {p.open_tasks.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader title={t('profile.openTasks')} />
                <ul className="grid gap-2 md:grid-cols-2">
                  {p.open_tasks.map((x) => {
                    const Icon = categoryIcon(x.category);
                    return (
                      <li key={x.id}>
                        <Link
                          href={`/tasks/${x.id}`}
                          className="tile flex items-center gap-3 px-4 py-3 hover:bg-fill-strong"
                        >
                          <Icon size={18} className="shrink-0" />
                          <span className="min-w-0 flex-1 truncate font-semibold">{x.title}</span>
                          <span className="tabular font-bold">
                            {formatMoney(x.reward_cents, 'ru-RU', { currency: x.currency })}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
            <Card className={clsx('flex flex-col gap-2', 'lg:col-span-2')}>
              <CardHeader title={t('profile.trust')} />
              <ul className="grid gap-2 md:grid-cols-3">
                {(['t1', 't2', 't3'] as const).map((k) => (
                  <li key={k} className="tile px-4 py-3 text-callout font-semibold">
                    ✓ {t(`profile.trustItems.${k}`)}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === 'portfolio' &&
          (p.portfolio.length === 0 ? (
            <EmptyState title={t('profile.noPortfolio')} />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {p.portfolio.map((w) => (
                <li key={w.id} className="card flex flex-col gap-2 p-5">
                  <p className="font-bold">{w.title}</p>
                  {w.category && (
                    <p className="text-caption text-text-2">{t(`category.${w.category}`)}</p>
                  )}
                  <div className="mt-auto flex gap-2">
                    {w.url && (
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="glass inline-flex h-10 items-center gap-1.5 rounded-pill px-4 text-callout font-bold"
                      >
                        <ExternalLink size={14} /> {t('profile.openMaterial')}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'reviews' && <Reviews userId={p.id} />}
      </main>
    </>
  );
}
