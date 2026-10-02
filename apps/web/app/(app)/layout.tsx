import { AppShell } from '@/components/glass/AppShell';
import { AppGate } from './AppGate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <AppGate>{children}</AppGate>
    </AppShell>
  );
}
