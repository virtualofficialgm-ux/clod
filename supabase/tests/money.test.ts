import { calcFee, feeBpsForReward, proportionalFeeRefund } from '@parri/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { assertLedgerInvariants, closePool, createUser, publish, respond, useDb, wallet } from './db';

const db = useDb();
afterAll(closePool);

describe('комиссия: SQL совпадает с TypeScript', () => {
  it('calc_fee на всём диапазоне бюджетов', async () => {
    const values = [100, 101, 104, 105, 115, 149, 150, 999, 1005, 2500, 33333, 99995, 1_000_000];
    for (let i = 0; i < 200; i++) values.push(100 + Math.floor(Math.random() * 999_900));
    const res = await db.sys<{ r: string; fee: string }>(
      `select r::text, public.calc_fee(r, public.fee_bps_for_reward(r))::text as fee from unnest($1::bigint[]) r`,
      [values],
    );
    for (const row of res.rows) expect(Number(row.fee)).toBe(calcFee(Number(row.r)));
  });

  it('шкала совпадает на границах ступеней', async () => {
    const edges = [4999, 5000, 9999, 10000, 19999, 20000, 49999, 50000];
    const res = await db.sys<{ r: string; bps: number }>(
      `select r::text, public.fee_bps_for_reward(r) as bps from unnest($1::bigint[]) r`,
      [edges],
    );
    for (const row of res.rows) expect(row.bps).toBe(feeBpsForReward(Number(row.r)));
  });

  it('пропорциональный возврат комиссии совпадает', async () => {
    const res = await db.sys<{ v: string }>(`select public.proportional_fee_refund(11, 105, 50)::text as v`);
    expect(Number(res.rows[0]!.v)).toBe(proportionalFeeRefund(11, 105, 50));
  });
});

describe('Сейф: публикация', () => {
  it('списывает награду и комиссию с баланса в Сейф', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const task = await publish(db, c.id, { reward: 2500 });
    expect(await wallet(db, c.id)).toEqual({ available: 10_000 - 2625, safe: 2625 });
    const t = await db.sys(`select status, reward_cents, fee_cents, fee_bps from public.tasks where id = $1`, [task]);
    expect(t.rows[0]).toMatchObject({ status: 'open', reward_cents: '2500', fee_cents: '125', fee_bps: 500 });
    await assertLedgerInvariants(db);
  });

  it('при нехватке денег задача не создаётся и баланс не меняется', async () => {
    const c = await createUser(db, { balance: 2000 });
    await db.fails(publish(db, c.id, { reward: 2500 }), 'insufficient_funds');
    expect(await wallet(db, c.id)).toEqual({ available: 2000, safe: 0 });
    const n = await db.sys(`select count(*)::int as n from public.tasks where customer_id = $1`, [c.id]);
    expect(n.rows[0].n).toBe(0);
  });

  it('бюджет вне диапазона $1–$10 000 отклоняется', async () => {
    const c = await createUser(db, { balance: 2_000_000 });
    await db.fails(publish(db, c.id, { reward: 99 }), 'reward_out_of_range');
    await db.fails(publish(db, c.id, { reward: 1_000_001 }), 'reward_out_of_range');
  });

  it('без онбординга публиковать нельзя', async () => {
    const c = await createUser(db, { balance: 10_000, onboarded: false });
    await db.fails(publish(db, c.id), 'onboarding_incomplete');
  });
});

