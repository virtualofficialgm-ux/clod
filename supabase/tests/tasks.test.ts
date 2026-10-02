import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { assertLedgerInvariants, closePool, createUser, publish, respond, useDb, wallet } from './db';

const db = useDb();
afterAll(closePool);

const one = async <T = Record<string, any>>(sql: string, params: unknown[] = []) => (await db.sys<T & Record<string, any>>(sql, params)).rows[0]!;

describe('Взять задачу сразу', () => {
  it('закрепляет за исполнителем, отклоняет остальные отклики, Pro +15 минут', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const pro = await createUser(db, { plan: 'pro' });
    const other = await createUser(db);
    const task = await publish(db, c.id);
    await respond(db, other.id, task);
    await db.fails(db.as(c.id, `select public.take_task($1)`, [task]), 'own_task');
    await db.as(pro.id, `select public.take_task($1)`, [task]);
    const t = await one(`select status, executor_id, take_mode, started_at, round(extract(epoch from due_at - assigned_at) / 60)::int as m from public.tasks where id = $1`, [task]);
    expect(t).toMatchObject({ status: 'in_progress', executor_id: pro.id, take_mode: 'instant', started_at: null, m: 1455 });
    expect((await one(`select status from public.task_responses where task_id = $1`, [task])).status).toBe('rejected');
    await db.fails(db.as(other.id, `select public.take_task($1)`, [task]), 'task_not_open');
  });

  it('не больше 10 задач в сутки', async () => {
    const c = await createUser(db, { balance: 100_000 });
    const e = await createUser(db);
    for (let i = 0; i < 10; i++) await db.as(e.id, `select public.take_task($1)`, [await publish(db, c.id)]);
    await db.fails(db.as(e.id, `select public.take_task($1)`, [await publish(db, c.id)]), 'daily_take_limit');
    const d = await db.as<{ d: { takes_left: number } }>(e.id, `select public.task_detail($1) as d`, [await publish(db, c.id)]);
    expect(d.rows[0]!.d.takes_left).toBe(0);
  });

  it('начать нужно за 25 минут; иначе задача возвращается в ленту без штрафа', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const t1 = await publish(db, c.id);
    await db.as(e.id, `select public.take_task($1)`, [t1]);
    await db.as(e.id, `select public.start_task($1)`, [t1]);
    expect((await one(`select started_at is not null as s from public.tasks where id = $1`, [t1])).s).toBe(true);

    const t2 = await publish(db, c.id);
    await db.as(e.id, `select public.take_task($1)`, [t2]);
    await db.sys(`update public.tasks set assigned_at = now() - interval '26 minutes' where id = $1`, [t2]);
    await db.fails(db.as(e.id, `select public.start_task($1)`, [t2]), 'start_window_passed');
    const n = await one<{ n: number }>(`select public.expire_takes() as n`);
    expect(n.n).toBeGreaterThanOrEqual(1);
    expect(await one(`select status, executor_id from public.tasks where id = $1`, [t2])).toEqual({ status: 'open', executor_id: null });
    expect((await one(`select refusals_count from public.profiles where id = $1`, [e.id])).refusals_count).toBe(0);
    // Сейф не трогается: деньги заказчика по-прежнему зарезервированы
    expect(await wallet(db, c.id)).toEqual({ available: 10_000 - 2 * 2625, safe: 2 * 2625 });
    await assertLedgerInvariants(db);
  });

  it('отказ после начала учитывается, задача снова в ленте', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id);
    await db.as(e.id, `select public.take_task($1)`, [task]);
    await db.as(e.id, `select public.refuse_task($1)`, [task]);
    expect((await one(`select refusals_count from public.profiles where id = $1`, [e.id])).refusals_count).toBe(0);
    await db.as(e.id, `select public.take_task($1)`, [task]);
    await db.as(e.id, `select public.start_task($1)`, [task]);
    await db.as(e.id, `select public.refuse_task($1, 'Не успеваю')`, [task]);
    expect((await one(`select refusals_count from public.profiles where id = $1`, [e.id])).refusals_count).toBe(1);
    expect((await one(`select status from public.tasks where id = $1`, [task])).status).toBe('open');
    const msgs = await db.sys(`select body from public.messages where task_id = $1 and kind = 'system' order by created_at`, [task]);
    expect(msgs.rows.map((m) => m.body)).toEqual(['task_taken', 'executor_refused', 'task_taken', 'work_started', 'executor_refused']);
  });

  it('выбор по отклику сразу считается начатым', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id);
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, e.id, task)]);
    expect(await one(`select take_mode, started_at is not null as s from public.tasks where id = $1`, [task])).toEqual({ take_mode: 'response', s: true });
  });
});

