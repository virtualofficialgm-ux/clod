import { money, t } from '@parri/shared';
import { keys, useApiMutation, useConnectAccount, useCryptoAddresses } from '@parri/shared/react';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { Coins, CreditCard, Trash2 } from '@/components/icons';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { PageTitle } from '@/components/ui/bits';
import { ListGroup, ListRow, PillButton } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

export default function Methods() {
  const { colors } = useTheme();
  const connect = useConnectAccount();
  const addresses = useCryptoAddresses();
  const remove = useApiMutation((sb, id: string) => money.removeCryptoAddress(sb, id), { invalidate: () => [keys.addresses] });
  return (
    <Screen title={t('methods.title')} leading={<BackButton to="/balance" />}>
      <PageTitle>{t('methods.title')}</PageTitle>
      <ListGroup>
        <ListRow
          icon={(c) => <CreditCard size={18} color={c} />}
          title={t('methods.connect')}
          subtitle={connect.data?.payouts_enabled ? t('methods.connectOn') : t('methods.connectOff')}
          onPress={() => router.push('/balance/withdraw')}
        />
      </ListGroup>
      <ListGroup title={t('methods.addresses')}>
        {(addresses.data ?? []).length
          ? (addresses.data ?? []).map((a) => (
              <ListRow
                key={a.id}
                icon={(c) => <Coins size={18} color={c} />}
                title={a.label ?? a.network}
                subtitle={`${a.network} · ${a.address}`}
                trailing={
                  <Pressable accessibilityLabel={t('common.delete')} onPress={() => remove.mutate(a.id)} hitSlop={8}>
                    <Trash2 size={18} color={colors.danger} />
                  </Pressable>
                }
              />
            ))
          : [<ListRow key="e" title={t('methods.none')} />]}
      </ListGroup>
      <PillButton tone="fill" label={t('methods.add')} onPress={() => router.push('/balance/withdraw?currency=USDT')} />
    </Screen>
  );
}
