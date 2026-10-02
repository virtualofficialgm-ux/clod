import { afterAll, describe, expect, it } from 'vitest';
import { assertLedgerInvariants, closePool, createUser, publish, useDb, wallet } from './db';

const db = useDb();
afterAll(closePool);

const one = async <T = Record<string, any>>(sql: string, params: unknown[] = []) => (await db.sys<T & Record<string, any>>(sql, params)).rows[0]!;

/** Задача в работе с поданным спором от исполнителя (Pro) */
async function disputed(reward = 10_000) {
  const c = await createUser(db, { balance: 20_000 });
  const e = await createUser(db, { plan: 'pro' });
  const admin = await createUser(db, { role: 'admin' });
  const task = await publish(db, c.id, { reward });
  await db.as(e.id, `select public.take_task($1)`, [task]);
  const d = await db.as<{ id: string }>(
    e.id,
    `select (public.open_dispute('task', $1, 'payment', 'Заказчик не отвечает больше суток, работа готова', '{}', 'refund', null, true)).id`,
    [task],
  );
  return { c, e, admin, task, dispute: d.rows[0]!.id };
}

describe('Споры', () => {
  it('только на Pro, с подтверждением достоверности и описанием от 20 символов', async () => {
    const c = await createUser(db, { balance: 20_000 });
    const free = await createUser(db);
    const task = await publish(db, c.id);
    await db.as(free.id, `select public.take_task($1)`, [task]);
    await db.fails(
      db.as(free.id, `select public.open_dispute('task', $1, 'other', 'Длинное описание проблемы для спора', '{}', 'refund', null, true)`, [task]),
      'dispute_requires_pro',
    );
    await db.sys(`update public.profiles set plan = 'pro' where id = $1`, [free.id]);
    await db.fails(db.as(free.id, `select public.open_dispute('task', $1, 'other', 'коротко', '{}', 'refund', null, true)`, [task]), 'details_short');
    await db.fails(
      db.as(free.id, `select public.open_dispute('task', $1, 'other', 'Длинное описание проблемы для спора', '{}', 'refund', null, false)`, [task]),
      'confirm_required',
    );
  });

  it('решение в пользу исполнителя: награда ему, комиссия платформе', async () => {
    const { c, e, admin, task, dispute } = await disputed();
    expect((await one(`select status from public.tasks where id = $1`, [task])).status).toBe('disputed');
    await db.fails(db.as(c.id, `select public.admin_dispute_decide($1, 'executor')`, [dispute]), 'forbidden');
    await db.as(admin.id, `select public.admin_dispute_decide($1, 'in_progress', null, 'Смотрим материалы')`, [dispute]);
    await db.as(admin.id, `select public.admin_dispute_decide($1, 'executor', null, 'Работа сдана в срок')`, [dispute]);
    expect((await wallet(db, e.id)).available).toBe(10_000);
    expect((await one(`select status from public.tasks where id = $1`, [task])).status).toBe('completed');
    const mine = await db.as<{ decision: string; events: unknown[] }>(c.id, `select decision, events from public.my_disputes()`);
    expect(mine.rows[0]!.decision).toBe('executor');
    expect(mine.rows[0]!.events).toHaveLength(3);
    await assertLedgerInvariants(db);
  });

  it('в пользу заказчика: весь Сейф вместе с комиссией возвращается', async () => {
    const { c, admin, task, dispute } = await disputed();
    const before = (await wallet(db, c.id)).available;
    await db.as(admin.id, `select public.admin_dispute_decide($1, 'customer', null, 'Работа не сдана')`, [dispute]);
    expect((await wallet(db, c.id)).available).toBe(before + 10_000 + 350);
    expect((await one(`select status from public.tasks where id = $1`, [task])).status).toBe('archived');
    await assertLedgerInvariants(db);
  });

  it('компромисс: исполнителю часть, комиссия пропорционально, остаток заказчику', async () => {
    const { c, e, admin, dispute } = await disputed();
    const before = (await wallet(db, c.id)).available;
    await db.fails(db.as(admin.id, `select public.admin_dispute_decide($1, 'compromise', 10000)`, [dispute]), 'invalid_amount');
    await db.as(admin.id, `select public.admin_dispute_decide($1, 'compromise', 6000, 'Сделано наполовину')`, [dispute]);
    expect((await wallet(db, e.id)).available).toBe(6_000);
    // Комиссия 4% от 100 $ = 4 $; пропорционально 60% → 2,40 $; заказчику 104 − 60 − 2,40 = 41,60 $
    expect((await wallet(db, c.id)).available).toBe(before + 4_140);
    await db.fails(db.as(admin.id, `select public.admin_dispute_decide($1, 'executor')`, [dispute]), 'invalid_status');
    await assertLedgerInvariants(db);
  });

  it('отклонённый спор возвращает задачу на проверку', async () => {
    const { admin, task, dispute } = await disputed();
    await db.as(admin.id, `select public.admin_dispute_decide($1, 'rejected', null, 'Нет оснований')`, [dispute]);
    expect((await one(`select status from public.tasks where id = $1`, [task])).status).toBe('review');
  });
});

