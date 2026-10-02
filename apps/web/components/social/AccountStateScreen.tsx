'use client';

import { account, t } from '@parri/shared';
import { keys, useApiMutation, useSignOut } from '@parri/shared/react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/glass/Button';
import { FormError } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

/** Деактивированный аккаунт — «Восстановить»; заблокированный модератором — только «Выйти» */
export function AccountStateScreen({ state }: { state: 'deactivated' | 'blocked' }) {
  const router = useRouter();
  const toast = useToast();
  const signOut = useSignOut();
  const restore = useApiMutation((sb) => account.restore(sb), {
    invalidate: () => [keys.me],
    onSuccess: () => toast(t('exit.restored')),
  });
  return (
    <main
      className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-[var(--p-gutter)] text-center"
      data-testid={`account-${state}`}
    >
      <h1 className="text-title2 font-extrabold">
        {state === 'deactivated' ? t('exit.restoreTitle') : t('exit.blockedTitle')}
      </h1>
      <p className="text-text-2">
        {state === 'deactivated' ? t('exit.restoreText') : t('exit.blockedText')}
      </p>
      <FormError error={restore.error?.key} />
      <div className="flex flex-wrap justify-center gap-2">
        {state === 'deactivated' && (
          <Button size="lg" onClick={() => restore.mutate(undefined)} disabled={restore.isPending}>
            {t('exit.restore')}
          </Button>
        )}
        <Button
          size="lg"
          variant="glass"
          onClick={async () => {
            await signOut();
            router.replace('/login');
          }}
        >
          {t('common.logout')}
        </Button>
      </div>
    </main>
  );
}
