'use client';

import { t } from '@parri/shared';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { useBadges } from './badges';

/** Колокольчик с числом новых уведомлений (в шапке на телефоне) */
export function NotificationBell() {
  const { notifications } = useBadges();
  return (
    <Link
      href="/notifications"
      aria-label={notifications ? `${t('notif.title')}: ${notifications}` : t('notif.title')}
      className="glass relative flex size-12 items-center justify-center rounded-pill"
    >
      <Bell size={20} />
      {notifications > 0 && (
        <span className="tabular absolute -right-0.5 -top-0.5 min-w-5 rounded-pill bg-accent px-1 text-center text-[11px] font-bold leading-5 text-on-accent">
          {notifications > 99 ? '99+' : notifications}
        </span>
      )}
    </Link>
  );
}