describe('Поддержка', () => {
  it('обращение, ответ команды (не видна внутренняя заметка), закрытие', async () => {
    const u = await createUser(db);
    const other = await createUser(db);
    const admin = await createUser(db, { role: 'admin' });
    const tk = await db.as<{ id: string }>(u.id, `select (public.create_ticket('payments', 'Не пришло пополнение', 'Оплатил картой, баланс не изменился')).id`);
    const id = tk.rows[0]!.id;
    await db.fails(db.as(other.id, `select public.ticket_reply($1, 'чужое')`, [id]), 'forbidden');
    await db.as(admin.id, `select public.ticket_reply($1, 'Проверили, зачислили', '[]', false)`, [id]);
    await db.as(admin.id, `select public.ticket_reply($1, 'Внутренняя заметка', '[]', true)`, [id]);
    const msgs = await db.as<{ body: string }>(u.id, `select body from public.support_messages where ticket_id = $1 order by created_at`, [id]);
    expect(msgs.rows.map((m) => m.body)).toEqual(['Оплатил картой, баланс не изменился', 'Проверили, зачислили']);
    expect((await one(`select status from public.support_tickets where id = $1`, [id])).status).toBe('waiting');
    await db.fails(db.as(u.id, `select public.ticket_set_status($1, 'waiting')`, [id]), 'forbidden');
    await db.as(u.id, `select public.ticket_set_status($1, 'resolved')`, [id]);
    expect((await one(`select count(*)::int as n from public.notifications where user_id = $1 and kind = 'support_reply'`, [u.id])).n).toBe(1);
  });

  it('заблокированный модератором может написать в поддержку', async () => {
    const u = await createUser(db);
    const admin = await createUser(db, { role: 'admin' });
    await db.as(admin.id, `select public.admin_restrict_user($1, true, 'Спам в чатах')`, [u.id]);
    await db.fails(db.as(u.id, `select public.follow_user($1, true)`, [admin.id]), 'account_blocked');
    await db.as(u.id, `select public.create_ticket('account', 'Оспорить блокировку', 'Я не рассылал спам, проверьте')`);
    await db.as(admin.id, `select public.admin_restrict_user($1, false)`, [u.id]);
    expect((await one(`select count(*)::int as n from public.admin_audit where target = $1`, [u.id])).n).toBe(2);
  });
});

describe('Верификация', () => {
  it('селфи → отметка «подтверждён», навык → подтверждённый, вуз → вуз в профиле', async () => {
    const u = await createUser(db, { university: null });
    const admin = await createUser(db, { role: 'admin' });
    const file = `[{"path":"${u.id}/kyc/selfie.jpg","name":"selfie.jpg","size":1000,"mime":"image/jpeg"}]`;
    await db.fails(db.as(u.id, `select public.submit_verification('selfie', '{}', '[]')`), 'files_required');
    const s = await db.as<{ id: string }>(u.id, `select (public.submit_verification('selfie', '{}', $1)).id`, [file]);
    await db.fails(db.as(u.id, `select public.submit_verification('selfie', '{}', $1)`, [file]), 'already_pending');
    await db.as(admin.id, `select public.admin_verification_decide($1, 'approved')`, [s.rows[0]!.id]);
    expect((await one(`select verified_at is not null as v from public.profiles where id = $1`, [u.id])).v).toBe(true);

    const sk = await db.as<{ id: string }>(u.id, `select (public.submit_verification('skill', '{"skill":"figma","level":"expert"}', '[]')).id`);
    await db.as(admin.id, `select public.admin_verification_decide($1, 'approved')`, [sk.rows[0]!.id]);
    expect((await one(`select verified from public.profile_skills where profile_id = $1 and skill_slug = 'figma'`, [u.id])).verified).toBe(true);

    const uni = (await one(`select id from public.universities limit 1`)).id;
    const r = await db.as<{ id: string }>(u.id, `select (public.submit_verification('university', $1, $2)).id`, [
      JSON.stringify({ university_id: uni, status: 'student', consent: true }),
      file,
    ]);
    await db.as(admin.id, `select public.admin_verification_decide($1, 'need_docs', 'Нужна справка')`, [r.rows[0]!.id]);
    expect((await one(`select university_id from public.profiles where id = $1`, [u.id])).university_id).toBeNull();
    expect((await one(`select count(*)::int as n from public.notifications where user_id = $1 and kind like 'verification_%'`, [u.id])).n).toBe(3);
  });
});

