'use client';

import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { t } from '@parri/shared';
import { springs } from '@/lib/springs';
import { Button } from './Button';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Стеклянная шторка снизу. Закрывается свайпом вниз, по фону и по Esc. */
export function BottomSheet({ open, onClose, title, children, footer }: BottomSheetProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="glass relative w-full max-w-[560px] rounded-t-[32px] px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-2 outline-none md:mb-6 md:rounded-[32px]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={springs.sheet}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-pill bg-text-3/40" aria-hidden />
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 id={titleId} className="text-title3 font-bold">
                {title}
              </h2>
              <Button variant="glass" size="icon" aria-label={t('common.close')} onClick={onClose}>
                <X size={20} strokeWidth={2.6} />
              </Button>
            </div>
            <div className="max-h-[60dvh] overflow-y-auto">{children}</div>
            {footer && <div className="mt-5">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
