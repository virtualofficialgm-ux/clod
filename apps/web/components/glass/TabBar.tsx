'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@parri/shared';
import { PRESS_SCALE, springs } from '@/lib/springs';
import { useBadges } from '@/components/social/badges';
import { Glass } from './Glass';
import { TAB_ITEMS, isActive } from './nav';

/**
 * Телефон: стеклянная пилюля с вкладками и отдельная круглая кнопка «+» справа
 * (как плавающий «+» в Cal AI, но в стекле iOS 26 и с акцентом Parri). На md+ — сайдбар.
 */
export function TabBar() {
  const pathname = usePathname();
  const badges = useBadges();
  return (
    <nav
      aria-label={t('nav.main')}
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-3 px-[var(--p-gutter)] pb-[max(12px,env(safe-area-inset-bottom))] md:hidden"
    >
      <Glass radius="pill" className="flex h-16 min-w-0 flex-1 max-w-[340px] items-center justify-around px-1.5">
        {TAB_ITEMS.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(pathname, href);
          return (
            <motion.div key={href} whileTap={{ scale: PRESS_SCALE }} transition={springs.press} className="relative flex-1">
              {active && (
                <motion.span layoutId="tab-active" transition={springs.press} className="absolute inset-x-0.5 inset-y-0 rounded-pill bg-fill-strong/80" />
              )}
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'relative flex flex-col items-center gap-0.5 rounded-pill py-1.5 text-[11px] font-bold',
                  active ? 'text-text' : 'text-text-2',
                )}
              >
                <span className="relative">
                  <Icon size={22} strokeWidth={active ? 2.6 : 2.2} />
                  {badge && badges[badge] > 0 && <span className="absolute -right-1.5 -top-1 size-2.5 rounded-full bg-accent" aria-label={String(badges[badge])} />}
                </span>
                <span className="max-w-full truncate px-1">{t(label)}</span>
              </Link>
            </motion.div>
          );
        })}
      </Glass>
      <motion.div whileTap={{ scale: PRESS_SCALE }} transition={springs.press}>
        <Link
          href="/tasks/new"
          aria-label={t('nav.create')}
          className="flex size-16 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_10px_28px_rgba(255,84,40,0.45)]"
        >
          <Plus size={30} strokeWidth={2.8} />
        </Link>
      </motion.div>
    </nav>
  );
}
