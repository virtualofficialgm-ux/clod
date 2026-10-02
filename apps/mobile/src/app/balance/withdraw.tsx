import { CRYPTO_NETWORKS, MONEY_LIMITS, ageOn, formatDateTime, formatMoney, money, parseDollars, t, type CryptoNetwork, type MoneyCurrency } from '@parri/shared';
import { keys, useApiMutation, useConnectAccount, useCryptoAddresses, useMe, usePayouts } from '@parri/shared/react';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Building2Icon, CircleCheck, Coins, CreditCard, ShieldCheck } from '@/components/icons';
import { Checkbox } from '@/components/ui/Checkbox';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField } from '@/components/ui/TextField';
import { PageTitle } from '@/components/ui/bits';
import { Card, ListGroup, ListRow, OptionTile } from '@/components/ui/kit';
import { openProviderPage, returnUrl } from '@/lib/checkout';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

export default function Withdraw() {
  const { colors } = useTheme();
  const me = useMe();
  const connect = useConnectAccount();
  const addresses = useCryptoAddresses();
  const payouts = usePayouts();
  const params = useLocalSearchParams<{ currency?: string }>();
  const [method, setMethod] = useState<'stripe' | 'usdt'>(params.currency === 'USDT' ? 'usdt' : 'stripe');
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

  const status = useApiMutation((sb) => money.connectStatus(sb), { invalidate: () => [keys.connect] });
  const setup = useApiMutation((sb) => money.connectOnboarding(sb, returnUrl('/balance/withdraw?connect=return')), {
    onSuccess: async (r) => {
      if ((await openProviderPage(r.url)) === 'returned') status.mutate(undefined);
    },
  });
  const submit = useApiMutation(
    async (sb) => {
      if (method === 'usdt' && address && !addresses.data?.some((a) => a.address === address.trim())) await money.saveCryptoAddress(sb, network, address).catch(() => {});
      return money.requestPayout(sb, { method, amountCents: cents ?? 0, network: method === 'usdt' ? network : null, address: method === 'usdt' ? address : null, confirmed });
    },
    { invalidate: () => [keys.me, keys.payouts, keys.ledger, keys.addresses], onSuccess: () => setDone(true) },
  );

  return (
    <Screen title={t('withdraw.title')} leading={<BackButton to="/balance" />}>
      <PageTitle subtitle={t('withdraw.available', { sum: formatMoney(available, 'ru-RU', { currency }) })}>{t('withdraw.title')}</PageTitle>
      {done ? (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <CircleCheck size={48} color={colors.success} />
          <AppText variant="title3">{t('withdraw.created')}</AppText>
          <AppText variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
            {t('withdraw.createdText')}
          </AppText>
        </Card>
      ) : !adult ? (
        <Card>
          <AppText variant="bodyStrong">{t('withdraw.age')}</AppText>
        </Card>
      ) : (
        <>
          <OptionTile selected={method === 'stripe'} onPress={() => setMethod('stripe')} icon={(c) => <CreditCard size={20} color={c} />} title={t('withdraw.stripe')} subtitle={t('withdraw.stripeHint')} />
          <OptionTile selected={method === 'usdt'} onPress={() => setMethod('usdt')} icon={(c) => <Coins size={20} color={c} />} title={t('withdraw.usdt')} subtitle={t('withdraw.usdtHint')} />
          <OptionTile disabled icon={(c) => <Building2Icon size={20} color={c} />} title={t('withdraw.others')} subtitle={t('common.soon')} />
          {method === 'stripe' ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <ShieldCheck size={24} color={ready ? colors.success : colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{ready ? t('withdraw.ready') : t('withdraw.setup')}</AppText>
                <AppText variant="callout" color="textSecondary">
                  {t('withdraw.setupHint')}
                </AppText>
                {!ready ? <Button label={connect.data ? t('withdraw.continueSetup') : t('withdraw.setup')} disabled={setup.isPending} onPress={() => setup.mutate(undefined)} style={{ marginTop: 8 }} /> : null}
              </View>
            </Card>
          ) : (
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CRYPTO_NETWORKS.map((n) => (
                  <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: network === n }} onPress={() => setNetwork(n)} style={{ height: 44, paddingHorizontal: 18, borderRadius: 999, justifyContent: 'center', backgroundColor: network === n ? colors.ink : colors.fill }}>
                    <AppText variant="bodyStrong" style={{ color: network === n ? colors.onInk : colors.text }}>
                      {n}
                    </AppText>
                  </Pressable>
                ))}
              </View>
              <TextField label={t('withdraw.address')} value={address} onChangeText={setAddress} autoCapitalize="none" />
              {(addresses.data ?? []).map((a) => (
                <Pressable key={a.id} onPress={() => { setNetwork(a.network); setAddress(a.address); }}>
                  <AppText variant="caption" color="accentText">
                    {a.network} · {a.address.slice(0, 6)}…{a.address.slice(-4)}
                  </AppText>
                </Pressable>
              ))}
            </View>
          )}
          <FormError error={setup.error?.key} />
          <View style={{ gap: 6 }}>
            <AppText variant="callout" style={{ fontFamily: familyByWeight['700'] }}>
              {t('withdraw.amount')}
            </AppText>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              accessibilityLabel={t('withdraw.amount')}
              placeholder={(min / 100).toString()}
              placeholderTextColor={colors.textTertiary}
              style={{ height: 64, borderRadius: 18, paddingHorizontal: 16, fontSize: 24, fontFamily: familyByWeight['800'], backgroundColor: colors.fill, color: colors.text }}
            />
            <AppText variant="callout" color="textSecondary">
              {t('withdraw.limits')}
            </AppText>
          </View>
          <Checkbox checked={confirmed} onChange={setConfirmed} label={t('withdraw.confirm')} />
          <FormError error={submit.error?.key} />
          <Button
            size="lg"
            block
            label={t('withdraw.submit')}
            disabled={!ready || !confirmed || !cents || cents < min || cents > available || submit.isPending || (method === 'usdt' && !address.trim())}
            onPress={() => submit.mutate(undefined)}
          />
        </>
      )}
      <ListGroup title={t('withdraw.history')}>
        {(payouts.data ?? []).length
          ? (payouts.data ?? []).map((p) => (
              <ListRow key={p.id} title={formatMoney(p.amount_cents, 'ru-RU', { currency: p.currency })} subtitle={formatDateTime(p.created_at)} value={t(`withdraw.status.${p.status}`)} />
            ))
          : [<ListRow key="e" title={t('balance.empty')} />]}
      </ListGroup>
    </Screen>
  );
}
