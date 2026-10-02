import { t, type AppNotification } from '@parri/shared';

/** Текст уведомления по его виду */
export function notificationText(n: AppNotification) {
  return t(`notif.k.${n.kind}`, {
    actor: n.actor_name || 'Parri',
    title: String(n.payload.title ?? ''),
    body: String(n.payload.body ?? ''),
  });
}
