'use client';

import { auth, emailSchema, otpSchema, passwordSchema, t, toApiError } from '@parri/shared';
import { useSupabase } from '@parri/shared/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/glass/Button';
import { FormError, Input } from '@/components/ui/Field';
import { OtpInput } from '@/components/ui/OtpInput';
import { PageTitle } from '@/components/ui/bits';
import { useToast } from '@/components/ui/Toast';
import { useCooldown } from '../useCooldown';

type Step = 'email' | 'code' | 'password';

export default function ResetPage() {
  const sb = useSupabase();
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(toApiError(e).key);
    } finally {
      setBusy(false);
    }
  };

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
    <div className="flex flex-col gap-6">
      <PageTitle subtitle={t('auth.resetText')}>{t('auth.resetTitle')}</PageTitle>
      <div className="card flex flex-col gap-5 p-6">
        {step === 'email' && (
          <>
            <Input label={t('auth.email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <FormError error={error} />
            <Button size="lg" block disabled={busy} onClick={send}>
              {t('auth.resetSend')}
            </Button>
          </>
        )}
        {step === 'code' && (
          <>
            <p className="text-body text-text-2">{t('auth.codeSent', { email })}</p>
            <OtpInput label={t('auth.code')} value={code} onChange={setCode} autoFocus />
            <FormError error={error} />
            <Button
              size="lg"
              block
              disabled={busy || code.length !== 6}
              onClick={() => {
                const parsed = otpSchema.safeParse(code);
                if (!parsed.success) return setError(parsed.error.issues[0]!.message);
                void run(async () => {
                  await auth.verifyReset(sb, email.trim().toLowerCase(), parsed.data);
                  setStep('password');
                });
              }}
            >
              {t('auth.verify')}
            </Button>
            <Button variant="plain" block disabled={cooldown.left > 0 || busy} onClick={send}>
              {cooldown.left > 0 ? t('auth.resendIn', { s: cooldown.left }) : t('auth.resend')}
            </Button>
          </>
        )}
        {step === 'password' && (
          <>
            <Input
              label={t('auth.newPassword')}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={t('auth.passwordHint')}
            />
            <FormError error={error} />
            <Button
              size="lg"
              block
              disabled={busy}
              onClick={() => {
                const parsed = passwordSchema.safeParse(password);
                if (!parsed.success) return setError(parsed.error.issues[0]!.message);
                void run(async () => {
                  await auth.updatePassword(sb, parsed.data);
                  toast(t('auth.passwordChanged'));
                  router.replace('/dashboard');
                  router.refresh();
                });
              }}
            >
              {t('auth.savePassword')}
            </Button>
          </>
        )}
      </div>
      <Link href="/login" className="text-center text-body font-bold text-accent-text">
        {t('auth.loginTitle')}
      </Link>
    </div>
  );
}
