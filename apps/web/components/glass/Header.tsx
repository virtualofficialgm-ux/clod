'use client';

import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { motion as motionTokens } from '@parri/ui';
import { springs } from '@/lib/springs';

interface HeaderProps {
  /** Компактный заголовок, появляется в шапке после начала прокрутки */
  title: string;
  leading?: React.ReactNode;
  actions?: React.ReactNode;
}

/** Прозрачная шапка: после прокрутки превращается в парящую стеклянную пилюлю. */
export function Header({ title, leading, actions }: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > motionTokens.headerScrollThreshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-30 px-[var(--p-gutter)] pt-3 md:px-8">
      <div
        data-scrolled={scrolled}
        className={clsx(
          'mx-auto flex h-14 max-w-[var(--p-content-max)] items-center gap-3 rounded-pill px-2 transition-[background,box-shadow,backdrop-filter] duration-300',
          scrolled ? 'glass' : 'bg-transparent',
        )}
      >
        <div className="flex min-w-12 items-center">{leading}</div>
        <div className="min-w-0 flex-1 text-center">
          <AnimatePresence>
            {scrolled && (
              <motion.span
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={springs.appear}
                className="block truncate text-body font-bold tracking-tight"
              >
                {title}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="flex min-w-12 items-center justify-end gap-2">{actions}</div>
      </div>
    </header>
  );
}
