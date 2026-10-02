'use client';

import clsx from 'clsx';
import { LogOut, PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { shortName, t } from '@parri/shared';
import { useMe, useSignOut } from '@parri/shared/react';
import { Avatar } from '@/components/ui/bits';
import { Glass } from './Glass';
import { SIDEBAR_ITEMS, isActive } from './nav';

/** Стеклянный сайдбар на компьютере. Сворачивается до иконок. */
export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const me = useMe();
  const signOut = useSignOut();
  const p = me.data?.profile;
  const staff = p?.role === 'admin' || p?.role === 'moderator';
  const name = shortName(p?.first_name, p?.last_name);

  return (
    <aside
      className={clsx(
        'fixed inset-y-0 left-0 z-40 hidden p-4 transition-[width] duration-300 md:block',
        collapsed ? 'w-[104px]' : 'w-[var(--p-sidebar-width)]',
      )}
    >
      <Glass radius="2xl" as="nav" aria-label={t('nav.main')} className="flex h-full flex-col gap-1 p-3">
        <div className={clsx('mb-4 flex items-center pt-2', collapsed ? 'flex-col gap-3' : 'justify-between px-2')}>
          <Link href="/dashboard" className="text-[30px] font-extrabold leading-none tracking-[-0.04em]">
            {collapsed ? 'P' : t('app.name')}
            <span className="text-accent">.</span>
          </Link>
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? t('common.expand') : t('common.collapse')}
            className="flex size-10 items-center justify-center rounded-full text-text-2 transition-colors hover:bg-fill"
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
        </div>

        <Link
          href="/tasks/new"
          aria-label={collapsed ? t('nav.create') : undefined}
          className={clsx(
            'mb-3 flex h-12 items-center gap-2 rounded-pill bg-accent font-bold text-on-accent shadow-[0_8px_20px_rgba(255,84,40,0.35)] transition-colors hover:bg-accent-pressed',
            collapsed ? 'justify-center' : 'px-4',
          )}
        >
          <Plus size={22} strokeWidth={2.8} />
          {!collapsed && t('nav.create')}
        </Link>

        {SIDEBAR_ITEMS.filter((i) => !i.staff || staff).map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? t(label) : undefined}
              aria-label={collapsed ? t(label) : undefined}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex h-12 items-center gap-3 rounded-pill text-body font-bold transition-colors',
                collapsed ? 'justify-center' : 'px-4',
                active ? 'bg-ink text-on-ink' : 'text-text hover:bg-fill',
              )}
            >
              <Icon size={20} strokeWidth={2.4} />
              {!collapsed && t(label)}
            </Link>
          );
        })}

        <div className="mt-auto flex flex-col gap-1">
          <Link
            href="/account"
            className={clsx('flex items-center gap-3 rounded-pill p-2 transition-colors hover:bg-fill', collapsed && 'justify-center')}
          >
            <Avatar name={name} url={p?.avatar_url} size={40} />
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-callout font-bold">{name}</span>
                <span className="block truncate text-caption text-text-2">{p?.plan === 'pro' ? 'Pro' : 'Free'}</span>
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.replace('/login');
            }}
            aria-label={collapsed ? t('common.logout') : undefined}
            className={clsx(
              'flex h-11 items-center gap-3 rounded-pill text-callout font-semibold text-text-2 transition-colors hover:bg-fill',
              collapsed ? 'justify-center' : 'px-4',
            )}
          >
            <LogOut size={18} />
            {!collapsed && t('common.logout')}
          </button>
        </div>
      </Glass>
    </aside>
  );
}
