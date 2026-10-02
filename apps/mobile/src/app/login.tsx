import { auth, emailSchema, fieldErrors, loginSchema, otpSchema, t } from '@parri/shared';
import { useSupabase } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Segmented } from '@/components/glass/Segmented';
import { BackButton } from '@/components/ui/BackButton';
import { OtpField } from '@/components/ui/OtpField';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField } from '@/components/ui/TextField';
import { Card, PageTitle } from '@/components/ui/bits';
import { useCooldown, useRunner } from '@/lib/useRunner';

export default function Login() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const [mode, setMode] = useState<'password' | 'code'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, error, run } = useRunner();
  const cooldown = useCooldown();

  const done = async () => {
    await qc.invalidateQueries();
    router.replace('/');
  };

  const sendCode = () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setErrors({ email: parsed.error.issues[0]!.message });
    setErrors({});
    void run(async () => {
      await auth.sendLoginCode(sb, parsed.data);
      setSent(true);
      cooldown.start();
    });
  };

  return (
    <Screen title={t('auth.loginTitle')} leading={<BackButton />}>
      <PageTitle>{t('auth.loginTitle')}</PageTitle>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'password', label: t('auth.withPassword') },
          { value: 'code', label: t('auth.withCode') },
        ]}
      />
      <Card>
        {mode === 'password' ? (
          <>
            <TextField label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={errors.email} />
            <TextField label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" error={errors.password} />
            <FormError error={error} />
            <Button
              size="lg"
              block
              label={t('auth.submit')}
              disabled={busy}
              onPress={() => {
                const parsed = loginSchema.safeParse({ email, password });
                if (!parsed.success) return setErrors(fieldErrors(parsed.error));
                setErrors({});
                void run(async () => {
                  await auth.signIn(sb, parsed.data.email, parsed.data.password);
                  await done();
                });
              }}
            />
            <Button variant="glass" block label={t('auth.forgot')} onPress={() => router.push('/reset')} />
          </>
        ) : !sent ? (
          <>
            <TextField label={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={errors.email} />
            <FormError error={error} />
            <Button size="lg" block label={t('auth.sendCode')} disabled={busy} onPress={sendCode} />
          </>
        ) : (
          <>
            <AppText variant="body" color="textSecondary">
              {t('auth.codeSent', { email })}
            </AppText>
            <OtpField label={t('auth.code')} value={code} onChange={setCode} />
            <FormError error={error ?? errors.code} />
            <Button
              size="lg"
              block
              label={t('auth.verify')}
              disabled={busy || code.length !== 6}
              onPress={() => {
                const parsed = otpSchema.safeParse(code);
                if (!parsed.success) return setErrors({ code: parsed.error.issues[0]!.message });
                void run(async () => {
                  await auth.verifyLoginCode(sb, email.trim().toLowerCase(), parsed.data);
                  await done();
                });
              }}
            />
            <Button
              variant="glass"
              block
              disabled={cooldown.left > 0 || busy}
              label={cooldown.left > 0 ? t('auth.resendIn', { s: cooldown.left }) : t('auth.resend')}
              onPress={sendCode}
            />
          </>
        )}
      </Card>
      <View style={{ alignItems: 'center' }}>
        <Button variant="glass" label={`${t('auth.noAccount')} ${t('auth.register')}`} onPress={() => router.replace('/register')} />
      </View>
    </Screen>
  );
}
