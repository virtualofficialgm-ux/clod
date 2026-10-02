'use client';

import { CRYPTO_NETWORKS, MONEY_LIMITS, formatMoney, money, parseDollars, t, type CryptoNetwork } from '@parri/shared';
import { keys, useApiMutation } from '@parri/shared/react';
import clsx from 'clsx';
import { Building2, Coins, Copy, CreditCard, Wallet } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { FormError } from '@/components/ui/Field';
import { OptionTile, SoonBadge } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

type Method = 'card' | 'usdt';

/** Пополнение: готовые суммы, своя сумма, способ (карта через Stripe, USDT через NOWPayments) */
export function TopupSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [method, setMethod] = useState<Method>('card');
  const [preset, setPreset] = useState<number | null>(2500);
  const [custom, setCustom] = useState('');
  const [network, setNetwork] = useState<CryptoNetwork>('TRC20');
  const [invoice, setInvoice] = useState<{ pay_address: string; pay_amount: number; network: CryptoNetwork } | null>(null);
  const amount = custom ? parseDollars(custom) : preset;
  const min = method === 'card' ? MONEY_LIMITS.topupCardMinCents : MONEY_LIMITS.topupUsdtMinCents;
  const valid = amount != null && amount >= min && amount <= 1_000_000;

  const card = useApiMutation((sb, cents: number) => money.topupCard(sb, cents, `${location.origin}/balance`), {
    onSuccess: (r) => {
      // Stripe Checkout: Apple Pay, Google Pay, карта; после оплаты Stripe вернёт на /balance?session_id=…
      sessionStorage.setItem('parri.lastPayment', r.payment_id);
      location.assign(r.url);
    },
  });
  const usdt = useApiMutation((sb, v: { cents: number; network: CryptoNetwork }) => money.topupUsdt(sb, v.cents, v.network), {
    invalidate: () => [keys.payments],
    onSuccess: (r) => setInvoice(r),
  });
  const busy = card.isPending || usdt.isPending;
  const error = card.error?.key ?? usdt.error?.key;

  const close = () => {
    setInvoice(null);
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={close}
      title={t('topup.title')}
      footer={
        invoice ? (
          <Button size="lg" block onClick={close}>
            {t('topup.toBalance')}
          </Button>
        ) : (
          <Button
            size="lg"
            block
            disabled={!valid || busy}
            onClick={() => (method === 'card' ? card.mutate(amount!) : usdt.mutate({ cents: amount!, network }))}
          >
            {method === 'card' ? t('topup.pay', { sum: valid ? formatMoney(amount!) : '' }) : t('topup.createAddress')}
          </Button>
        )
      }
    >
      {invoice ? (
        <div className="flex flex-col gap-4">
          <p className="text-body">{t('topup.usdtNote', { amount: String(invoice.pay_amount), network: invoice.network })}</p>
          <div className="tile flex flex-col gap-1 px-4 py-3">
            <span className="text-caption text-text-2">{t('topup.address')}</span>
            <span className="break-all font-mono text-callout font-bold">{invoice.pay_address}</span>
          </div>
          <Button
            variant="glass"
            onClick={() => {
              void navigator.clipboard?.writeText(invoice.pay_address);
              toast(t('common.copied'));
            }}
          >
            <Copy size={18} />
            {t('topup.copyAddress')}
          </Button>
          <p className="text-callout text-text-2">{t('topup.waiting')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-callout font-bold">{t('topup.amount')}</h3>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label={t('topup.amount')}>
              {MONEY_LIMITS.topupPresetsCents.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={!custom && preset === c}
                  onClick={() => {
                    setPreset(c);
                    setCustom('');
                  }}
                  className={clsx(
                    'relative flex h-16 flex-col items-center justify-center rounded-md font-extrabold transition-colors',
                    !custom && preset === c ? 'bg-ink text-on-ink' : 'bg-fill hover:bg-fill-strong',
                  )}
                >
                  <span className="tabular text-title3">{formatMoney(c)}</span>
                  {c === 2500 && <span className="text-[11px] font-bold opacity-70">{t('topup.popular')}</span>}
                </button>
              ))}
            </div>
            <label className="tile flex h-14 items-center gap-2 px-4">
              <span className="text-body font-bold text-text-2">$</span>
              <input
                inputMode="decimal"
                aria-label={t('topup.custom')}
                placeholder={t('topup.custom')}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent text-body font-bold outline-none placeholder:font-medium placeholder:text-text-3"
              />
            </label>
          </section>

          <section className="flex flex-col gap-2" role="radiogroup" aria-label={t('topup.method')}>
            <h3 className="text-callout font-bold">{t('topup.method')}</h3>
            <OptionTile selected={method === 'card'} onClick={() => setMethod('card')} icon={<CreditCard size={20} />} title={t('topup.card')} subtitle={t('topup.cardHint')} />
            <OptionTile selected={method === 'usdt'} onClick={() => setMethod('usdt')} icon={<Coins size={20} />} title={t('topup.usdt')} subtitle={t('topup.usdtHint')} />
            {method === 'usdt' && (
              <div className="flex flex-wrap gap-2 pl-2" role="radiogroup" aria-label={t('topup.network')}>
                {CRYPTO_NETWORKS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={network === n}
                    onClick={() => setNetwork(n)}
                    className={clsx('flex flex-col items-start rounded-md px-4 py-2 text-left', network === n ? 'bg-ink text-on-ink' : 'bg-fill')}
                  >
                    <span className="font-bold">{n}</span>
                    <span className="text-caption opacity-75">{t(`topup.networkHint.${n}`)}</span>
                  </button>
                ))}
              </div>
            )}
            <OptionTile disabled icon={<Building2 size={20} />} title={t('topup.bank')} subtitle={<SoonBadge />} />
            <OptionTile disabled icon={<Wallet size={20} />} title={t('topup.wallets')} subtitle={<SoonBadge />} />
          </section>
          <p className="text-callout text-text-2">{method === 'card' ? t('topup.feeNote') : t('topup.usdtHint')}</p>
          <FormError error={error} />
        </div>
      )}
    </BottomSheet>
  );
}
