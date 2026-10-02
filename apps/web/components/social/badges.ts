'use client';

import {
  useDirectThreads,
  useSession,
  useUnreadCount,
  useUnreadNotifications,
} from '@parri/shared/react';

/** Счётчики для меню: непрочитанные сообщения (чаты задач + личные) и уведомления */
export function useBadges() {
  const { session } = useSession();
  const on = !!session;
  const taskUnread = useUnreadCount(on);
  const direct = useDirectThreads(on).data ?? [];
  const notifications = useUnreadNotifications(on);
  return { messages: taskUnread + direct.reduce((s, x) => s + x.unread, 0), notifications };
}