describe('Модерация', () => {
  it('скрытая задача пропадает из ленты и недоступна посторонним', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const v = await createUser(db);
    const admin = await createUser(db, { role: 'admin' });
    const task = await publish(db, c.id);
    const feed = async () =>
      (await db.as<{ id: string }>(v.id, `select id from public.feed_tasks(p_kind => 'online', p_limit => 200)`)).rows.map((r) => r.id);
    expect(await feed()).toContain(task);
    await db.fails(db.as(admin.id, `select public.admin_hide_task($1, true, '')`, [task]), 'reason_required');
    await db.as(admin.id, `select public.admin_hide_task($1, true, 'Запрещённый контент')`, [task]);
    expect(await feed()).not.toContain(task);
    expect((await db.as<{ d: unknown }>(v.id, `select public.task_detail($1) as d`, [task])).rows[0]!.d).toBeNull();
    await db.as(admin.id, `select public.admin_hide_task($1, false)`, [task]);
    expect(await feed()).toContain(task);
  });

  it('тестовое начисление только администратору и с комментарием', async () => {
    const u = await createUser(db);
    const mod = await createUser(db, { role: 'moderator' });
    const admin = await createUser(db, { role: 'admin' });
    await db.fails(db.as(mod.id, `select public.admin_adjust_balance($1, 500, 'USD', 'тест')`, [u.id]), 'forbidden');
    await db.fails(db.as(admin.id, `select public.admin_adjust_balance($1, 500, 'USD', '')`, [u.id]), 'invalid_input');
    await db.as(admin.id, `select public.admin_adjust_balance($1, 500, 'USDT', 'Тестовое начисление')`, [u.id]);
    expect((await one(`select usdt_available_cents from public.wallets where user_id = $1`, [u.id])).usdt_available_cents).toBe('500');
    const stats = await db.as<{ s: { users: number } }>(admin.id, `select public.admin_stats() as s`);
    expect(stats.rows[0]!.s.users).toBeGreaterThan(0);
    await db.fails(db.as(u.id, `select public.admin_stats()`), 'forbidden');
    await assertLedgerInvariants(db);
  });
});

describe('Рядом, чек-ин, аналитика, push', () => {
  it('чек-ин засчитывается в радиусе задачи и пишет событие в чат', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id, { kind: 'nearby' });
    await db.as(e.id, `select public.take_task($1)`, [task]);
    const far = await db.as<{ r: { within: boolean; distance_m: number } }>(e.id, `select public.task_checkin($1, 55.76, 37.61, 20) as r`, [task]);
    expect(far.rows[0]!.r.within).toBe(false);
    expect(far.rows[0]!.r.distance_m).toBeGreaterThan(1000);
    const near = await db.as<{ r: { within: boolean } }>(e.id, `select public.task_checkin($1, 55.7501, 37.6101, 10) as r`, [task]);
    expect(near.rows[0]!.r.within).toBe(true);
    await db.fails(db.as(c.id, `select public.task_checkin($1, 55.75, 37.61)`, [task]), 'forbidden');
    const ev = await db.sys<{ body: string }>(`select body from public.messages where task_id = $1 and kind = 'system' order by created_at`, [task]);
    expect(ev.rows.map((r) => r.body)).toEqual(expect.arrayContaining(['checkin_far', 'checked_in']));
  });

  it('до принятия задачи в ленте и карточке — приблизительная точка', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const v = await createUser(db);
    const task = await publish(db, c.id, { kind: 'nearby' });
    await db.sys(`update public.tasks set location = extensions.st_setsrid(extensions.st_makepoint(37.612345, 55.751234), 4326)::extensions.geography where id = $1`, [task]);
    const feed = await db.as<{ lat: number; lng: number }>(v.id, `select lat, lng from public.feed_tasks(p_kind => 'nearby', p_lat => 55.75, p_lng => 37.61, p_limit => 200) where id = $1`, [task]);
    expect(feed.rows[0]).toEqual({ lat: 55.751, lng: 37.612 });
    const d = await db.as<{ d: { task: { lat: number } } }>(v.id, `select public.task_detail($1) as d`, [task]);
    expect(d.rows[0]!.d.task.lat).toBe(55.751);
    const own = await db.as<{ d: { task: { lat: number } } }>(c.id, `select public.task_detail($1) as d`, [task]);
    expect(own.rows[0]!.d.task.lat).toBeCloseTo(55.751234, 5);
  });

  it('аналитика считает созданные, взятые и воронку', async () => {
    const c = await createUser(db, { balance: 10_000 });
    await publish(db, c.id);
    const a = await db.as<{ a: { created: number; funnel: { open: number }; weeks: unknown[] } }>(c.id, `select public.my_analytics() as a`);
    expect(a.rows[0]!.a).toMatchObject({ created: 1, funnel: { open: 1 } });
    expect(a.rows[0]!.a.weeks).toHaveLength(8);
  });

  it('push: пачка уходит один раз и только тем, у кого есть токен', async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await db.as(b.id, `select public.register_push_token('ExponentPushToken[test-${b.id.slice(0, 6)}]', 'ios')`);
    await db.as(a.id, `select public.follow_user($1, true)`, [b.id]);
    const first = await db.sys<{ user_id: string; tokens: string[] }>(`select user_id, tokens from public.svc_push_batch(500) where user_id = $1`, [b.id]);
    expect(first.rows).toHaveLength(1);
    expect(first.rows[0]!.tokens[0]).toMatch(/^ExponentPushToken/);
    const again = await db.sys(`select * from public.svc_push_batch(500) where user_id = $1`, [b.id]);
    expect(again.rows).toHaveLength(0);
    await db.fails(db.as(a.id, `select public.svc_push_batch(10)`), 'permission denied');
  });
});
