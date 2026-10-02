'use client';

import { formatMoney, t, work, type MoneyCurrency } from '@parri/shared';
import { keys, useApiMutation } from '@parri/shared/react';
import { Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { FormError } from '@/components/ui/Field';

/** Подтверждение «Взять задачу»: сразу закрепляется, деньги заказчика уже в Сейфе */
export function TakeSheet({
  task,
  takesLeft,
  pro,
  onClose,
}: {
  task: { id: string; title: string; reward_cents: number; currency?: MoneyCurrency } | null;
  takesLeft?: number;
  pro?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const take = useApiMutation((sb, id: string) => work.take(sb, id), {
    invalidate: (id) => [keys.task(id), keys.mine('executor'), ['feed']],
    onSuccess: (_r, id) => {
      onClose();
      router.push(`/tasks/${id}`);
    },
  });
  return (
    <BottomSheet
      open={!!task}
      onClose={onClose}
      title={t('task.take')}
      footer={
        <Button
          size="lg"
          block
          disabled={take.isPending}
          onClick={() => task && take.mutate(task.id)}
        >
          <Zap size={18} strokeWidth={2.6} />
          {t('task.take')} ·{' '}
          {task
            ? formatMoney(task.reward_cents, 'ru-RU', { currency: task.currency ?? 'USD' })
            : ''}
        </Button>
      }
    >
      {task && (
        <div className="flex flex-col gap-3">
          <p className="text-title3 font-bold">{task.title}</p>
          <p className="text-body text-text-2">{t('task.takeHint')}</p>
          <p className="text-callout text-text-2">{t('task.yoursText', { m: 25 })}</p>
          {takesLeft != null && (
            <p className="text-callout font-semibold">{t('task.takesLeft', { n: takesLeft })}</p>
          )}
          {pro && (
            <p className="text-callout font-semibold text-accent-text">{t('task.takeBonus')}</p>
          )}
          <FormError error={take.error?.key} />
        </div>
      )}
    </BottomSheet>
  );
}