describe('Сейф: выплата после приёмки', () => {
  it('исполнитель получает награду целиком, платформа — комиссию, Сейф пуст', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id, { reward: 2500, checklist: ['A', 'B'] });
    const resp = await respond(db, e.id, task);
    await db.as(c.id, `select public.choose_response($1)`, [resp]);
    await db.as(e.id, `select public.submit_work($1, 'https://example.com/result', 'Готово', '[]')`, [task]);
    const sub = await db.sys<{ id: string }>(`select id from public.submissions where task_id = $1`, [task]);
    await db.as(c.id, `select public.review_submission($1, 'accept', array[true, true])`, [sub.rows[0]!.id]);

    expect(await wallet(db, c.id)).toEqual({ available: 10_000 - 2625, safe: 0 });
    expect(await wallet(db, e.id)).toEqual({ available: 2500, safe: 0 });
    const rev = await db.sys<{ s: string }>(
      `select sum(amount_cents)::text as s from public.ledger_entries where task_id = $1 and account = 'platform_revenue'`,
      [task],
    );
    expect(Number(rev.rows[0]!.s)).toBe(125);
    const stats = await db.sys(`select completed_count, earned_cents from public.profiles where id = $1`, [e.id]);
    expect(stats.rows[0]).toMatchObject({ completed_count: 1, earned_cents: '2500' });
    await assertLedgerInvariants(db);
  });

  it('принять можно только с полностью отмеченным чек-листом', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id, { checklist: ['A', 'B'] });
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, e.id, task)]);
    await db.as(e.id, `select public.submit_work($1, 'https://example.com/r')`, [task]);
    const sub = (await db.sys<{ id: string }>(`select id from public.submissions where task_id = $1`, [task])).rows[0]!.id;
    await db.fails(db.as(c.id, `select public.review_submission($1, 'accept', array[true, false])`, [sub]), 'checklist_incomplete');
    await db.fails(db.as(c.id, `select public.review_submission($1, 'accept', array[true])`, [sub]), 'checklist_incomplete');
    await db.fails(db.as(c.id, `select public.review_submission($1, 'accept', array[true, null])`, [sub]), 'checklist_incomplete');
    expect((await wallet(db, e.id)).available).toBe(0);
  });

  it('доработка и спор без причины невозможны; доработка возвращает задачу в работу', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id);
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, e.id, task)]);
    await db.as(e.id, `select public.submit_work($1, 'https://example.com/v1')`, [task]);
    const sub = (await db.sys<{ id: string }>(`select id from public.submissions where task_id = $1`, [task])).rows[0]!.id;
    await db.fails(db.as(c.id, `select public.review_submission($1, 'revision', '{}', 'нет')`, [sub]), 'reason_required');
    await db.fails(db.as(c.id, `select public.review_submission($1, 'dispute', '{}', null)`, [sub]), 'reason_required');
    await db.as(c.id, `select public.review_submission($1, 'revision', '{}', 'Поправьте второй слайд, пожалуйста')`, [sub]);
    const t = await db.sys(`select status from public.tasks where id = $1`, [task]);
    expect(t.rows[0].status).toBe('in_progress');
    // Вторая версия
    await db.as(e.id, `select public.submit_work($1, 'https://example.com/v2')`, [task]);
    const versions = await db.sys(`select version, status from public.submissions where task_id = $1 order by version`, [task]);
    expect(versions.rows).toEqual([
      { version: 1, status: 'revision_requested' },
      { version: 2, status: 'pending' },
    ]);
    // Старую версию принять нельзя
    await db.fails(db.as(c.id, `select public.review_submission($1, 'accept', array[true, true])`, [sub]), 'invalid_status');
    expect(await wallet(db, c.id)).toEqual({ available: 10_000 - 2625, safe: 2625 });
    await assertLedgerInvariants(db);
  });

  it('спор (тариф Pro) замораживает деньги в Сейфе', async () => {
    const c = await createUser(db, { balance: 10_000, plan: 'pro' });
    const e = await createUser(db);
    const task = await publish(db, c.id);
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, e.id, task)]);
    await db.as(e.id, `select public.submit_work($1, 'https://example.com/v1')`, [task]);
    const sub = (await db.sys<{ id: string }>(`select id from public.submissions where task_id = $1`, [task])).rows[0]!.id;
    await db.as(c.id, `select public.review_submission($1, 'dispute', '{}', 'Работа не соответствует заданию')`, [sub]);
    const d = await db.sys(`select status from public.disputes where task_id = $1`, [task]);
    expect(d.rows[0].status).toBe('pending');
    expect(await wallet(db, c.id)).toEqual({ available: 10_000 - 2625, safe: 2625 });
    expect((await wallet(db, e.id)).available).toBe(0);
  });
});

