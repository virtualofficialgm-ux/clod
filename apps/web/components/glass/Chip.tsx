'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import { PRESS_SCALE, springs } from '@/lib/springs';

interface ChipProps {
  selected?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

/** Плашка фильтра: стеклянная, выбранная — сплошная контрастная. */
export function Chip({ selected, onClick, children, icon }: ChipProps) {
  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      whileTap={{ scale: PRESS_SCALE }}
      transition={springs.press}
      className={clsx(
        'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-pill px-4 text-callout font-semibold',
        selected ? 'bg-text text-bg' : 'glass text-text',
      )}
    >
      {icon}
      {children}
    </motion.button>
  );
}
