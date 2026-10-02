'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useId } from 'react';
import { springs } from '@/lib/springs';
import { Glass } from './Glass';

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  label: string;
}

/** Стеклянный переключатель вкладок с пружинным индикатором (Онлайн / Рядом / В моём вузе). */
export function Segmented<T extends string>({ value, onChange, options, label }: SegmentedProps<T>) {
  const id = useId();
  return (
    <Glass radius="pill" role="tablist" aria-label={label} className="inline-flex max-w-full gap-1 self-start overflow-x-auto p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              'relative h-10 rounded-pill px-4 text-callout font-bold transition-colors',
              active ? 'text-bg' : 'text-text',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={springs.press}
                className="absolute inset-0 -z-0 rounded-pill bg-text"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </Glass>
  );
}
