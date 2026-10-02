import { Clock, GraduationCap, Globe, Lock, ListChecks, MapPin, Scale } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { formatDistance, formatMoney, showcaseTasks, t } from '@parri/shared';
import { Glass } from '@/components/glass/Glass';
import { MeshBackground } from '@/components/glass/MeshBackground';
import { LinkButton } from '@/components/ui/LinkButton';
import { getServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: { absolute: `${t('app.name')} — ${t('app.tagline')}` } };

export default async function Landing() {
  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');

  const formats = [
    { icon: Globe, title: t('kind.online'), text: t('landing.formatOnline') },
    { icon: MapPin, title: t('kind.nearby'), text: t('landing.formatNearby') },
    { icon: GraduationCap, title: t('kind.campus'), text: t('landing.formatCampus') },
  ];
  const steps = [
    { title: t('landing.how1Title'), text: t('landing.how1') },
    { title: t('landing.how2Title'), text: t('landing.how2') },
    { title: t('landing.how3Title'), text: t('landing.how3') },
  ];
  const safety = [
    { icon: Lock, title: t('landing.safety1Title'), text: t('landing.safety1') },
    { icon: ListChecks, title: t('landing.safety2Title'), text: t('landing.safety2') },
    { icon: Scale, title: t('landing.safety3Title'), text: t('landing.safety3') },
  ];

  return (
    <>
      <MeshBackground />
      <header className="sticky top-0 z-30 px-[var(--p-gutter)] pt-3 md:px-8">
        <Glass radius="pill" className="mx-auto flex h-16 max-w-[var(--p-content-max)] items-center justify-between pl-6 pr-2">
          <span className="text-[28px] font-extrabold tracking-[-0.04em]">
            {t('app.name')}
            <span className="text-accent">.</span>
          </span>
          <nav className="flex items-center gap-2">
            <LinkButton href="/login" variant="glass" className="hidden sm:inline-flex">
              {t('landing.login')}
            </LinkButton>
            <LinkButton href="/register">{t('landing.start')}</LinkButton>
          </nav>
        </Glass>
      </header>

      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-24 px-[var(--p-gutter)] pb-24 pt-12 md:px-8 md:pt-20">
        <section className="grid grid-cols-[minmax(0,1fr)] items-center gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <h1 className="text-display font-extrabold">{t('landing.heroTitle')}</h1>
            <p className="max-w-xl text-title3 font-semibold text-text-2">{t('landing.heroSubtitle')}</p>
            <div className="flex flex-wrap gap-3">
              <LinkButton href="/register" size="lg">
                {t('landing.start')}
              </LinkButton>
              <LinkButton href="/login" size="lg" variant="glass">
                {t('landing.login')}
              </LinkButton>
            </div>
            <p className="text-callout text-text-2">{t('landing.cta')}</p>
          </div>

          <Glass radius="2xl" className="flex flex-col gap-3 p-4 md:p-5" aria-label={t('landing.examples')}>
            <p className="px-2 pt-1 text-caption uppercase tracking-wide text-text-2">{t('landing.examples')}</p>
            {showcaseTasks.map((task) => (
              <div key={task.id} className="card flex items-center gap-4 p-4">
                <span className="tabular w-20 shrink-0 text-title3 font-extrabold text-accent-text">
                  {formatMoney(task.rewardCents)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-body font-bold">{task.title}</p>
                  <p className="flex items-center gap-3 text-callout text-text-2">
                    <span>
                      {task.kind === 'nearby' && task.distanceM
                        ? `${t('kind.nearby')} · ${formatDistance(task.distanceM)}`
                        : task.kind === 'campus'
                          ? task.campusName
                          : t('kind.online')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={14} aria-hidden /> {t(`deadline.${task.deadline}`)}
                    </span>
                  </p>
                </div>
              </div>
            ))}
          </Glass>
        </section>

        <section className="flex flex-col gap-8">
          <h2 className="text-title1 font-extrabold">{t('landing.formatsTitle')}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {formats.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card flex flex-col gap-3 p-6">
                <Icon size={28} strokeWidth={2.4} className="text-accent-text" aria-hidden />
                <h3 className="text-title3 font-bold">{title}</h3>
                <p className="text-body text-text-2">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-8">
          <h2 className="text-title1 font-extrabold">{t('landing.howTitle')}</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.title} className="card flex flex-col gap-3 p-6">
                <span className="tabular text-price font-extrabold text-accent-text">{i + 1}</span>
                <h3 className="text-title3 font-bold">{s.title}</h3>
                <p className="text-body text-text-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex flex-col gap-8">
          <h2 className="text-title1 font-extrabold">{t('landing.safetyTitle')}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {safety.map(({ icon: Icon, title, text }) => (
              <div key={title} className="card flex flex-col gap-3 p-6">
                <Icon size={28} strokeWidth={2.4} className="text-accent-text" aria-hidden />
                <h3 className="text-title3 font-bold">{title}</h3>
                <p className="text-body text-text-2">{text}</p>
              </div>
            ))}
          </div>
          <p className="text-body font-semibold text-text-2">{t('fees.rule')}</p>
        </section>

        <section className="flex flex-col items-start gap-5">
          <h2 className="text-title1 font-extrabold">{t('landing.cta')}</h2>
          <LinkButton href="/register" size="lg">
            {t('landing.start')}
          </LinkButton>
        </section>
      </main>
    </>
  );
}
