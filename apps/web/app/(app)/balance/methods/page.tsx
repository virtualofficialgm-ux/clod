'use client';

import { money, t } from '@parri/shared';
import { keys, useApiMutation, useConnectAccount, useCryptoAddresses } from '@parri/shared/react';
import { Coins, CreditCard, Trash2 } from 'lucide-react';
import { Header } from '@/components/glass/Header';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageTitle } from '@/components/ui/bits';
import { ListGroup, ListRow } from '@/components/ui/kit';

export default function MethodsPage() {
  const connect = useConnectAccount();
  const addresses = useCryptoAddresses();
  const remove = useApiMutation((sb, id: string) => money.removeCryptoAddress(sb, id), { invalidate: () => [keys.addresses] });
  return (
    <>
      <Header title={t('methods.title')} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle>
          {t('methods.title')}
          <span className="text-accent">.</span>
        </PageTitle>
        <ListGroup>
          <ListRow
            icon={<CreditCard size={18} />}
            title={t('methods.connect')}
            subtitle={connect.data?.payouts_enabled ? t('methods.connectOn') : t('methods.connectOff')}
            href="/balance/withdraw"
            value={connect.data?.payouts_enabled ? undefined : t('methods.configure')}
          />
        </ListGroup>
        <ListGroup title={t('methods.addresses')}>
          {(addresses.data ?? []).length === 0 ? (
            <ListRow title={t('methods.none')} />
          ) : (
            (addresses.data ?? []).map((a) => (
              <ListRow
                key={a.id}
                icon={<Coins size={18} />}
                title={a.label ?? a.network}
                subtitle={`${a.network} · ${a.address}`}
                trailing={
                  <button type="button" aria-label={t('common.delete')} onClick={() => remove.mutate(a.id)} className="flex size-10 items-center justify-center rounded-full text-danger hover:bg-fill">
                    <Trash2 size={18} />
                  </button>
                }
              />
            ))
          )}
        </ListGroup>
        <LinkButton href="/balance/withdraw?currency=USDT" variant="glass">
          {t('methods.add')}
        </LinkButton>
      </main>
    </>
  );
}
