'use client';

import { t, taskExtras, type ComplaintReason } from '@parri/shared';
import { useApiMutation } from '@parri/shared/react';
import { useState } from 'react';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { FormError, TextArea } from '@/components/ui/Field';
import { OptionTile } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

const REASONS: ComplaintReason[] = [
  'fraud',
  'prohibited',
  'discrimination',
  'wrong_category',
  'spam',
  'other',
];

export function ReportSheet({
  open,
  onClose,
  taskId,
}: {
  open: boolean;
  onClose: () => void;
  taskId: string;
}) {
  const toast = useToast();
  const [reason, setReason] = useState<ComplaintReason | null>(null);
  const [details, setDetails] = useState('');
  const send = useApiMutation((sb) => taskExtras.complain(sb, taskId, reason!, details), {
    onSuccess: () => {
      toast(t('task.reportSent'));
      onClose();
    },
  });
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('task.reportTitle')}
      footer={
        <Button
          size="lg"
          block
          disabled={!reason || send.isPending}
          onClick={() => send.mutate(undefined)}
        >
          {t('common.send')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3" role="radiogroup" aria-label={t('task.reportTitle')}>
        <p className="text-callout text-text-2">{t('task.reportHint')}</p>
        {REASONS.map((r) => (
          <OptionTile
            key={r}
            selected={reason === r}
            onClick={() => setReason(r)}
            title={t(`task.reasons.${r}`)}
          />
        ))}
        <TextArea
          label={`${t('refund.details')} · ${t('common.optional')}`}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={3}
          counterMax={1000}
        />
        <FormError error={send.error?.key} />
      </div>
    </BottomSheet>
  );
}
