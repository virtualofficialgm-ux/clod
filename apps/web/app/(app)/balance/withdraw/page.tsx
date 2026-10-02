'use client';

import {
  CRYPTO_NETWORKS,
  MONEY_LIMITS,
  ageOn,
  formatDateTime,
  formatMoney,
  money,
  parseDollars,
  t,
  type CryptoNetwork,
  type MoneyCurrency,
} from '@parri/shared';
import { keys, useApiMutation, useConnectAccount, useCryptoAddresses, useMe, usePayouts } from '@parri/shared/react';
import clsx from 'clsx';
import { Building2, CheckCircle2, Coins, CreditCard, ShieldCheck } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { Checkbox, FormError, Input } from '@/components/ui/Field';
import { PageTitle } from '@/components/ui/bits';
import { Card, CardHeader, ListGroup, ListRow, OptionTile, SoonBadge } from '@/components/ui/kit';

type Method = 'stripe' | 'usdt';

function WithdrawInner() {
  const me = useMe();
  const connect = useConnectAccount();
  const addresses = useCryptoAddresses();
  const payouts = usePayouts();
  const params = useSearchParams();
  const [method, setMethod] = useState<Method>(params.get('currency') === 'USDT' ? 'usdt' : 'stripe');
  const [amount, setAmount] = useState('');
  const [network, setNetwork] = useState<CryptoNetwork>('TRC20');
  const [address, setAddress] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [done, setDone] = useState(false);

  const currency: MoneyCurrency = method === 'usdt' ? 'USDT' : 'USD';
  const w = me.data?.wallet;
  const available = (method === 'usdt' ? w?.usdt_available_cents : w?.available_cents) ?? 0;
  const birth = me.data?.private.birth_date;
  const adult = !!birth && ageOn(new Date(birth.slice(0, 10) + 'T00:00:00')) >= MONEY_LIMITS.payoutMinAge;
  const cents = parseDollars(amount);
  const min = method === 'usdt' ? MONEY_LIMITS.payoutUsdtMinCents : MONEY_LIMITS.payoutCardMinCents;
  const ready = method === 'usdt' || !!connect.data?.payouts_enabled;

  // Возврат со страницы Stripe Connect: уточняем статус у Stripe
  const status = useApiMutation((sb) => money.connectStatus(sb), { invalidate: () => [keys.connect] });
  useEffect(() => {
    if (params.get('connect') === 'return') status.mutate(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setup = useApiMutation((sb) => money.connectOnboarding(sb, `${location.origin}/balance/withdraw?connect=return`), {
    onSuccess: (r) => location.assign(r.url),
  });
  const submit = useApiMutation(
    async (sb) => {
      if (method === 'usdt' && address && !addresses.data?.some((a) => a.address === address.trim())) {
        await money.saveCryptoAddress(sb, network, address).catch(() => {});
      }
      return money.requestPayout(sb, { method, amountCents: cents ?? 0, network: method === 'usdt' ? network : null, address: method === 'usdt' ? address : null, confirmed });
    },
    { invalidate: () => [keys.me, keys.payouts, keys.ledger, keys.addresses], onSuccess: () => setDone(true) },
  );

  return (
    <>
      <Header title={t('withdraw.title')} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle subtitle={t('withdraw.available', { sum: formatMoney(available, 'ru-RU', { currency }) })}>
          {t('withdraw.title')}
          <span className="text-accent">.</span>
        </PageTitle>

        {done ? (
          <Card className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 size={40} />
            </span>
            <h2 className="text-title3 font-bold">{t('withdraw.created')}</h2>
            <p className="max-w-md text-body text-text-2">{t('withdraw.createdText')}</p>
            <Button variant="glass" onClick={() => { setDone(false); setAmount(''); setConfirmed(false); }}>
              {t('withdraw.edit')}
            </Button>
          </Card>
        ) : !adult ? (
          <Card>
            <p className="text-body font-semibold">{t('withdraw.age')}</p>
          </Card>
        ) : (
          <>
            <section className="flex flex-col gap-2" role="radiogroup" aria-label={t('withdraw.method')}>
              <h2 className="text-callout font-bold">1. {t('withdraw.method')}</h2>
              <OptionTile selected={method === 'stripe'} onClick={() => setMethod('stripe')} icon={<CreditCard size={20} />} title={t('withdraw.stripe')} subtitle={t('withdraw.stripeHint')} />
              <OptionTile selected={method === 'usdt'} onClick={() => setMethod('usdt')} icon={<Coins size={20} />} title={t('withdraw.usdt')} subtitle={t('withdraw.usdtHint')} />
              <OptionTile disabled icon={<Building2 size={20} />} title={t('withdraw.others')} subtitle={<SoonBadge />} />
            </section>

            {method === 'stripe' && (
              <Card className="flex items-center gap-4">
                <span className={clsx('flex size-12 shrink-0 items-center justify-center rounded-full', ready ? 'bg-success/15 text-success' : 'bg-fill')}>
                  <ShieldCheck size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{ready ? t('withdraw.ready') : t('withdraw.setup')}</p>
                  <p className="text-callout text-text-2">{t('withdraw.setupHint')}</p>
                </div>
                {!ready && (
                  <Button size="md" disabled={setup.isPending} onClick={() => setup.mutate(undefined)}>
                    {connect.data ? t('withdraw.continueSetup') : t('withdraw.setup')}
                  </Button>
                )}
              </Card>
            )}
            <FormError error={setup.error?.key} />

            {method === 'usdt' && (
              <section className="flex flex-col gap-3">
                <h2 className="text-callout font-bold">2. {t('withdraw.network')}</h2>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('withdraw.network')}>
                  {CRYPTO_NETWORKS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={network === n}
                      onClick={() => setNetwork(n)}
                      className={clsx('h-11 rounded-pill px-5 font-bold', network === n ? 'bg-ink text-on-ink' : 'bg-fill')}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <Input label={t('withdraw.address')} value={address} onChange={(e) => setAddress(e.target.value)} className="font-mono" />
                {!!addresses.data?.length && (
                  <div className="flex flex-wrap gap-2">
                    {addresses.data.map((a) => (
                      <button key={a.id} type="button" onClick={() => { setNetwork(a.network); setAddress(a.address); }} className="rounded-pill bg-fill px-3 py-1.5 font-mono text-caption">
                        {a.network} · {a.address.slice(0, 6)}…{a.address.slice(-4)}
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="flex flex-col gap-3">
              <h2 className="text-callout font-bold">{method === 'usdt' ? '3' : '2'}. {t('withdraw.amount')}</h2>
              <label className="tile flex h-16 items-center gap-2 px-4">
                <span className="text-title3 font-bold text-text-2">{method === 'usdt' ? '₮' : '$'}</span>
                <input
                  inputMode="decimal"
                  aria-label={t('withdraw.amount')}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="tabular h-full min-w-0 flex-1 bg-transparent text-title3 font-extrabold outline-none"
                  placeholder={(min / 100).toString()}
                />
                <button type="button" onClick={() => setAmount((available / 100).toFixed(2))} className="rounded-pill bg-card-solid px-3 py-1 text-caption font-bold">
                  Max
                </button>
              </label>
              <p className="text-callout text-text-2">{t('withdraw.limits')}</p>
            </section>

            <Checkbox checked={confirmed} onChange={setConfirmed}>
              {t('withdraw.confirm')}
            </Checkbox>
            <FormError error={submit.error?.key} />
            <Button
              size="lg"
              block
              disabled={!ready || !confirmed || !cents || cents < min || cents > available || submit.isPending || (method === 'usdt' && !address.trim())}
              onClick={() => submit.mutate(undefined)}
            >
              {t('withdraw.submit')}
            </Button>
          </>
        )}

        <ListGroup title={t('withdraw.history')}>
          {(payouts.data ?? []).length === 0 ? (
            <ListRow title={t('balance.empty')} />
          ) : (
            (payouts.data ?? []).map((p) => (
              <ListRow
                key={p.id}
                title={formatMoney(p.amount_cents, 'ru-RU', { currency: p.currency })}
                subtitle={`${p.method === 'usdt' ? `USDT ${p.network}` : t('withdraw.stripe')} · ${formatDateTime(p.created_at)}${p.failure_reason ? ` · ${p.failure_reason}` : ''}`}
                value={t(`withdraw.status.${p.status}`)}
              />
            ))
          )}
        </ListGroup>
      </main>
    </>
  );
}

export default function WithdrawPage() {
  return (
    <Suspense>
      <WithdrawInner />
    </Suspense>
  );
}
