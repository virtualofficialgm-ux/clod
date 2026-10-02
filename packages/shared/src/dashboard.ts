/** Сводки для дашборда: считаются на клиенте из уже загруженных данных */
import type { Me } from './api';
import type { LedgerEntry, MyTask } from './types';

export interface CompletenessItem {
  key: 'avatar' | 'name' | 'bio' | 'skills' | 'university' | 'portfolio';
  done: boolean;
}

/** Заполненность профиля: шесть пунктов, каждый ≈ 17% */
export function profileCompleteness(me: Pick<Me, 'profile' | 'skills'> | null | undefined): {
  percent: number;
  items: CompletenessItem[];
} {
  const p = me?.profile;
  const items: CompletenessItem[] = [
    { key: 'avatar', done: !!p?.avatar_url },
    { key: 'name', done: !!p?.first_name && !!p?.last_name },
    { key: 'bio', done: (p?.bio?.trim().length ?? 0) >= 40 },
    { key: 'skills', done: (me?.skills.length ?? 0) >= 5 },
    { key: 'university', done: !!p?.university_id },
    { key: 'portfolio', done: (p?.portfolio_links.length ?? 0) > 0 },
  ];
  const percent = Math.round((items.filter((i) => i.done).length / items.length) * 100);
  return { percent, items };
}

/** Заработано исполнителем с начала месяца: выплаты за задачи на свободный баланс */
export function earnedThisMonth(ledger: readonly LedgerEntry[], now = new Date()): number {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return ledger
    .filter((e) => e.kind === 'task_release' && e.account === 'available' && e.amount_cents > 0)
    .filter((e) => new Date(e.created_at).getTime() >= start)
    .reduce((s, e) => s + e.amount_cents, 0);
}

export const ACTIVE_STATUSES = new Set(['in_progress', 'review', 'disputed']);

/** Активные задачи с дедлайном → ключ дня YYYY-MM-DD (по местному времени) */
export function deadlineDays(list: readonly MyTask[]): Map<string, MyTask[]> {
  const map = new Map<string, MyTask[]>();
  for (const task of list) {
    if (!ACTIVE_STATUSES.has(task.status) || !task.due_at) continue;
    const d = new Date(task.due_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    map.set(key, [...(map.get(key) ?? []), task]);
  }
  return map;
}
