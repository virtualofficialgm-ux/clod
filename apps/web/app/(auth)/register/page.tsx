import type { Metadata } from 'next';
import { t } from '@parri/shared';
import { RegisterFlow } from './RegisterFlow';

export const metadata: Metadata = { title: t('register.title') };

export default function RegisterPage() {
  return <RegisterFlow />;
}
