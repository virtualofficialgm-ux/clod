'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@parri/shared';
import { PRESS_SCALE, springs } from '@/lib/springs';
import { Glass } from './Glass';
import { NAV_ITEMS } from './nav';

/** Плавающий таб-бар-пилюля для узких экранов. На md+ его заменяет сайдбар. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Основная навигация"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-[var(--p-gutter)] pb-[max(12px,env(safe-area-inset-bottom))] md:hidden"
    >
      <Glass radius="pill" className="flex h-16 w-full max-w-[420px] items-center justify-between px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon, primary }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          if (primary) {
            return (
              <motion.div key={href} whileTap={{ scale: PRESS_SCALE }} transition={springs.press}>
                <Link
                  href={href}
                  aria-label={t(label)}
                  className="flex size-12 items-center justify-center rounded-pill bg-accent text-on-accent shadow-[0_6px_18px_rgba(255,84,40,0.4)]"
                >
                  <Icon size={26} strokeWidth={2.6} />
                </Link>
              </motion.div>
            );
          }
          return (
            <motion.div key={href} whileTap={{ scale: PRESS_SCALE }} transition={springs.press}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex w-[64px] flex-col items-center gap-0.5 rounded-pill py-1.5 text-[11px] font-bold',
                  active ? 'text-accent-text' : 'text-text-2',
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.6 : 2.2} />
                {t(label)}
              </Link>
            </motion.div>
          );
        })}
      </Glass>
    </nav>
  );
}
