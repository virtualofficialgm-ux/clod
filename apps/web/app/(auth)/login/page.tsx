import type { Metadata } from 'next';
import { Suspense } from 'react';
import { t } from '@parri/shared';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: t('auth.loginTitle') };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
