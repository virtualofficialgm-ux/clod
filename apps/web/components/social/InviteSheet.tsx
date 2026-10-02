'use client';

import { displayStatus, formatMoney, people, t } from '@parri/shared';
import { keys, useApiMutation, useMyTasks } from '@parri/shared/react';
import Link from 'next/link';
import { useState } from 'react';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { FormError, TextArea } from '@/components/ui/Field';
import { OptionTile } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

/** «Предложить задачу»: выбор своей открытой задачи, сообщение, срок ответа */
export function InviteSheet({
  user,
  onClose,
}: {
  user: { id: string; name: string } | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const mine = useMyTasks('customer');
  const open = (mine.data ?? []).filter((x) => displayStatus(x) === 'open');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [days, setDays] = useState<1 | 3 | 7>(3);
  const send = useApiMutation((sb) => people.invite(sb, taskId!, user!.id, message, days), {
    invalidate: () => [keys.invitations],
    onSuccess: () => {
      toast(t('invite.sent'));
      onClose();
    },
  });
  const chosen = open.find((x) => x.id === taskId);
  return (
    <BottomSheet
      open={!!user}
      onClose={onClose}
      title={`${t('invite.title')} · ${user?.name ?? ''}`}
      footer={
        <div className="flex flex-col gap-2">
          <FormError error={send.error?.key} />
          <Button
            size="lg"
            block
            disabled={!taskId || send.isPending}
            onClick={() => send.mutate(undefined)}
          >
            {t('invite.send')}
          </Button>
          <p className="text-center text-caption text-text-2">{t('invite.note')}</p>
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-testid="invite-sheet">
        <p className="text-callout font-bold">{t('invite.chooseTask')}</p>
        {open.length === 0 ? (
          <p className="text-callout text-text-2">{t('invite.noTasks')}</p>
        ) : (
          <div
            className="flex flex-col gap-2"
            role="radiogroup"
            aria-label={t('invite.chooseTask')}
          >
            {open.map((x) => (
              <OptionTile
                key={x.id}
                selected={taskId === x.id}
                onClick={() => setTaskId(x.id)}
                title={x.title}
                subtitle={formatMoney(x.reward_cents, 'ru-RU', { currency: x.currency })}
              />
            ))}
          </div>
        )}
        <Link href="/tasks/new" className="text-callout font-bold text-accent-text">
          + {t('invite.createNew')}
        </Link>
        <TextArea
          label={t('invite.message')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          counterMax={1000}
          maxLength={1000}
        />
        <div className="flex flex-col gap-2">
          <span className="text-callout font-bold">{t('invite.days')}</span>
          <div className="flex gap-2">
            {([1, 3, 7] as const).map((d) => (
              <Chip key={d} selected={days === d} onClick={() => setDays(d)}>
                {t(`invite.d.${d}`)}
              </Chip>
            ))}
          </div>
        </div>
        {chosen && (
          <div className="tile flex flex-col gap-1 px-4 py-3">
            <span className="text-caption text-text-2">{t('invite.preview')}</span>
            <span className="font-bold">{chosen.title}</span>
            {message && <span className="text-callout">{message}</span>}
            <span className="text-caption text-text-2">{t(`invite.d.${days}`)}</span>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
