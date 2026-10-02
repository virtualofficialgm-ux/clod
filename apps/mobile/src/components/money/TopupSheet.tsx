import { CRYPTO_NETWORKS, MONEY_LIMITS, formatMoney, money, parseDollars, t, type CryptoNetwork } from '@parri/shared';
import { keys, useApiMutation } from '@parri/shared/react';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Building2Icon, Coins, Copy, CreditCard, Wallet } from '@/components/icons';
import { FormError } from '@/components/ui/TextField';
import { OptionTile } from '@/components/ui/kit';
import { useToast } from '@/components/ui/bits';
import { openProviderPage, returnUrl } from '@/lib/checkout';
import { familyByWeight } from '@/theme/fonts';
import { useTheme } from '@/theme/ThemeProvider';

/** Пополнение: готовые суммы, своя сумма, карта (Stripe) или USDT (NOWPayments) */
export function TopupSheet({ open, onClose, onCheckoutClosed }: { open: boolean; onClose: () => void; onCheckoutClosed: (paymentId: string) => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const [method, setMethod] = useState<'card' | 'usdt'>('card');
  const [preset, setPreset] = useState<number | null>(2500);
  const [custom, setCustom] = useState('');
  const [network, setNetwork] = useState<CryptoNetwork>('TRC20');
  const [invoice, setInvoice] = useState<{ pay_address: string; pay_amount: number; network: CryptoNetwork } | null>(null);
  const amount = custom ? parseDollars(custom) : preset;
  const min = method === 'card' ? MONEY_LIMITS.topupCardMinCents : MONEY_LIMITS.topupUsdtMinCents;
  const valid = amount != null && amount >= min && amount <= 1_000_000;

  const card = useApiMutation((sb, cents: number) => money.topupCard(sb, cents, returnUrl('/balance')), {
    onSuccess: async (r) => {
      onClose();
      if ((await openProviderPage(r.url)) === 'returned') onCheckoutClosed(r.payment_id);
    },
  });
  const usdt = useApiMutation((sb, v: { cents: number; network: CryptoNetwork }) => money.topupUsdt(sb, v.cents, v.network), {
    invalidate: () => [keys.payments],
    onSuccess: (r) => setInvoice(r),
  });
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
          <Button size="lg" block label={t('topup.toBalance')} onPress={close} />
        ) : (
          <Button
            size="lg"
            block
            testID="topup-pay"
            disabled={!valid || card.isPending || usdt.isPending}
            label={method === 'card' ? t('topup.pay', { sum: valid ? formatMoney(amount!) : '' }) : t('topup.createAddress')}
            onPress={() => (method === 'card' ? card.mutate(amount!) : usdt.mutate({ cents: amount!, network }))}
          />
        )
      }
    >
      {invoice ? (
        <View style={{ gap: 12 }}>
          <AppText variant="body">{t('topup.usdtNote', { amount: String(invoice.pay_amount), network: invoice.network })}</AppText>
          <View style={[styles.box, { backgroundColor: colors.fill }]}>
            <AppText variant="caption" color="textSecondary">
              {t('topup.address')}
            </AppText>
            <AppText variant="callout" selectable style={{ fontFamily: familyByWeight['700'] }}>
              {invoice.pay_address}
            </AppText>
          </View>
          <Button
            variant="glass"
            label={t('topup.copyAddress')}
            icon={<Copy size={18} color={colors.text} />}
            onPress={() => {
              void (globalThis as { navigator?: { clipboard?: { writeText(s: string): Promise<void> } } }).navigator?.clipboard?.writeText(invoice.pay_address);
              toast(t('common.copied'));
            }}
          />
          <AppText variant="callout" color="textSecondary">
            {t('topup.waiting')}
          </AppText>
        </View>
      ) : (
        <View style={{ gap: 18 }}>
          <AppText variant="callout" style={{ fontFamily: familyByWeight['700'] }}>
            {t('topup.amount')}
          </AppText>
          <View style={styles.grid}>
            {MONEY_LIMITS.topupPresetsCents.map((c) => {
              const on = !custom && preset === c;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  onPress={() => {
                    setPreset(c);
                    setCustom('');
                  }}
                  style={[styles.preset, { backgroundColor: on ? colors.ink : colors.fill }]}
                >
                  <AppText variant="title3" tabular style={{ color: on ? colors.onInk : colors.text }}>
                    {formatMoney(c)}
                  </AppText>
                  {c === 2500 ? (
                    <AppText variant="caption" style={{ fontSize: 10, color: on ? colors.onInk : colors.textSecondary }}>
                      {t('topup.popular')}
                    </AppText>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={custom}
            onChangeText={setCustom}
            keyboardType="decimal-pad"
            accessibilityLabel={t('topup.custom')}
            placeholder={`$ ${t('topup.custom')}`}
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { backgroundColor: colors.fill, color: colors.text }]}
          />
          <AppText variant="callout" style={{ fontFamily: familyByWeight['700'] }}>
            {t('topup.method')}
          </AppText>
          <OptionTile selected={method === 'card'} onPress={() => setMethod('card')} icon={(c) => <CreditCard size={20} color={c} />} title={t('topup.card')} subtitle={t('topup.cardHint')} />
          <OptionTile selected={method === 'usdt'} onPress={() => setMethod('usdt')} icon={(c) => <Coins size={20} color={c} />} title={t('topup.usdt')} subtitle={t('topup.usdtHint')} />
          {method === 'usdt' ? (
            <View style={styles.row}>
              {CRYPTO_NETWORKS.map((n) => (
                <Pressable key={n} onPress={() => setNetwork(n)} accessibilityRole="radio" accessibilityState={{ checked: network === n }} style={[styles.net, { backgroundColor: network === n ? colors.ink : colors.fill }]}>
                  <AppText variant="bodyStrong" style={{ color: network === n ? colors.onInk : colors.text }}>
                    {n}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ) : null}
          <OptionTile disabled icon={(c) => <Building2Icon size={20} color={c} />} title={t('topup.bank')} subtitle={t('common.soon')} />
          <OptionTile disabled icon={(c) => <Wallet size={20} color={c} />} title={t('topup.wallets')} subtitle={t('common.soon')} />
          <AppText variant="callout" color="textSecondary">
            {method === 'card' ? t('topup.feeNote') : t('topup.usdtHint')}
          </AppText>
          <FormError error={card.error?.key ?? usdt.error?.key} />
        </View>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 18, padding: 14, gap: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { width: '31.5%', height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  input: { height: 56, borderRadius: 18, paddingHorizontal: 16, fontSize: 17, fontFamily: 'Manrope_700Bold' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  net: { height: 44, paddingHorizontal: 18, borderRadius: 999, justifyContent: 'center' },
});
