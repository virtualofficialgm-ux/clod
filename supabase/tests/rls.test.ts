import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { closePool, createUser, publish, respond, useDb } from './db';

const db = useDb();
afterAll(closePool);

describe('онбординг и профиль', () => {
  it('регистрация создаёт профиль, приватные данные и кошелёк', async () => {
    const id = randomUUID();
    await db.sys(`insert into auth.users (id, email) values ($1, $2)`, [id, `${id}@t.local`]);
    const r = await db.sys(
      `select p.onboarding, pp.locale, w.available_cents from public.profiles p
         join public.profile_private pp on pp.id = p.id join public.wallets w on w.user_id = p.id where p.id = $1`,
      [id],
    );
    expect(r.rows[0]).toEqual({ onboarding: 'profile', locale: 'ru', available_cents: '0' });
  });

  it('возраст: младше 14 — отказ, ровно 14 — можно', async () => {
    const u = await createUser(db, { onboarded: false });
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const exactly14 = new Date(Date.UTC(today.getUTCFullYear() - 14, today.getUTCMonth(), today.getUTCDate()));
    const almost14 = new Date(exactly14.getTime() + 86_400_000);
    await db.fails(
      db.as(u.id, `select public.save_profile('Аня', 'Ли', $1::date, '+79990001122')`, [fmt(almost14)]),
      'age_under_14',
    );
    await db.as(u.id, `select public.save_profile('Аня', 'Ли', $1::date, '+79990001122')`, [fmt(exactly14)]);
    const p = await db.sys(`select onboarding from public.profiles where id = $1`, [u.id]);
    expect(p.rows[0].onboarding).toBe('skills');
  });

  it('шаг навыков завершает онбординг', async () => {
    const u = await createUser(db, { onboarded: false });
    await db.fails(db.as(u.id, `select public.save_skills(array['figma'])`), 'profile_step_required');
    await db.as(u.id, `select public.save_profile('Аня', 'Ли', '2005-01-01', null)`);
    await db.as(u.id, `select public.save_skills(array['figma', 'slides'])`);
    const p = await db.sys(`select onboarding from public.profiles where id = $1`, [u.id]);
    expect(p.rows[0].onboarding).toBe('done');
    const s = await db.as(u.id, `select skill_slug from public.profile_skills where profile_id = $1 order by 1`, [u.id]);
    expect(s.rows.map((r) => r.skill_slug)).toEqual(['figma', 'slides']);
  });

  it('дату рождения, телефон и язык видит только владелец', async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const own = await db.as(a.id, `select birth_date from public.profile_private`);
    expect(own.rows).toHaveLength(1);
    const other = await db.as(b.id, `select * from public.profile_private where id = $1`, [a.id]);
    expect(other.rows).toHaveLength(0);
    const anon = db.as(null, `select * from public.profile_private`);
    await db.fails(anon, 'permission denied');
  });

  it('роль, план, статистику и дату рождения нельзя поменять напрямую', async () => {
    const u = await createUser(db);
    await db.fails(db.as(u.id, `update public.profiles set role = 'admin' where id = $1`, [u.id]), 'permission denied');
    await db.fails(db.as(u.id, `update public.profiles set plan = 'pro' where id = $1`, [u.id]), 'permission denied');
    await db.fails(db.as(u.id, `update public.profiles set earned_cents = 1 where id = $1`, [u.id]), 'permission denied');
    await db.fails(
      db.as(u.id, `update public.profile_private set birth_date = '2020-01-01' where id = $1`, [u.id]),
      'permission denied',
    );
    await db.as(u.id, `update public.profiles set bio = 'Привет' where id = $1`, [u.id]);
  });

  it('чужой профиль изменить нельзя (RLS молча ничего не обновляет)', async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const r = await db.as(b.id, `update public.profiles set bio = 'взлом' where id = $1`, [a.id]);
    expect(r.rowCount).toBe(0);
  });
});

