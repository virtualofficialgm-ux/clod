import type { Metadata } from 'next';
import { t } from '@parri/shared';
import { AppShell } from '@/components/glass/AppShell';
import { Showcase } from './Showcase';

export const metadata: Metadata = { title: t('showcase.title') };

export default function ShowcasePage() {
  return (
    <AppShell>
      <Showcase />
    </AppShell>
  );
}
