'use client';

import { SupabaseProvider } from '@parri/shared/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ToastProvider } from '@/components/ui/Toast';
import { PrefsProvider } from '@/lib/prefs';
import { shouldForgetSession } from '@/lib/remember';
import { getBrowserClient } from '@/lib/supabase/client';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  // «Запомнить меня» было снято, а браузер перезапущен — выходим
  useEffect(() => {
    if (shouldForgetSession()) void getBrowserClient().auth.signOut().then(() => location.replace('/login'));
  }, []);
  return (
    <PrefsProvider>
      <SupabaseProvider client={getBrowserClient()}>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>{children}</ToastProvider>
        </QueryClientProvider>
      </SupabaseProvider>
    </PrefsProvider>
  );
}
