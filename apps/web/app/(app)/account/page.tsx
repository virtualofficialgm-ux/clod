'use client';

import {
  formatMoney,
  languageName,
  profile as profileApi,
  profileCompleteness,
  shortName,
  t,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation, useMe, useSession, useSignOut } from '@parri/shared/react';
import {
  BadgeCheck,
  Bot,
  Scale,
  Bookmark,
  Briefcase,
  GraduationCap,
  LifeBuoy,
  Link2,
  ListChecks,
  LogOut,
  PenLine,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { NotificationBell } from '@/components/social/NotificationBell';
import { LinkButton } from '@/components/ui/LinkButton';
import { Avatar, CenterSpinner, PageTitle } from '@/components/ui/bits';
import {
  Card,
  CardHeader,
  ListGroup,
  ListRow,
  ProgressRing,
  SoonBadge,
  StatTile,
  Toggle,
} from '@/components/ui/kit';
import { usePrefs, type ThemePref } from '@/lib/prefs';

export default function AccountPage() {
  const me = useMe();
  const { session } = useSession();
  const prefs = usePrefs();
  const signOut = useSignOut();
  const router = useRouter();
  const notify = useApiMutation(
    (sb, on: boolean) => profileApi.saveData(sb, { notify_skill_tasks: on }),
    { invalidate: () => [keys.me] },
  );

  if (!me.data) return <CenterSpinner />;
  const p = me.data.profile;
  const name = shortName(p.first_name, p.last_name);
  const completeness = profileCompleteness(me.data);
  const staff = p.role === 'admin' || p.role === 'moderator';

  return (
    <>
      <Header
        title={t('account.title')}
        actions={
          <span className="md:hidden">
            <NotificationBell />
          </span>
        }
      />
      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-6 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle>
          {t('account.title')}
          <span className="text-accent">.</span>
        </PageTitle>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar name={name} url={p.avatar_url} size={84} />
              <div className="min-w-0 flex-1">
                <p
                  className="flex flex-wrap items-center gap-2 text-title2 font-extrabold"
                  data-testid="account-name"
                >
                  {p.display_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`}
                  {p.verified_at && (
                    <BadgeCheck
                      size={20}
                      className="text-accent"
                      aria-label={t('people.verified')}
                    />
                  )}
                </p>
                <p className="text-callout text-text-2">
                  {p.username ? `@${p.username}` : ''}
                  {p.city ? ` · ${p.city}` : ''}
                  {session?.user.email ? ` · ${session.user.email}` : ''}
                </p>
                {p.languages.length > 0 && (
                  <p className="text-caption text-text-2">
                    {p.languages.map((l) => languageName(l.code)).join(', ')}
                  </p>
                )}
                <p className="text-caption text-text-2">
                  {t('profile.parriId')}:{' '}
                  <span className="font-mono">{p.id.slice(0, 8).toUpperCase()}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/account/edit">
                <PenLine size={18} /> {t('profile.edit')}
              </LinkButton>
              <LinkButton href={`/u/${p.username ?? p.id}`} variant="glass">
                {t('profile.viewPublic')}
              </LinkButton>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile
                value={p.rating_avg ? Number(p.rating_avg).toFixed(1) : '—'}
                label={t('profile.rating')}
              />
              <StatTile value={p.completed_count} label={t('profile.completed')} />
              <StatTile value={p.rating_count} label={t('profile.reviews')} />
              <StatTile
                value={formatMoney(p.earned_cents, 'ru-RU', { compact: true })}
                label={t('profile.earned')}
              />
            </div>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="flex items-center gap-4">
              <ProgressRing
                value={completeness.percent / 100}
                size={72}
                stroke={8}
                label={t('account.completeness')}
              >
                <span className="text-callout font-extrabold">{completeness.percent}%</span>
              </ProgressRing>
              <div>
                <p className="font-bold">{t('account.completeness')}</p>
                <p className="text-callout text-text-2">{completeness.percent}%</p>
              </div>
            </Card>
            <Card className="flex flex-col gap-2 bg-ink text-on-ink">
              <p className="flex items-center gap-2 font-bold">
                <Shield size={18} /> {t('profile.passport')}
              </p>
              <p className="text-callout opacity-80">{t('profile.passportText')}</p>
            </Card>
            <Card>
              <CardHeader title={t('profile.trust')} />
              <ul className="flex flex-col gap-1.5 text-callout">
                {(['t1', 't2', 't3'] as const).map((k) => (
                  <li key={k}>✓ {t(`profile.trustItems.${k}`)}</li>
                ))}
              </ul>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ListGroup>
            <ListRow
              icon={<Star size={18} />}
              title={t('profile.sections.skillsPortfolio')}
              value={String(me.data.skills.length)}
              href="/account/edit#skills"
            />
            <ListRow
              icon={<GraduationCap size={18} />}
              title={t('profile.sections.educationExperience')}
              value={me.data.university?.name}
              href="/account/edit#experience"
            />
            <ListRow
              icon={<UserRound size={18} />}
              title={t('profile.sections.aboutInterests')}
              href="/account/edit#about"
            />
            <ListRow
              icon={<Link2 size={18} />}
              title={t('profile.sections.linksContacts')}
              href="/account/edit#links"
            />
            <ListRow
              icon={<ListChecks size={18} />}
              title={t('profile.sections.allTasks')}
              href="/my-tasks"
            />
            <ListRow
              icon={<Star size={18} />}
              title={t('profile.sections.reviews')}
              href={`/u/${p.username ?? p.id}?tab=reviews`}
            />
          </ListGroup>
          <ListGroup>
            <ListRow
              icon={<Sparkles size={18} />}
              title={t('profile.sections.subscription')}
              value={t(`account.${p.plan}` as TranslationKey)}
              href="/subscription"
            />
            <ListRow
              icon={<Users size={18} />}
              title={t('profile.sections.connections')}
              href="/connections"
            />
            <ListRow
              icon={<Search size={18} />}
              title={t('profile.sections.people')}
              href="/people"
            />
            <ListRow
              icon={<Bookmark size={18} />}
              title={t('profile.sections.savedSearches')}
              href="/saved"
            />
            <ListRow
              icon={<Wallet size={18} />}
              title={t('profile.sections.balance')}
              href="/balance"
            />
            <ListRow
              icon={<Briefcase size={18} />}
              title={t('profile.sections.settings')}
              href="/settings"
            />
            <ListRow icon={<LifeBuoy size={18} />} title={t('messages.support')} href="/support" />
            <ListRow icon={<Scale size={18} />} title={t('nav.disputes')} href="/disputes" />
            <ListRow icon={<BadgeCheck size={18} />} title={t('nav.verification')} value={p.verified_at ? t('verify.verified') : undefined} href="/verification" />
            <ListRow icon={<Bot size={18} />} title={t('nav.bot')} value={p.plan === 'pro' ? undefined : 'Pro'} href="/bot" />
            {staff && (
              <ListRow
                icon={<Settings size={18} />}
                title={t('profile.sections.admin')}
                href="/admin"
              />
            )}
          </ListGroup>
        </div>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-bold">{t('profile.skillNotify')}</p>
              <p className="text-callout text-text-2">{t('profile.skillNotifyHint')}</p>
            </div>
            <Toggle
              checked={p.notify_skill_tasks}
              onChange={(on) => notify.mutate(on)}
              label={t('profile.skillNotify')}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-bold">{t('settings.language')}</span>
            <span className="text-callout text-text-2">Русский</span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-bold">{t('account.theme')}</span>
            <Segmented<ThemePref>
              label={t('account.theme')}
              value={prefs.theme}
              onChange={(theme) => prefs.set({ theme })}
              options={[
                { value: 'system', label: t('common.themeSystem') },
                { value: 'light', label: t('common.themeLight') },
                { value: 'dark', label: t('common.themeDark') },
              ]}
            />
          </div>
        </Card>

        <div>
          <Button
            variant="glass"
            onClick={async () => {
              await signOut();
              router.replace('/');
              router.refresh();
            }}
          >
            <LogOut size={18} /> {t('account.logout')}
          </Button>
        </div>
      </main>
    </>
  );
}
