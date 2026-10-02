/** Сводки для дашборда: считаются на клиенте из уже загруженных данных */
import type { Me } from './api';
import { displayStatus, type LedgerEntry, type MyTask } from './types';

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
    .filter((e) => e.kind === 'task_release' && e.account === 'available' && e.amount_cents > 0 && e.currency !== 'USDT')
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

/** Доход по неделям (последние n недель, от старых к новым) — для графика баланса */
export function weeklyIncome(ledger: readonly LedgerEntry[], weeks = 7, currency: 'USD' | 'USDT' = 'USD', now = new Date()): { start: Date; cents: number }[] {
  const day = (now.getDay() + 6) % 7; // понедельник = 0
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
  const buckets = Array.from({ length: weeks }, (_, i) => ({
    start: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * (weeks - 1 - i)),
    cents: 0,
  }));
  for (const e of ledger) {
    if (e.kind !== 'task_release' || e.account !== 'available' || e.amount_cents <= 0 || (e.currency ?? 'USD') !== currency) continue;
    const t = new Date(e.created_at).getTime();
    for (let i = buckets.length - 1; i >= 0; i--) {
      if (t >= buckets[i]!.start.getTime()) {
        if (i === buckets.length - 1 || t < buckets[i + 1]!.start.getTime()) buckets[i]!.cents += e.amount_cents;
        break;
      }
    }
  }
  return buckets;
}

// ---------- «Мои задачи»: вкладки и следующее действие ----------

export type MyRole = 'executor' | 'customer';
export type MyTab = 'active' | 'responses' | 'review' | 'done' | 'archive' | 'choosing' | 'inwork' | 'drafts';
export const MY_TABS: Record<MyRole, MyTab[]> = {
  executor: ['active', 'responses', 'review', 'done', 'archive'],
  customer: ['choosing', 'inwork', 'review', 'done', 'archive', 'drafts'],
};

export function myTaskTab(task: MyTask, role: MyRole): MyTab {
  const s = displayStatus(task);
  if (s === 'review') return 'review';
  if (s === 'completed') return 'done';
  if (s === 'archived') return 'archive';
  if (role === 'executor') return s === 'open' ? 'responses' : 'active';
  return s === 'open' ? 'choosing' : 'inwork';
}

export type MyNextAction = 'start' | 'continue' | 'chat' | 'review' | 'open' | 'responses' | 'check' | 'repeat';
/** Куда ведёт главная кнопка: страница задачи, комната, отклики или «повторить» */
export type MyNextTarget = 'page' | 'room' | 'responses' | 'repeat';

export function myTaskNext(task: MyTask, role: MyRole): { action: MyNextAction; target: MyNextTarget } {
  const s = displayStatus(task);
  if (role === 'executor') {
    if (s === 'in_progress' && !task.started_at) return { action: 'start', target: 'page' };
    if (s === 'in_progress' || s === 'disputed') return { action: 'continue', target: 'room' };
    if (s === 'review') return { action: 'chat', target: 'room' };
    if (s === 'completed' && !task.reviewed) return { action: 'review', target: 'page' };
    return { action: 'open', target: 'page' };
  }
  if (s === 'open') return { action: 'responses', target: 'responses' };
  if (s === 'in_progress' || s === 'disputed') return { action: 'chat', target: 'room' };
  if (s === 'review') return { action: 'check', target: 'room' };
  if (s === 'completed' && !task.reviewed) return { action: 'review', target: 'page' };
  return { action: 'repeat', target: 'repeat' };
}

/** Доля прошедшего срока (0…1) для задач в работе и на проверке */
export function myTaskProgress(task: Pick<MyTask, 'due_at' | 'assigned_at'>, now = Date.now()): number | null {
  if (!task.due_at || !task.assigned_at) return null;
  const a = new Date(task.assigned_at).getTime();
  const b = new Date(task.due_at).getTime();
  if (b <= a) return 1;
  return Math.min(1, Math.max(0, (now - a) / (b - a)));
}