describe('Рабочая комната: продление и чаевые', () => {
  it('исполнитель просит продление, заказчик соглашается — срок сдвигается', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id);
    await db.as(e.id, `select public.take_task($1)`, [task]);
    const before = (await one(`select due_at from public.tasks where id = $1`, [task])).due_at as Date;
    const ext = (await db.as<{ id: string }>(e.id, `select (public.request_extension($1, 60, 'Нужен час на правки')).id`, [task])).rows[0]!.id;
    await db.fails(db.as(e.id, `select public.request_extension($1, 30)`, [task]), 'extension_pending');
    await db.fails(db.as(e.id, `select public.decide_extension($1, true)`, [ext]), 'forbidden');
    await db.as(c.id, `select public.decide_extension($1, true)`, [ext]);
    const after = (await one(`select due_at from public.tasks where id = $1`, [task])).due_at as Date;
    expect(Math.round((after.getTime() - before.getTime()) / 60000)).toBe(60);
  });

  it('чаевые: с баланса заказчика исполнителю, без комиссии', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id);
    await db.fails(db.as(c.id, `select public.send_tip($1, 500)`, [task]), 'invalid_status');
    await db.as(e.id, `select public.take_task($1)`, [task]);
    await db.fails(db.as(e.id, `select public.send_tip($1, 500)`, [task]), 'forbidden');
    await db.fails(db.as(c.id, `select public.send_tip($1, 50)`, [task]), 'tip_out_of_range');
    await db.as(c.id, `select public.send_tip($1, 500)`, [task]);
    expect((await wallet(db, e.id)).available).toBe(500);
    expect((await wallet(db, c.id)).available).toBe(10_000 - 2625 - 500);
    await assertLedgerInvariants(db);
  });
});

describe('Доработка и спор', () => {
  it('доработка запоминает пункты, критерии и новый срок; спор только на Pro', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id, { checklist: ['A', 'B'] });
    await db.as(e.id, `select public.take_task($1)`, [task]);
    await db.as(e.id, `select public.submit_work(p_task => $1, p_link => 'https://ex.com/v1', p_stage => 'final', p_included => array['matches_task','files_checked'])`, [task]);
    const sub = (await one(`select id, stage, included from public.submissions where task_id = $1`, [task]));
    expect(sub).toMatchObject({ stage: 'final', included: ['matches_task', 'files_checked'] });
    await db.fails(db.as(c.id, `select public.review_submission($1, 'dispute', '{}', 'Совсем не то, что просили')`, [sub.id]), 'dispute_requires_pro');
    const due = new Date(Date.now() + 3 * 3600_000).toISOString();
    await db.as(
      c.id,
      `select public.review_submission(p_submission => $1, p_decision => 'revision', p_checklist => array[true, false],
         p_comment => 'Пункт B не выполнен, поправьте', p_revision_items => array[2], p_revision_criteria => array['quality'], p_revision_due => $2)`,
      [sub.id, due],
    );
    const s = await one(`select status, revision_items, revision_criteria from public.submissions where id = $1`, [sub.id]);
    expect(s).toEqual({ status: 'revision_requested', revision_items: [2], revision_criteria: ['quality'] });
    const t = await one(`select status, due_at from public.tasks where id = $1`, [task]);
    expect(t.status).toBe('in_progress');
    expect(Math.abs((t.due_at as Date).getTime() - Date.parse(due))).toBeLessThan(1000);
  });
});

describe('Вопросы, жалобы, закладки, пропуск', () => {
  it('вопросы публичны; отвечает заказчик; удалить можно только своё', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const a = await createUser(db);
    const b = await createUser(db);
    const task = await publish(db, c.id);
    await db.fails(db.as(c.id, `select public.ask_question($1, 'Сам себе вопрос')`, [task]), 'own_task');
    const q = (await db.as<{ id: string }>(a.id, `select (public.ask_question($1, 'Какой формат слайдов?')).id`, [task])).rows[0]!.id;
    await db.fails(db.as(b.id, `select public.ask_question($1, 'Чужой ответ', $2)`, [task, q]), 'forbidden');
    await db.as(c.id, `select public.ask_question($1, '16:9', $2)`, [task, q]);
    const rows = await db.as(b.id, `select body, is_customer, parent_id is not null as reply from public.task_questions_for($1)`, [task]);
    expect(rows.rows).toEqual([
      { body: 'Какой формат слайдов?', is_customer: false, reply: false },
      { body: '16:9', is_customer: true, reply: true },
    ]);
    await db.fails(db.as(b.id, `select public.delete_question($1)`, [q]), 'forbidden');
    await db.as(a.id, `select public.delete_question($1)`, [q]);
    const after = await db.as(b.id, `select body, deleted from public.task_questions_for($1) where parent_id is null`, [task]);
    expect(after.rows[0]).toEqual({ body: '', deleted: true });
  });

  it('жалоба анонимна для автора; закладки и пропуск влияют на ленту', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id);
    await db.fails(db.as(c.id, `select public.complain_task($1, 'spam')`, [task]), 'own_task');
    await db.as(e.id, `select public.complain_task($1, 'spam', 'Повтор одной и той же задачи')`, [task]);
    expect((await db.as(c.id, `select * from public.task_complaints`)).rows).toHaveLength(0);

    await db.as(e.id, `insert into public.task_bookmarks (task_id) values ($1)`, [task]);
    const saved = await db.as(e.id, `select id, bookmarked from public.feed_tasks(p_kind => 'online', p_bookmarked => true)`);
    expect(saved.rows).toEqual([{ id: task, bookmarked: true }]);
    await db.as(e.id, `insert into public.task_skips (task_id) values ($1)`, [task]);
    const feed = await db.as(e.id, `select id from public.feed_tasks(p_kind => 'online', p_limit => 50)`);
    expect(feed.rows.map((r) => r.id)).not.toContain(task);
  });
});