describe('видимость задач', () => {
  it('гость не видит задачи, вошедший видит открытые', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const v = await createUser(db);
    const task = await publish(db, c.id);
    await db.fails(db.as(null, `select * from public.tasks`), 'permission denied');
    const r = await db.as(v.id, `select id from public.tasks where id = $1`, [task]);
    expect(r.rows).toHaveLength(1);
  });

  it('задачи «В моём вузе» видят только студенты того же вуза', async () => {
    const c = await createUser(db, { balance: 10_000, university: 'Lomonosov Moscow State University' });
    const same = await createUser(db, { university: 'Lomonosov Moscow State University' });
    const other = await createUser(db, { university: 'Higher School of Economics' });
    const task = await publish(db, c.id, { kind: 'campus' });
    expect((await db.as(same.id, `select id from public.tasks where id = $1`, [task])).rows).toHaveLength(1);
    expect((await db.as(other.id, `select id from public.tasks where id = $1`, [task])).rows).toHaveLength(0);
    const feed = await db.as(other.id, `select id from public.feed_tasks(p_kind => 'campus')`);
    expect(feed.rows.map((r) => r.id)).not.toContain(task);
    await db.fails(db.as(other.id, `select public.submit_response($1, 'Хочу помочь с этим заданием, сделаю быстро.', 1500, '24h')`, [task]), 'forbidden');
  });

  it('без вуза нельзя опубликовать вузовскую задачу', async () => {
    const c = await createUser(db, { balance: 10_000, university: null });
    await db.fails(publish(db, c.id, { kind: 'campus' }), 'university_required');
  });

  it('задача в работе видна только участникам', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const stranger = await createUser(db);
    const task = await publish(db, c.id);
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, e.id, task)]);
    expect((await db.as(stranger.id, `select id from public.tasks where id = $1`, [task])).rows).toHaveLength(0);
    expect((await db.as(e.id, `select id from public.tasks where id = $1`, [task])).rows).toHaveLength(1);
  });

  it('лента «Рядом» без геолокации пуста (никаких фейковых точек)', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const v = await createUser(db);
    await publish(db, c.id, { kind: 'nearby' });
    const none = await db.as(v.id, `select id from public.feed_tasks(p_kind => 'nearby')`);
    expect(none.rows).toHaveLength(0);
    const near = await db.as<{ distance_m: number }>(
      v.id,
      `select distance_m from public.feed_tasks(p_kind => 'nearby', p_lat => 55.751, p_lng => 37.61, p_max_distance_m => 5000)`,
    );
    expect(near.rows.length).toBeGreaterThanOrEqual(1);
    expect(near.rows[0]!.distance_m).toBeLessThan(5000);
  });

  it('лента не показывает свои задачи, фильтрует по поиску, оплате и сортирует', async () => {
    const c = await createUser(db, { balance: 100_000 });
    const v = await createUser(db);
    const cheap = await publish(db, c.id, { reward: 500 });
    const rich = await publish(db, c.id, { reward: 9000 });
    const own = await db.as(c.id, `select id from public.feed_tasks() where id = any($1)`, [[cheap, rich]]);
    expect(own.rows).toHaveLength(0);
    const sorted = await db.as(v.id, `select id from public.feed_tasks(p_sort => 'highest_pay', p_limit => 50) where id = any($1)`, [[cheap, rich]]);
    expect(sorted.rows.map((r) => r.id)).toEqual([rich, cheap]);
    const min = await db.as(v.id, `select id from public.feed_tasks(p_min_reward => 1000, p_limit => 50) where id = any($1)`, [[cheap, rich]]);
    expect(min.rows.map((r) => r.id)).toEqual([rich]);
    const q = await db.as(v.id, `select id from public.feed_tasks(p_query => 'тестовая', p_limit => 50) where id = any($1)`, [[cheap, rich]]);
    expect(q.rows).toHaveLength(2);
  });
});

