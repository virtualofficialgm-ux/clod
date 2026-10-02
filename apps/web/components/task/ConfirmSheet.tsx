'use client';

import { t } from '@parri/shared';
import { BottomSheet } from '@/components/glass/BottomSheet';
import { Button } from '@/components/glass/Button';
import { FormError } from '@/components/ui/Field';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  text?: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
  error?: string | null;
}

export function ConfirmSheet({ open, onClose, title, text, confirmLabel, onConfirm, busy, error }: Props) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex flex-col gap-3">
          <FormError error={error} />
          <div className="flex gap-2">
            <Button variant="glass" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button size="lg" block onClick={onConfirm} disabled={busy}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      }
    >
      {text && <div className="text-body text-text-2">{text}</div>}
    </BottomSheet>
  );
}