describe('Отклики: просмотр и сравнение', () => {
  it('статусы «просмотрен» и «сравнивают», видео-презентация', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id);
    const r = (await db.as<{ id: string }>(e.id, `select (public.submit_response($1, 'Сделаю аккуратно и вовремя, есть опыт.', 2500, '24h', '{}', '{}', 'now', 'https://youtu.be/x')).id`, [task])).rows[0]!.id;
    await db.fails(db.as(e.id, `select public.mark_responses_viewed($1)`, [task]), 'forbidden');
    await db.as(c.id, `select public.mark_responses_viewed($1)`, [task]);
    await db.as(c.id, `select public.set_response_compared($1, true)`, [r]);
    const mine = await db.as(e.id, `select viewed_at is not null as viewed, compared, video_url from public.task_responses where id = $1`, [r]);
    expect(mine.rows[0]).toEqual({ viewed: true, compared: true, video_url: 'https://youtu.be/x' });
    const list = await db.as(c.id, `select compared, match from public.task_responses_for($1)`, [task]);
    expect(list.rows[0].compared).toBe(true);
  });
});

describe('Отзывы', () => {
  it('только после оплаты, один раз, рейтинг пересчитывается; приватный отзыв видит только команда', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const admin = await createUser(db, { role: 'admin' });
    const task = await publish(db, c.id, { checklist: [] });
    await db.as(e.id, `select public.take_task($1)`, [task]);
    await db.fails(db.as(c.id, `select public.leave_review($1, 5)`, [task]), 'invalid_status');
    await db.as(e.id, `select public.submit_work($1, 'https://ex.com/r')`, [task]);
    const sub = (await one(`select id from public.submissions where task_id = $1`, [task])).id;
    await db.as(c.id, `select public.review_submission($1, 'accept', '{}')`, [sub]);
    await db.as(
      c.id,
      `select public.leave_review(p_task => $1, p_rating => 4, p_quality => 5, p_communication => 4, p_deadlines => 3, p_requirements => 4,
         p_public => 'Хорошо и быстро', p_private => 'Немного опоздал', p_skills => array['figma'], p_work_again => true)`,
      [task],
    );
    await db.fails(db.as(c.id, `select public.leave_review($1, 5)`, [task]), 'already_reviewed');
    await db.as(e.id, `select public.leave_review($1, 5, p_public => 'Чёткое ТЗ')`, [task]);
    expect(await one(`select rating_avg::float as r, rating_count as n from public.profiles where id = $1`, [e.id])).toEqual({ r: 4, n: 1 });
    expect(await one(`select rating_avg::float as r, rating_count as n from public.profiles where id = $1`, [c.id])).toEqual({ r: 5, n: 1 });
    expect((await db.as(e.id, `select * from public.review_private`)).rows).toHaveLength(0);
    expect((await db.as(admin.id, `select body from public.review_private`)).rows.map((r) => r.body)).toContain('Немного опоздал');
    const pub = await db.as(null, `select public_text from public.reviews where task_id = $1 order by rating`, [task]);
    expect(pub.rows.map((r) => r.public_text)).toEqual(['Хорошо и быстро', 'Чёткое ТЗ']);
  });
});

describe('Публикация: дополнительные поля', () => {
  it('язык, уровень, доказательства, окно посещения, навыки', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const id = randomUUID();
    await db.as(
      c.id,
      `select public.publish_task(p_id => $1, p_title => 'Проверить витрину', p_brief => 'Фото полки', p_category => 'photo',
         p_result_format => 'photo', p_deadline => '1h', p_kind => 'nearby', p_reward_cents => 800, p_lat => 55.75, p_lng => 37.61,
         p_radius_m => 250, p_extra => '{"language":"ru","required_level":"junior","proofs":["photo","checkin"],"visit_window":"сегодня 18:00–20:00","skills":["photography"]}')`,
      [id],
    );
    expect(await one(`select language, required_level, proofs, visit_window, skills from public.tasks where id = $1`, [id])).toEqual({
      language: 'ru', required_level: 'junior', proofs: ['photo', 'checkin'], visit_window: 'сегодня 18:00–20:00', skills: ['photography'],
    });
  });
});
