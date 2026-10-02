import { describe, expect, it } from 'vitest';
import { deadlineDays, earnedThisMonth, myTaskNext, myTaskProgress, myTaskTab, profileCompleteness } from './dashboard';
import type { LedgerEntry, MyTask } from './types';

const entry = (p: Partial<LedgerEntry>): LedgerEntry => ({
  id: 1, tx_id: 't', kind: 'task_release', account: 'available', currency: 'USD', task_id: null, amount_cents: 0, memo: null,
  created_at: '2026-10-05T10:00:00Z', ...p,
});

describe('дашборд', () => {
  it('заработок за месяц учитывает только выплаты за задачи в текущем месяце', () => {
    const now = new Date('2026-10-20T12:00:00Z');
    const ledger = [
      entry({ amount_cents: 2500 }),
      entry({ amount_cents: 1000, created_at: '2026-09-30T10:00:00Z' }),
      entry({ kind: 'topup', amount_cents: 9999 }),
      entry({ account: 'escrow', amount_cents: 500 }),
    ];
    expect(earnedThisMonth(ledger, now)).toBe(2500);
  });

  it('заполненность профиля', () => {
    expect(profileCompleteness(null).percent).toBe(0);
    const me = {
      profile: { avatar_url: 'x', first_name: 'A', last_name: 'B', bio: 'x'.repeat(40), university_id: 1, portfolio_links: ['https://a'] },
      skills: ['a', 'b', 'c', 'd', 'e'],
    } as never;
    expect(profileCompleteness(me).percent).toBe(100);
  });

  it('дедлайны группируются по дням, только активные', () => {
    const base = { status: 'in_progress', due_at: '2026-10-05T10:00:00' } as MyTask;
    const map = deadlineDays([base, { ...base, status: 'completed' }, { ...base, due_at: null }]);
    expect([...map.keys()]).toEqual(['2026-10-05']);
    expect(map.get('2026-10-05')).toHaveLength(1);
  });
});

describe('доход по неделям', () => {
  it('раскладывает выплаты по неделям, USDT отдельно', async () => {
    const { weeklyIncome } = await import('./dashboard');
    const now = new Date('2026-10-14T12:00:00'); // среда
    const ledger = [
      entry({ amount_cents: 1000, created_at: '2026-10-13T09:00:00' }),
      entry({ amount_cents: 500, created_at: '2026-10-06T09:00:00' }),
      entry({ amount_cents: 700, created_at: '2026-10-06T09:00:00', currency: 'USDT' }),
      entry({ amount_cents: 300, created_at: '2026-08-01T09:00:00' }),
    ];
    const w = weeklyIncome(ledger, 7, 'USD', now);
    expect(w).toHaveLength(7);
    expect(w.map((x) => x.cents)).toEqual([0, 0, 0, 0, 0, 500, 1000]);
    expect(weeklyIncome(ledger, 7, 'USDT', now).at(-2)!.cents).toBe(700);
  });
});

describe('«Мои задачи»', () => {
  const base = { status: 'open', expired: false, started_at: null, reviewed: false, due_at: null, assigned_at: null } as unknown as MyTask;
  const mk = (p: Partial<MyTask>) => ({ ...base, ...p }) as MyTask;

  it('раскладывает по вкладкам для исполнителя и заказчика', () => {
    expect(myTaskTab(mk({ status: 'open' }), 'executor')).toBe('responses');
    expect(myTaskTab(mk({ status: 'in_progress' }), 'executor')).toBe('active');
    expect(myTaskTab(mk({ status: 'open' }), 'customer')).toBe('choosing');
    expect(myTaskTab(mk({ status: 'in_progress' }), 'customer')).toBe('inwork');
    expect(myTaskTab(mk({ status: 'review' }), 'customer')).toBe('review');
    expect(myTaskTab(mk({ status: 'open', expired: true }), 'customer')).toBe('archive');
  });

  it('следующее действие: начать → продолжить → отзыв', () => {
    expect(myTaskNext(mk({ status: 'in_progress' }), 'executor')).toEqual({ action: 'start', target: 'page' });
    expect(myTaskNext(mk({ status: 'in_progress', started_at: '2026-01-01T00:00:00Z' }), 'executor').action).toBe('continue');
    expect(myTaskNext(mk({ status: 'completed' }), 'executor').action).toBe('review');
    expect(myTaskNext(mk({ status: 'completed', reviewed: true }), 'customer')).toEqual({ action: 'repeat', target: 'repeat' });
    expect(myTaskNext(mk({ status: 'review' }), 'customer')).toEqual({ action: 'check', target: 'room' });
  });

  it('прогресс срока ограничен 0…1', () => {
    const t0 = Date.parse('2026-01-01T00:00:00Z');
    const task = { assigned_at: '2026-01-01T00:00:00Z', due_at: '2026-01-01T10:00:00Z' };
    expect(myTaskProgress(task, t0 + 5 * 3600_000)).toBeCloseTo(0.5);
    expect(myTaskProgress(task, t0 + 20 * 3600_000)).toBe(1);
    expect(myTaskProgress({ assigned_at: null, due_at: null })).toBeNull();
  });
});