describe('отклики', () => {
  it('нельзя откликнуться на свою задачу; сопроводительное от 20 символов', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id);
    await db.fails(respond(db, c.id, task), 'own_task');
    await db.fails(db.as(e.id, `select public.submit_response($1, 'коротко', 2500, '24h')`, [task]), 'check constraint');
  });

  it('отклик видят автор и заказчик, другие кандидаты — нет', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e1 = await createUser(db);
    const e2 = await createUser(db);
    const task = await publish(db, c.id);
    await respond(db, e1.id, task);
    await respond(db, e2.id, task);
    expect((await db.as(c.id, `select * from public.task_responses_for($1)`, [task])).rows).toHaveLength(2);
    expect((await db.as(e1.id, `select id from public.task_responses where task_id = $1`, [task])).rows).toHaveLength(1);
    expect((await db.as(e1.id, `select * from public.task_responses_for($1)`, [task])).rows).toHaveLength(0);
  });

  it('отклик можно редактировать и отозвать, пока заказчик не решил', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const other = await createUser(db);
    const task = await publish(db, c.id);
    const r = await respond(db, e.id, task);
    await db.as(e.id, `select public.update_response($1, 'Обновлённое сопроводительное письмо, подробнее.', 2400, '1h')`, [r]);
    await db.fails(db.as(other.id, `select public.withdraw_response($1)`, [r]), 'forbidden');
    await db.as(e.id, `select public.withdraw_response($1)`, [r]);
    let t = await db.sys(`select response_count from public.tasks where id = $1`, [task]);
    expect(t.rows[0].response_count).toBe(0);
    // Повторный отклик после отзыва
    await respond(db, e.id, task);
    t = await db.sys(`select response_count from public.tasks where id = $1`, [task]);
    expect(t.rows[0].response_count).toBe(1);
    await db.as(c.id, `select public.choose_response($1)`, [r]);
    await db.fails(db.as(e.id, `select public.withdraw_response($1)`, [r]), 'response_locked');
  });

  it('выбрать исполнителя может только заказчик, остальные отклики отклоняются', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e1 = await createUser(db);
    const e2 = await createUser(db);
    const task = await publish(db, c.id);
    const r1 = await respond(db, e1.id, task);
    const r2 = await respond(db, e2.id, task);
    await db.fails(db.as(e2.id, `select public.choose_response($1)`, [r2]), 'forbidden');
    await db.as(c.id, `select public.choose_response($1)`, [r1]);
    const s = await db.sys(`select status from public.task_responses where id = $1`, [r2]);
    expect(s.rows[0].status).toBe('rejected');
  });
});

