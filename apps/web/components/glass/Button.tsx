'use client';

import clsx from 'clsx';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';
import { PRESS_SCALE, springs } from '@/lib/springs';

type Variant = 'primary' | 'glass' | 'plain';
type Size = 'lg' | 'md' | 'icon';

export interface ButtonProps extends HTMLMotionProps<'button'> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent shadow-[0_8px_24px_rgba(255,84,40,0.35)] hover:bg-accent-pressed',
  glass: 'glass text-text',
  plain: 'text-text hover:bg-separator',
};

const sizes: Record<Size, string> = {
  lg: 'h-14 px-7 text-button',
  md: 'h-12 px-6 text-button',
  icon: 'size-12 justify-center',
};

/** Кнопка-пилюля. При нажатии пружинно сжимается (отключается при «Уменьшить движение»). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, className, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: PRESS_SCALE }}
      transition={springs.press}
      className={clsx(
        'inline-flex select-none items-center gap-2 rounded-pill font-bold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-45',
        variants[variant],
        sizes[size],
        block && 'w-full justify-center',
        className,
      )}
      {...rest}
    />
  );
});
