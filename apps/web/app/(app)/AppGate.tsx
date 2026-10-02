'use client';

import { useMe, useSession } from '@parri/shared/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AccountStateScreen } from '@/components/social/AccountStateScreen';
import { CenterSpinner } from '@/components/ui/bits';

/** Без входа — на /login, с незаконченной регистрацией — на /register */
export function AppGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const me = useMe(!!session);
  const router = useRouter();
  const pathname = usePathname();
  const onboarding = me.data?.profile.onboarding;

  useEffect(() => {
    if (loading) return;
    if (!session) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (onboarding && onboarding !== 'done') router.replace('/register');
  }, [loading, session, onboarding, router, pathname]);

  if (loading || !session || me.isLoading || onboarding !== 'done') return <CenterSpinner />;
  if (me.data?.profile.banned_at || me.data?.profile.deleted_at) return <AccountStateScreen state="blocked" />;
  if (me.data?.profile.deactivated_at) return <AccountStateScreen state="deactivated" />;
  return <>{children}</>;
}