describe('рабочая комната', () => {
  async function room() {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const stranger = await createUser(db);
    const task = await publish(db, c.id);
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, e.id, task)]);
    return { c, e, stranger, task };
  }

  it('участники пишут и читают, посторонний — нет', async () => {
    const { c, e, stranger, task } = await room();
    await db.as(e.id, `insert into public.messages (task_id, sender_id, body) values ($1, $2, 'Привет')`, [task, e.id]);
    await db.as(c.id, `insert into public.messages (task_id, sender_id, body) values ($1, $2, 'Здравствуйте')`, [task, c.id]);
    const msgs = await db.as(c.id, `select kind, body from public.messages where task_id = $1 order by created_at`, [task]);
    expect(msgs.rows.map((m) => m.kind)).toEqual(['system', 'text', 'text']);
    expect((await db.as(stranger.id, `select * from public.messages where task_id = $1`, [task])).rows).toHaveLength(0);
    await db.fails(
      db.as(stranger.id, `insert into public.messages (task_id, sender_id, body) values ($1, $2, 'спам')`, [task, stranger.id]),
      'row-level security',
    );
  });

  it('нельзя писать от чужого имени и подделывать системные сообщения', async () => {
    const { c, e, task } = await room();
    await db.fails(
      db.as(e.id, `insert into public.messages (task_id, sender_id, body) values ($1, $2, 'я заказчик')`, [task, c.id]),
      'row-level security',
    );
    await db.fails(
      db.as(e.id, `insert into public.messages (task_id, sender_id, kind, body) values ($1, $2, 'system', 'work_accepted')`, [task, e.id]),
      'row-level security',
    );
    await db.fails(db.as(e.id, `update public.messages set body = 'x' where task_id = $1`, [task]), 'permission denied');
  });

  it('сдать работу может только исполнитель, принять — только заказчик', async () => {
    const { c, e, stranger, task } = await room();
    await db.fails(db.as(c.id, `select public.submit_work($1, 'https://example.com')`, [task]), 'forbidden');
    await db.fails(db.as(e.id, `select public.submit_work($1, null, '  ', '[]')`, [task]), 'empty_submission');
    await db.as(e.id, `select public.submit_work($1, 'https://example.com')`, [task]);
    const sub = (await db.sys<{ id: string }>(`select id from public.submissions where task_id = $1`, [task])).rows[0]!.id;
    await db.fails(db.as(e.id, `select public.review_submission($1, 'accept', array[true,true])`, [sub]), 'forbidden');
    await db.fails(db.as(stranger.id, `select public.review_submission($1, 'accept', array[true,true])`, [sub]), 'forbidden');
  });

  it('файлы сдачи принимаются только из своей папки задачи', async () => {
    const { e, c, task } = await room();
    const foreign = JSON.stringify([{ path: `${c.id}/${task}/submission/x.pdf`, name: 'x.pdf', size: 10, mime: 'application/pdf' }]);
    await db.fails(db.as(e.id, `select public.submit_work($1, null, null, $2::jsonb)`, [task, foreign]), 'invalid_files');
    const own = JSON.stringify([{ path: `${e.id}/${task}/submission/x.pdf`, name: 'x.pdf', size: 10, mime: 'application/pdf' }]);
    await db.as(e.id, `select public.submit_work($1, null, null, $2::jsonb)`, [task, own]);
  });

  it('task_detail отдаёт роль зрителя и скрывает невидимые задачи', async () => {
    const { c, e, stranger, task } = await room();
    const asC = await db.as(c.id, `select public.task_detail($1) as d`, [task]);
    expect(asC.rows[0].d.viewer_role).toBe('customer');
    const asE = await db.as(e.id, `select public.task_detail($1) as d`, [task]);
    expect(asE.rows[0].d.viewer_role).toBe('executor');
    const asS = await db.as(stranger.id, `select public.task_detail($1) as d`, [task]);
    expect(asS.rows[0].d).toBeNull();
  });
});

describe('хранилище', () => {
  it('загрузка только в свою папку, чат-файлы видят только участники', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const stranger = await createUser(db);
    const task = await publish(db, c.id);
    await db.as(c.id, `select public.choose_response($1)`, [await respond(db, e.id, task)]);

    const path = `${e.id}/${task}/chat/a.png`;
    await db.as(e.id, `insert into storage.objects (bucket_id, name) values ('task-files', $1)`, [path]);
    await db.fails(
      db.as(stranger.id, `insert into storage.objects (bucket_id, name) values ('task-files', $1)`, [`${e.id}/${task}/chat/b.png`]),
      'row-level security',
    );
    expect((await db.as(c.id, `select name from storage.objects where name = $1`, [path])).rows).toHaveLength(1);
    expect((await db.as(stranger.id, `select name from storage.objects where name = $1`, [path])).rows).toHaveLength(0);
  });

  it('вложения задачи видят все, кому видна задача', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const v = await createUser(db);
    const task = await publish(db, c.id);
    const path = `${c.id}/${task}/brief/spec.pdf`;
    await db.as(c.id, `insert into storage.objects (bucket_id, name) values ('task-files', $1)`, [path]);
    expect((await db.as(v.id, `select name from storage.objects where name = $1`, [path])).rows).toHaveLength(1);
    expect((await db.as(null, `select name from storage.objects where name = $1`, [path])).rows).toHaveLength(0);
  });
});

describe('сохранённые поиски', () => {
  it('видны и изменяемы только владельцем', async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await db.as(a.id, `insert into public.saved_searches (name, params) values ('Дизайн', '{"categories":["design"]}')`);
    expect((await db.as(a.id, `select * from public.saved_searches`)).rows).toHaveLength(1);
    expect((await db.as(b.id, `select * from public.saved_searches`)).rows).toHaveLength(0);
    await db.fails(
      db.as(b.id, `insert into public.saved_searches (user_id, name, params) values ($1, 'x', '{}')`, [a.id]),
      'row-level security',
    );
  });
});
