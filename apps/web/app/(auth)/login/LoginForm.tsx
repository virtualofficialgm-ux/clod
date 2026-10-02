'use client';

import { auth, loginSchema, emailSchema, otpSchema, fieldErrors, t, toApiError } from '@parri/shared';
import { useSupabase } from '@parri/shared/react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Segmented } from '@/components/glass/Segmented';
import { FormError, Input } from '@/components/ui/Field';
import { OtpInput } from '@/components/ui/OtpInput';
import { PageTitle } from '@/components/ui/bits';
import { useCooldown } from '../useCooldown';

type Mode = 'password' | 'code';

export function LoginForm() {
  const sb = useSupabase();
  const qc = useQueryClient();
  const router = useRouter();
  const next = useSearchParams().get('next');
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown();

  const done = async () => {
    await qc.invalidateQueries();
    router.replace(next && next.startsWith('/') ? next : '/feed');
    router.refresh();
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setFormError(null);
    try {
      await fn();
    } catch (e) {
      setFormError(toApiError(e).key);
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    void run(async () => {
      await auth.signIn(sb, parsed.data.email, parsed.data.password);
      await done();
    });
  };

  const sendCode = () => {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setErrors({ email: parsed.error.issues[0]!.message });
    setErrors({});
    void run(async () => {
      await auth.sendLoginCode(sb, parsed.data);
      setCodeSent(true);
      cooldown.start();
    });
  };

  const verifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = otpSchema.safeParse(code);
    if (!parsed.success) return setErrors({ code: parsed.error.issues[0]!.message });
    void run(async () => {
      await auth.verifyLoginCode(sb, email.trim().toLowerCase(), parsed.data);
      await done();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle>{t('auth.loginTitle')}</PageTitle>
      <Segmented<Mode>
        label={t('auth.loginTitle')}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setFormError(null);
        }}
        options={[
          { value: 'password', label: t('auth.withPassword') },
          { value: 'code', label: t('auth.withCode') },
        ]}
      />
      <div className="card flex flex-col gap-5 p-6">
        {mode === 'password' ? (
          <form onSubmit={submitPassword} className="flex flex-col gap-5" noValidate>
            <Input label={t('auth.email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
            <Input
              label={t('auth.password')}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />
            <FormError error={formError} />
            <Button type="submit" size="lg" block disabled={busy}>
              {t('auth.submit')}
            </Button>
            <Link href="/reset" className="text-center text-callout font-bold text-accent-text">
              {t('auth.forgot')}
            </Link>
          </form>
        ) : !codeSent ? (
          <div className="flex flex-col gap-5">
            <Input label={t('auth.email')} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
            <FormError error={formError} />
            <Button size="lg" block disabled={busy} onClick={sendCode}>
              {t('auth.sendCode')}
            </Button>
          </div>
        ) : (
          <form onSubmit={verifyCode} className="flex flex-col gap-5" noValidate>
            <p className="text-body text-text-2">{t('auth.codeSent', { email })}</p>
            <OtpInput label={t('auth.code')} value={code} onChange={setCode} autoFocus />
            <FormError error={formError ?? errors.code} />
            <Button type="submit" size="lg" block disabled={busy || code.length !== 6}>
              {t('auth.verify')}
            </Button>
            <Button variant="plain" block disabled={cooldown.left > 0 || busy} onClick={sendCode}>
              {cooldown.left > 0 ? t('auth.resendIn', { s: cooldown.left }) : t('auth.resend')}
            </Button>
          </form>
        )}
      </div>
      <p className="text-center text-body text-text-2">
        {t('auth.noAccount')}{' '}
        <Link href="/register" className="font-bold text-accent-text">
          {t('auth.register')}
        </Link>
      </p>
    </div>
  );
}