describe('Сейф: возврат', () => {
  it('отмена открытой задачи возвращает всё, включая комиссию', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const task = await publish(db, c.id, { reward: 2500 });
    await db.as(c.id, `select public.cancel_task($1)`, [task]);
    expect(await wallet(db, c.id)).toEqual({ available: 10_000, safe: 0 });
    const t = await db.sys(`select status, archive_reason from public.tasks where id = $1`, [task]);
    expect(t.rows[0]).toEqual({ status: 'archived', archive_reason: 'cancelled' });
    await assertLedgerInvariants(db);
  });

  it('после выбора исполнителя отменить нельзя', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id);
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, e.id, task)]);
    await db.fails(db.as(c.id, `select public.cancel_task($1)`, [task]), 'invalid_status');
  });

  it('просроченная задача возвращает деньги, повторная публикация снова блокирует', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id, { reward: 2500 });
    await respond(db, e.id, task);
    await db.sys(`update public.tasks set expires_at = now() - interval '1 minute' where id = $1`, [task]);
    const n = await db.sys<{ n: number }>(`select public.expire_tasks() as n`);
    expect(n.rows[0]!.n).toBeGreaterThanOrEqual(1);
    expect(await wallet(db, c.id)).toEqual({ available: 10_000, safe: 0 });
    const resp = await db.sys(`select status from public.task_responses where task_id = $1`, [task]);
    expect(resp.rows[0].status).toBe('rejected');

    await db.as(c.id, `select public.republish_task($1)`, [task]);
    expect(await wallet(db, c.id)).toEqual({ available: 10_000 - 2625, safe: 2625 });
    const t = await db.sys(`select status, archive_reason from public.tasks where id = $1`, [task]);
    expect(t.rows[0]).toEqual({ status: 'open', archive_reason: null });
    await assertLedgerInvariants(db);
  });

  it('республикация без ожидания cron: истёкшая открытая задача обрабатывается сразу', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const task = await publish(db, c.id, { reward: 2500 });
    await db.sys(`update public.tasks set expires_at = now() - interval '1 minute' where id = $1`, [task]);
    await db.as(c.id, `select public.republish_task($1)`, [task]);
    expect(await wallet(db, c.id)).toEqual({ available: 10_000 - 2625, safe: 2625 });
    await assertLedgerInvariants(db);
  });

  it('отменённую задачу можно опубликовать снова, открытую или в работе — нельзя', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const task = await publish(db, c.id);
    await db.fails(db.as(c.id, `select public.republish_task($1)`, [task]), 'invalid_status');
    await db.as(c.id, `select public.cancel_task($1)`, [task]);
    await db.as(c.id, `select public.republish_task($1)`, [task]);
    expect(await wallet(db, c.id)).toEqual({ available: 10_000 - 2625, safe: 2625 });
    await assertLedgerInvariants(db);
  });
});

