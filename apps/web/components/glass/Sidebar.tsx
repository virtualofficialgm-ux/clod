'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@parri/shared';
import { Glass } from './Glass';
import { NAV_ITEMS } from './nav';

/** Стеклянный сайдбар слева на широких экранах. */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--p-sidebar-width)] p-4 md:block">
      <Glass radius="2xl" as="nav" aria-label="Основная навигация" className="flex h-full flex-col gap-1 p-4">
        <Link href="/" className="mb-6 px-3 pt-2 text-[34px] font-extrabold tracking-[-0.04em]">
          {t('app.name')}
          <span className="text-accent">.</span>
        </Link>
        {NAV_ITEMS.map(({ href, label, icon: Icon, primary }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex h-12 items-center gap-3 rounded-pill px-4 text-body font-bold transition-colors',
                primary
                  ? 'my-2 bg-accent text-on-accent hover:bg-accent-pressed'
                  : active
                    ? 'bg-text text-bg'
                    : 'text-text hover:bg-separator',
              )}
            >
              <Icon size={20} strokeWidth={2.4} />
              {t(label)}
            </Link>
          );
        })}
      </Glass>
    </aside>
  );
}
