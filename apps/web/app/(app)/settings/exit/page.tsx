'use client';

import { account, formatMoney, t } from '@parri/shared';
import { keys, useApiMutation, useSession, useSignOut, useSupabase } from '@parri/shared/react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Header } from '@/components/glass/Header';
import { Checkbox, FormError, Input } from '@/components/ui/Field';
import { CenterSpinner, PageTitle } from '@/components/ui/bits';
import { Card, CardHeader, OptionTile } from '@/components/ui/kit';

type Mode = 'deactivate' | 'delete';
const REASONS = ['break', 'no_tasks', 'other_account', 'other'] as const;
const ROWS = ['profile', 'tasks', 'chats', 'balance', 'documents'] as const;

function Exit() {
  const params = useSearchParams();
  const router = useRouter();
  const sb = useSupabase();
  const { session } = useSession();
  const signOut = useSignOut();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'delete' ? 'delete' : 'deactivate');
  const [step, setStep] = useState(0);
  const [reason, setReason] = useState<(typeof REASONS)[number] | null>(null);
  const [password, setPassword] = useState('');
  const [understand, setUnderstand] = useState(false);
  const [word, setWord] = useState('');
  const blockers = useQuery({
    queryKey: ['exit-blockers'],
    queryFn: () => account.exitBlockers(sb),
  });
  const expected = mode === 'delete' ? 'УДАЛЕНИЕ' : 'ДЕАКТИВАЦИЯ';
  const submit = useApiMutation(
    async (s) => {
      await account.verifyPassword(s, session!.user.email!, password);
      if (mode === 'delete') await account.remove(s, reason ?? 'other', word.trim());
      else await account.deactivate(s, reason ?? 'other', word.trim());
    },
    {
      invalidate: () => [keys.me],
      onSuccess: async () => {
        if (mode === 'delete') {
          await signOut();
          router.replace('/');
        }
      },
    },
  );
  const b = blockers.data;
  const blocked =
    !!b &&
    (b.active_tasks > 0 || (mode === 'delete' && (b.balance_cents > 0 || b.pending_payouts > 0)));

  return (
    <>
      <Header
        title={t('exit.title')}
        leading={
          <Button
            variant="glass"
            size="icon"
            aria-label={t('common.back')}
            onClick={() => (step ? setStep(step - 1) : router.push('/settings'))}
          >
            <ChevronLeft size={22} strokeWidth={2.6} />
          </Button>
        }
      />
      <main
        className="mx-auto flex max-w-[720px] flex-col gap-5 px-[var(--p-gutter)] pt-2 md:px-8"
        data-testid="exit-flow"
      >
        <PageTitle subtitle={t('common.stepOf', { step: step + 1, total: 4 })}>
          {t('exit.title')}
        </PageTitle>

        {step === 0 && (
          <Card className="flex flex-col gap-3">
            <CardHeader title={t('exit.chooseTitle')} />
            <div
              className="flex flex-col gap-2"
              role="radiogroup"
              aria-label={t('exit.chooseTitle')}
            >
              <OptionTile
                selected={mode === 'deactivate'}
                onClick={() => setMode('deactivate')}
                title={t('exit.deactivate')}
                subtitle={t('exit.deactivateText')}
              />
              <OptionTile
                selected={mode === 'delete'}
                onClick={() => setMode('delete')}
                title={t('exit.delete')}
                subtitle={t('exit.deleteText')}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full min-w-[480px] text-left text-callout">
                <caption className="pb-2 text-left font-bold">{t('exit.dataTitle')}</caption>
                <thead className="text-caption text-text-2">
                  <tr>
                    <th className="py-1">{t('exit.colWhat')}</th>
                    <th className="py-1">{t('exit.colDeactivate')}</th>
                    <th className="py-1">{t('exit.colDelete')}</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((r) => (
                    <tr key={r} className="border-t border-separator">
                      <td className="py-2 font-semibold">{t(`exit.rows.${r}.what`)}</td>
                      <td className="py-2">{t(`exit.rows.${r}.deactivate`)}</td>
                      <td className="py-2">{t(`exit.rows.${r}.delete`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card className="flex flex-col gap-3">
            <CardHeader title={t('exit.beforeTitle')} />
            {!b ? (
              <CenterSpinner />
            ) : (
              <ul className="flex flex-col gap-2" data-testid="exit-blockers">
                <li className={b.active_tasks ? 'font-bold text-danger' : ''}>
                  {t('exit.activeTasks', { n: b.active_tasks })}
                </li>
                {mode === 'delete' && (
                  <>
                    <li className={b.balance_cents ? 'font-bold text-danger' : ''}>
                      {t('exit.balance', { v: formatMoney(b.balance_cents) })}
                    </li>
                    <li className={b.pending_payouts ? 'font-bold text-danger' : ''}>
                      {t('exit.payouts', { n: b.pending_payouts })}
                    </li>
                  </>
                )}
                {!blocked && <li className="font-bold text-success">{t('exit.allClear')}</li>}
              </ul>
            )}
          </Card>
        )}

        {step === 2 && (
          <Card className="flex flex-col gap-2">
            <CardHeader title={t('exit.reasonTitle')} />
            <div
              className="flex flex-col gap-2"
              role="radiogroup"
              aria-label={t('exit.reasonTitle')}
            >
              {REASONS.map((r) => (
                <OptionTile
                  key={r}
                  selected={reason === r}
                  onClick={() => setReason(r)}
                  title={t(`exit.reasons.${r}`)}
                />
              ))}
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="flex flex-col gap-4">
            <CardHeader title={t('exit.confirmTitle')} />
            <Input
              label={t('exit.password')}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Checkbox checked={understand} onChange={setUnderstand}>
              {t('exit.understand')}
            </Checkbox>
            <Input
              label={t('exit.typeWord', { word: expected })}
              value={word}
              onChange={(e) => setWord(e.target.value)}
            />
            <FormError error={submit.error?.key} />
            <Button
              size="lg"
              className={mode === 'delete' ? 'bg-danger' : undefined}
              disabled={!password || !understand || word.trim() !== expected || submit.isPending}
              onClick={() => submit.mutate(undefined)}
            >
              {mode === 'delete' ? t('exit.submitDelete') : t('exit.submitDeactivate')}
            </Button>
          </Card>
        )}

        {step < 3 && (
          <Button
            size="lg"
            disabled={(step === 1 && (blocked || !b)) || (step === 2 && !reason)}
            onClick={() => setStep(step + 1)}
          >
            {t('exit.next')}
          </Button>
        )}
      </main>
    </>
  );
}

export default function ExitPage() {
  return (
    <Suspense fallback={<CenterSpinner />}>
      <Exit />
    </Suspense>
  );
}