describe('Сейф: своя цена исполнителя', () => {
  it('цена выше — разница и комиссия с неё доплачиваются в Сейф', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id, { reward: 2500 });
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, e.id, task, 3000)]);
    expect(await wallet(db, c.id)).toEqual({ available: 10_000 - 3150, safe: 3150 });
    const t = await db.sys(`select reward_cents, fee_cents from public.tasks where id = $1`, [task]);
    expect(t.rows[0]).toEqual({ reward_cents: '3000', fee_cents: '150' });
    await assertLedgerInvariants(db);
  });

  it('цена ниже — разница возвращается из Сейфа', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id, { reward: 2500 });
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, e.id, task, 2000)]);
    expect(await wallet(db, c.id)).toEqual({ available: 10_000 - 2100, safe: 2100 });
    await assertLedgerInvariants(db);
  });

  it('после смены цены приёмка выплачивает новую награду и новую комиссию', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id, { reward: 1200, checklist: [] });
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, e.id, task, 1500)]);
    await db.as(e.id, `select public.submit_work($1, 'https://example.com/r')`, [task]);
    const sub = (await db.sys<{ id: string }>(`select id from public.submissions where task_id = $1`, [task])).rows[0]!.id;
    await db.as(c.id, `select public.review_submission($1, 'accept', '{}')`, [sub]);
    expect(await wallet(db, c.id)).toEqual({ available: 10_000 - 1575, safe: 0 });
    expect(await wallet(db, e.id)).toEqual({ available: 1500, safe: 0 });
    await assertLedgerInvariants(db);
  });

  it('если на доплату не хватает денег, выбор не происходит', async () => {
    const c = await createUser(db, { balance: 2625 });
    const e = await createUser(db);
    const task = await publish(db, c.id, { reward: 2500 });
    const resp = await respond(db, e.id, task, 5000);
    await db.fails(db.as(c.id, `select public.choose_response($1)`, [resp]), 'insufficient_funds');
    const t = await db.sys(`select status from public.tasks where id = $1`, [task]);
    expect(t.rows[0].status).toBe('open');
    expect(await wallet(db, c.id)).toEqual({ available: 0, safe: 2625 });
  });

  it('своя цена переходит на другую ступень шкалы — ставка пересчитывается', async () => {
    const c = await createUser(db, { balance: 20_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id, { reward: 4900 });
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, e.id, task, 5000)]);
    const t = await db.sys(`select fee_bps, fee_cents from public.tasks where id = $1`, [task]);
    expect(t.rows[0]).toEqual({ fee_bps: 400, fee_cents: '200' });
    expect(await wallet(db, c.id)).toEqual({ available: 20_000 - 5200, safe: 5200 });
    await assertLedgerInvariants(db);
  });
});

describe('Дедлайн исполнителя', () => {
  it('Pro получает +15 минут', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const free = await createUser(db);
    const pro = await createUser(db, { plan: 'pro' });
    const t1 = await publish(db, c.id);
    const t2 = await publish(db, c.id);
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, free.id, t1)]);
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, pro.id, t2)]);
    const r = await db.sys<{ id: string; minutes: number }>(
      `select id, round(extract(epoch from due_at - assigned_at) / 60)::int as minutes from public.tasks where id = any($1)`,
      [[t1, t2]],
    );
    const byId = Object.fromEntries(r.rows.map((x) => [x.id, x.minutes]));
    expect(byId[t1]).toBe(1440);
    expect(byId[t2]).toBe(1455);
  });
});

describe('Защита денег от клиента', () => {
  it('клиент не может пополнить себя, менять кошелёк или писать в журнал', async () => {
    const u = await createUser(db);
    await db.fails(db.as(u.id, `select public.dev_credit($1, 100000)`, [u.id]), 'permission denied');
    await db.fails(db.as(u.id, `update public.wallets set available_cents = 999999 where user_id = $1`, [u.id]), 'permission denied');
    await db.fails(
      db.as(u.id, `insert into public.ledger_entries (tx_id, kind, account, user_id, amount_cents)
                   values (gen_random_uuid(), 'seed', 'available', $1, 100)`, [u.id]),
      'permission denied',
    );
    await db.fails(db.as(u.id, `select private.post(gen_random_uuid(), 'seed', 'available', $1, null, 100)`, [u.id]), 'permission denied');
  });

  it('журнал неизменяем, а несбалансированная транзакция отклоняется', async () => {
    const u = await createUser(db, { balance: 1000 });
    await db.fails(db.sys(`update public.ledger_entries set amount_cents = 1 where user_id = $1`, [u.id]), 'ledger_is_append_only');
    await db.fails(
      db.sys(`insert into public.ledger_entries (tx_id, kind, account, user_id, amount_cents)
              values (gen_random_uuid(), 'adjustment', 'available', $1, 5)`, [u.id]),
      'ledger_unbalanced',
    );
  });

  it('пользователь видит только свой кошелёк и свои проводки', async () => {
    const a = await createUser(db, { balance: 1000 });
    const b = await createUser(db, { balance: 2000 });
    const w = await db.as(a.id, `select user_id from public.wallets`);
    expect(w.rows.map((r) => r.user_id)).toEqual([a.id]);
    const l = await db.as(b.id, `select distinct user_id from public.ledger_entries`);
    expect(l.rows.map((r) => r.user_id)).toEqual([b.id]);
  });
});
