import { account, formatMoney, t } from '@parri/shared';
import { keys, useApiMutation, useSession, useSignOut, useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { BackButton } from '@/components/ui/BackButton';
import { Checkbox } from '@/components/ui/Checkbox';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField } from '@/components/ui/TextField';
import { Center, PageTitle } from '@/components/ui/bits';
import { Card, CardHeader, ListGroup, ListRow, OptionTile } from '@/components/ui/kit';

type Mode = 'deactivate' | 'delete';
const REASONS = ['break', 'no_tasks', 'other_account', 'other'] as const;
const ROWS = ['profile', 'tasks', 'chats', 'balance', 'documents'] as const;

export default function Exit() {
  const params = useLocalSearchParams<{ mode?: Mode }>();
  const sb = useSupabase();
  const { session } = useSession();
  const signOut = useSignOut();
  const [mode, setMode] = useState<Mode>(params.mode === 'delete' ? 'delete' : 'deactivate');
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [password, setPassword] = useState('');
  const [understand, setUnderstand] = useState(false);
  const [word, setWord] = useState('');
  const blockers = useQuery({
    queryKey: ['exit-blockers'],
    queryFn: () => account.exitBlockers(sb),
  });
  const expected = mode === 'delete' ? 'УДАЛЕНИЕ' : 'ДЕАКТИВАЦИЯ';
  const submit = useApiMutation(
    async (s) => {
      await account.verifyPassword(s, session!.user.email!, password);
      if (mode === 'delete') await account.remove(s, reason ?? 'other', word.trim());
      else await account.deactivate(s, reason ?? 'other', word.trim());
    },
    {
      invalidate: () => [keys.me],
      onSuccess: async () => {
        if (mode === 'delete') {
          await signOut();
          router.replace('/register');
        } else router.replace('/home');
      },
    },
  );
  const b = blockers.data;
  const blocked =
    !!b &&
    (b.active_tasks > 0 || (mode === 'delete' && (b.balance_cents > 0 || b.pending_payouts > 0)));
  return (
    <Screen
      title={t('exit.title')}
      leading={<BackButton />}
      footer={
        step < 3 ? (
          <Button
            size="lg"
            block
            label={t('exit.next')}
            disabled={(step === 1 && (blocked || !b)) || (step === 2 && !reason)}
            onPress={() => setStep(step + 1)}
          />
        ) : undefined
      }
    >
      <PageTitle subtitle={t('common.stepOf', { step: step + 1, total: 4 })}>
        {t('exit.title')}
      </PageTitle>
      {step === 0 ? (
        <>
          <OptionTile
            selected={mode === 'deactivate'}
            onPress={() => setMode('deactivate')}
            title={t('exit.deactivate')}
            subtitle={t('exit.deactivateText')}
          />
          <OptionTile
            selected={mode === 'delete'}
            onPress={() => setMode('delete')}
            title={t('exit.delete')}
            subtitle={t('exit.deleteText')}
          />
          <ListGroup title={t('exit.dataTitle')}>
            {ROWS.map((r) => (
              <ListRow
                key={r}
                title={t(`exit.rows.${r}.what`)}
                subtitle={
                  mode === 'delete' ? t(`exit.rows.${r}.delete`) : t(`exit.rows.${r}.deactivate`)
                }
              />
            ))}
          </ListGroup>
        </>
      ) : step === 1 ? (
        <Card testID="exit-blockers">
          <CardHeader title={t('exit.beforeTitle')} />
          {!b ? (
            <Center />
          ) : (
            <View style={{ gap: 6 }}>
              <AppText variant="body" color={b.active_tasks ? 'danger' : 'text'}>
                {t('exit.activeTasks', { n: b.active_tasks })}
              </AppText>
              {mode === 'delete' ? (
                <>
                  <AppText variant="body" color={b.balance_cents ? 'danger' : 'text'}>
                    {t('exit.balance', { v: formatMoney(b.balance_cents) })}
                  </AppText>
                  <AppText variant="body" color={b.pending_payouts ? 'danger' : 'text'}>
                    {t('exit.payouts', { n: b.pending_payouts })}
                  </AppText>
                </>
              ) : null}
              {!blocked ? (
                <AppText variant="bodyStrong" color="success">
                  {t('exit.allClear')}
                </AppText>
              ) : null}
            </View>
          )}
        </Card>
      ) : step === 2 ? (
        <>
          <AppText variant="title3">{t('exit.reasonTitle')}</AppText>
          {REASONS.map((r) => (
            <OptionTile
              key={r}
              selected={reason === r}
              onPress={() => setReason(r)}
              title={t(`exit.reasons.${r}`)}
            />
          ))}
        </>
      ) : (
        <Card>
          <CardHeader title={t('exit.confirmTitle')} />
          <TextField
            label={t('exit.password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Checkbox checked={understand} onChange={setUnderstand} label={t('exit.understand')} />
          <TextField
            label={t('exit.typeWord', { word: expected })}
            value={word}
            onChangeText={setWord}
            autoCapitalize="characters"
          />
          <FormError error={submit.error?.key} />
          <Button
            size="lg"
            block
            label={mode === 'delete' ? t('exit.submitDelete') : t('exit.submitDeactivate')}
            disabled={!password || !understand || word.trim() !== expected || submit.isPending}
            onPress={() => submit.mutate(undefined)}
          />
        </Card>
      )}
    </Screen>
  );
}
