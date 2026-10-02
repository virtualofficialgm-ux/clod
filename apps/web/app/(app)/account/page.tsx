'use client';

import { formatMoney, shortName, t, type TranslationKey } from '@parri/shared';
import { useMe, useSignOut } from '@parri/shared/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { Avatar, PageTitle, SectionTitle } from '@/components/ui/bits';
import { usePrefs, type ThemePref } from '@/lib/prefs';

export default function AccountPage() {
  const me = useMe();
  const prefs = usePrefs();
  const signOut = useSignOut();
  const router = useRouter();
  const p = me.data?.profile;
  const name = shortName(p?.first_name, p?.last_name);

  return (
    <>
      <Header title={t('account.title')} />
      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-6 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle>
          {t('account.title')}
          <span className="text-accent">.</span>
        </PageTitle>
        <div className="card flex items-center gap-4 p-6">
          <Avatar name={name} url={p?.avatar_url} size={64} />
          <div className="min-w-0">
            <p className="truncate text-title3 font-bold">
              {p?.first_name} {p?.last_name}
            </p>
            <p className="text-callout text-text-2">
              {t('account.stats', { n: p?.completed_count ?? 0 })} · {formatMoney(p?.earned_cents ?? 0)} · {t(`account.${p?.plan ?? 'free'}` as TranslationKey)}
            </p>
            <p className="text-callout text-text-2">{me.data?.university?.name ?? `${t('account.university')}: ${t('account.noUniversity')}`}</p>
          </div>
        </div>
        {!!me.data?.skills.length && (
          <section className="flex flex-col gap-3">
            <SectionTitle>{t('account.skills')}</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {me.data.skills.map((s) => (
                <span key={s} className="rounded-pill bg-separator px-4 py-2 text-callout font-semibold">
                  {t(`skill.${s}` as TranslationKey)}
                </span>
              ))}
            </div>
          </section>
        )}
        <section className="flex flex-col gap-3">
          <SectionTitle>{t('account.theme')}</SectionTitle>
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
        </section>
        <div>
          <Button
            variant="glass"
            onClick={async () => {
              await signOut();
              router.replace('/');
              router.refresh();
            }}
          >
            {t('account.logout')}
          </Button>
        </div>
      </main>
    </>
  );
}
