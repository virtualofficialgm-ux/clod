'use client';

import { SUBSCRIPTION_PRICES, formatDateTime, formatMoney, money, t, type TranslationKey } from '@parri/shared';
import { keys, useApiMutation, useMe, usePayments, useSubscription } from '@parri/shared/react';
import clsx from 'clsx';
import { Check, Crown, Sparkles } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { FormError } from '@/components/ui/Field';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageTitle } from '@/components/ui/bits';
import { ListGroup, ListRow, SoonBadge } from '@/components/ui/kit';

function Features({ group, n }: { group: 'freeFeatures' | 'proFeatures' | 'maxFeatures'; n: number }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className="flex items-start gap-2.5 text-body">
          <Check size={18} strokeWidth={3} className="mt-0.5 shrink-0 text-accent" />
          {t(`plans.${group}.f${i + 1}` as TranslationKey)}
        </li>
      ))}
    </ul>
  );
}

function SubscriptionInner() {
  const me = useMe();
  const sub = useSubscription();
  const payments = usePayments();
  const params = useSearchParams();
  const [interval, setInterval] = useState<'month' | 'year'>('year');
  const plan = me.data?.profile.plan ?? 'free';
  const active = sub.data && ['active', 'trialing', 'past_due'].includes(sub.data.status);
  const price = SUBSCRIPTION_PRICES.pro[interval];

  // После возврата из Stripe тариф обновит вебхук — перечитываем профиль несколько раз
  useEffect(() => {
    if (!params.get('payment')) return;
    const id = window.setInterval(() => {
      void me.refetch();
      void sub.refetch();
    }, 2000);
    const stop = window.setTimeout(() => window.clearInterval(id), 20000);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscribe = useApiMutation((sb) => money.subscribe(sb, interval, `${location.origin}/subscription`), {
    onSuccess: (r) => location.assign(r.url),
  });
  const portal = useApiMutation((sb) => money.portal(sb, `${location.origin}/subscription`), {
    invalidate: () => [keys.subscription],
    onSuccess: (r) => location.assign(r.url),
  });
  const history = (payments.data ?? []).filter((p) => p.kind === 'subscription');

  return (
    <>
      <Header title={t('plans.title')} />
      <main className="mx-auto flex max-w-[var(--p-content-max)] flex-col gap-6 px-[var(--p-gutter)] pt-2 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <PageTitle subtitle={t('plans.note')}>
            {t('plans.title')}
            <span className="text-accent">.</span>
          </PageTitle>
          <Segmented
            label={t('plans.title')}
            value={interval}
            onChange={setInterval}
            options={[
              { value: 'month', label: t('plans.month') },
              { value: 'year', label: t('plans.year') },
            ]}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <section className={clsx('card flex flex-col gap-5 p-6', plan === 'free' && 'ring-2 ring-ink')}>
            <div className="flex items-center justify-between">
              <h2 className="text-title3 font-bold">{t('plans.free')}</h2>
              {plan === 'free' && <span className="rounded-pill bg-ink px-3 py-1 text-caption text-on-ink">{t('plans.current')}</span>}
            </div>
            <p className="tabular text-number font-extrabold">{formatMoney(0)}</p>
            <Features group="freeFeatures" n={4} />
            <LinkButton href="/feed" variant="glass" className="mt-auto">
              {t('plans.start')}
            </LinkButton>
          </section>

          <section className={clsx('relative flex flex-col gap-5 overflow-hidden rounded-lg bg-ink p-6 text-on-ink', plan === 'pro' && 'ring-2 ring-accent')}>
            <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-accent/40 blur-3xl" />
            <div className="relative flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-title3 font-bold">
                <Sparkles size={20} className="text-accent" />
                {t('plans.pro')}
              </h2>
              {plan === 'pro' && <span className="rounded-pill bg-accent px-3 py-1 text-caption text-on-accent">{t('plans.current')}</span>}
            </div>
            <div className="relative">
              <p className="tabular text-number font-extrabold">
                {formatMoney(price)}
                <span className="text-body font-semibold opacity-70">{interval === 'year' ? t('plans.perYear') : t('plans.perMonth')}</span>
              </p>
              {interval === 'year' && <p className="text-callout opacity-75">{t('plans.yearHint', { sum: formatMoney(price / 12) })}</p>}
            </div>
            <div className="relative [&_li]:text-on-ink">
              <Features group="proFeatures" n={4} />
            </div>
            <div className="relative mt-auto flex flex-col gap-2">
              {active ? (
                <>
                  <p className="text-callout opacity-80">
                    {sub.data!.status === 'past_due'
                      ? t('plans.pastDue')
                      : sub.data!.cancel_at_period_end
                        ? t('plans.cancelsAt', { date: formatDateTime(sub.data!.current_period_end!) })
                        : t('plans.activeUntil', { date: formatDateTime(sub.data!.current_period_end!) })}
                  </p>
                  <Button size="lg" block disabled={portal.isPending} onClick={() => portal.mutate(undefined)}>
                    {t('plans.manage')}
                  </Button>
                </>
              ) : plan === 'pro' ? null : (
                <Button size="lg" block disabled={subscribe.isPending} onClick={() => subscribe.mutate(undefined)}>
                  {t('plans.connectPro')}
                </Button>
              )}
              <FormError error={subscribe.error?.key ?? portal.error?.key} />
            </div>
          </section>

          <section className="card flex flex-col gap-5 p-6 opacity-70">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-title3 font-bold">
                <Crown size={20} />
                {t('plans.max')}
              </h2>
              <SoonBadge />
            </div>
            <Features group="maxFeatures" n={3} />
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ListGroup title={t('plans.history')}>
            {history.length === 0 ? (
              <ListRow title={t('balance.empty')} />
            ) : (
              history.map((p) => (
                <ListRow key={p.id} title={formatMoney(p.amount_cents)} subtitle={formatDateTime(p.created_at)} value={t(`paymentStatus.${p.status}`)} />
              ))
            )}
          </ListGroup>
          <ListGroup>
            <ListRow title={t('plans.support')} href="/support" />
            <ListRow title={t('common.back')} href="/account" />
          </ListGroup>
        </div>
      </main>
    </>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense>
      <SubscriptionInner />
    </Suspense>
  );
}
