import { auth, emailSchema, otpSchema, passwordSchema, t } from '@parri/shared';
import { useSupabase } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { BackButton } from '@/components/ui/BackButton';
import { OtpField } from '@/components/ui/OtpField';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField } from '@/components/ui/TextField';
import { Card, PageTitle, useToast } from '@/components/ui/bits';
import { useCooldown, useRunner } from '@/lib/useRunner';

export default function Reset() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const toast = useToast();
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, setError, run } = useRunner();
  const cooldown = useCooldown();

  const send = () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0]!.message);
    void run(async () => {
      await auth.requestReset(sb, parsed.data);
      setStep('code');
      cooldown.start();
    });
  };

  return (
    <Screen title={t('auth.resetTitle')} leading={<BackButton />}>
      <PageTitle subtitle={t('auth.resetText')}>{t('auth.resetTitle')}</PageTitle>
      <Card>
        {step === 'email' && (
          <>
            <TextField label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <FormError error={error} />
            <Button size="lg" block label={t('auth.resetSend')} disabled={busy} onPress={send} />
          </>
        )}
        {step === 'code' && (
          <>
            <AppText variant="body" color="textSecondary">
              {t('auth.codeSent', { email })}
            </AppText>
            <OtpField label={t('auth.code')} value={code} onChange={setCode} />
            <FormError error={error} />
            <Button
              size="lg"
              block
              label={t('auth.verify')}
              disabled={busy || code.length !== 6}
              onPress={() => {
                const parsed = otpSchema.safeParse(code);
                if (!parsed.success) return setError(parsed.error.issues[0]!.message);
                void run(async () => {
                  await auth.verifyReset(sb, email.trim().toLowerCase(), parsed.data);
                  setStep('password');
                });
              }}
            />
            <Button variant="glass" block disabled={cooldown.left > 0 || busy} label={cooldown.left > 0 ? t('auth.resendIn', { s: cooldown.left }) : t('auth.resend')} onPress={send} />
          </>
        )}
        {step === 'password' && (
          <>
            <TextField label={t('auth.newPassword')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint={t('auth.passwordHint')} />
            <FormError error={error} />
            <Button
              size="lg"
              block
              label={t('auth.savePassword')}
              disabled={busy}
              onPress={() => {
                const parsed = passwordSchema.safeParse(password);
                if (!parsed.success) return setError(parsed.error.issues[0]!.message);
                void run(async () => {
                  await auth.updatePassword(sb, parsed.data);
                  await qc.invalidateQueries();
                  toast(t('auth.passwordChanged'));
                  router.replace('/');
                });
              }}
            />
          </>
        )}
      </Card>
    </Screen>
  );
}
