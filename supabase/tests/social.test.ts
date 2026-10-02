import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { assertLedgerInvariants, closePool, createUser, publish, respond, useDb, wallet } from './db';

const db = useDb();
afterAll(closePool);

const one = async <T = Record<string, any>>(sql: string, params: unknown[] = []) => (await db.sys<T & Record<string, any>>(sql, params)).rows[0]!;
const kinds = async (uid: string) =>
  (await db.sys<{ kind: string }>(`select kind from public.notifications where user_id = $1 order by id`, [uid])).rows.map((r) => r.kind);

describe('Подписки и контакты', () => {
  it('подписка уведомляет; контакт требует согласия, встречный запрос = согласие', async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await db.as(a.id, `select public.follow_user($1, true)`, [b.id]);
    await db.as(a.id, `select public.follow_user($1, true)`, [b.id]);
    expect((await one(`select count(*)::int as n from public.follows where followee_id = $1`, [b.id])).n).toBe(1);
    expect(await kinds(b.id)).toEqual(['new_follower']);

    const r = await db.as<{ s: string }>(a.id, `select public.contact_request($1) as s`, [b.id]);
    expect(r.rows[0]!.s).toBe('pending');
    // Свой запрос нельзя принять самому
    await db.fails(db.as(a.id, `select public.contact_respond($1, true)`, [b.id]), 'request_not_found');
    const r2 = await db.as<{ s: string }>(b.id, `select public.contact_request($1) as s`, [a.id]);
    expect(r2.rows[0]!.s).toBe('accepted');
    const list = await db.as<{ id: string }>(a.id, `select id from public.my_connections('contacts')`);
    expect(list.rows.map((x) => x.id)).toEqual([b.id]);
    expect(await kinds(a.id)).toContain('contact_accepted');
  });

  it('приватность «подписываться могут только контакты»', async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await db.as(b.id, `select public.save_privacy('{"who_follow":"contacts"}')`);
    await db.fails(db.as(a.id, `select public.follow_user($1, true)`, [b.id]), 'privacy_forbidden');
    await db.fails(db.as(b.id, `select public.save_privacy('{"who_follow":"nobody"}')`), 'invalid_input');
  });
});

describe('Блокировка', () => {
  it('снимает связи, скрывает профиль и запрещает писать; заблокированный не видит причину', async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await db.as(a.id, `select public.follow_user($1, true)`, [b.id]);
    await db.as(b.id, `select public.block_user($1, true)`, [a.id]);
    expect((await one(`select count(*)::int as n from public.follows where follower_id = $1`, [a.id])).n).toBe(0);
    await db.fails(db.as(a.id, `select public.send_direct($1, 'привет')`, [b.id]), 'privacy_forbidden');
    const p = await db.as<{ p: unknown }>(a.id, `select public.public_profile($1) as p`, [b.id]);
    expect(p.rows[0]!.p).toBeNull();
    const found = await db.as<{ id: string }>(a.id, `select id from public.search_people(p_limit => 100)`);
    expect(found.rows.map((x) => x.id)).not.toContain(b.id);
    const blocked = await db.as<{ id: string }>(b.id, `select id from public.my_blocked()`);
    expect(blocked.rows.map((x) => x.id)).toEqual([a.id]);
    await db.as(b.id, `select public.block_user($1, false)`, [a.id]);
    await db.as(a.id, `select public.send_direct($1, 'привет')`, [b.id]);
  });
});

describe('Личные сообщения и «печатает»', () => {
  it('переписка, непрочитанные, прочтение и статус набора', async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await db.as(a.id, `select public.send_direct($1, 'Привет!')`, [b.id]);
    await db.as(a.id, `select public.send_direct($1, 'Есть задача')`, [b.id]);
    const threads = await db.as<{ peer_id: string; unread: number; last_body: string }>(b.id, `select * from public.my_direct_threads()`);
    expect(threads.rows[0]).toMatchObject({ peer_id: a.id, unread: 2, last_body: 'Есть задача' });
    // Одно уведомление на непрочитанную переписку
    expect((await kinds(b.id)).filter((k) => k === 'direct_message')).toHaveLength(1);
    await db.as(b.id, `select public.set_typing(p_peer => $1)`, [a.id]);
    const st = await db.as<{ s: { typing: boolean; read_at: string | null } }>(a.id, `select public.peer_state(p_peer => $1) as s`, [b.id]);
    expect(st.rows[0]!.s).toMatchObject({ typing: true, read_at: null });
    await db.as(b.id, `select public.mark_direct_read($1)`, [a.id]);
    const st2 = await db.as<{ s: { read_at: string | null } }>(a.id, `select public.peer_state(p_peer => $1) as s`, [b.id]);
    expect(st2.rows[0]!.s.read_at).not.toBeNull();
    // Чужую переписку прочитать нельзя
    const c = await createUser(db);
    expect((await db.as(c.id, `select * from public.direct_with($1)`, [a.id])).rows).toHaveLength(0);
  });

  it('«печатает» в чате задачи видно собеседнику', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id);
    await db.as(e.id, `select public.take_task($1)`, [task]);
    await db.as(e.id, `select public.set_typing(p_task => $1)`, [task]);
    const st = await db.as<{ s: { typing: boolean } }>(c.id, `select public.peer_state(p_task => $1) as s`, [task]);
    expect(st.rows[0]!.s.typing).toBe(true);
    const other = await createUser(db);
    await db.fails(db.as(other.id, `select public.set_typing(p_task => $1)`, [task]), 'forbidden');
  });
});

describe('Уведомления по событиям задачи', () => {
  it('отклик, выбор, сообщение, сдача и подбор по навыкам (Pro раньше)', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const pro = await createUser(db, { plan: 'pro' });
    const free = await createUser(db);
    for (const u of [pro, free]) await db.sys(`insert into public.profile_skills (profile_id, skill_slug) values ($1, 'figma')`, [u.id]);
    const task = randomUUID();
    await db.as(
      c.id,
      `select public.publish_task(p_id => $1, p_title => 'Макет в Figma', p_brief => 'Нужен макет', p_category => 'design',
         p_result_format => 'pdf', p_deadline => '24h', p_kind => 'online', p_reward_cents => 2500, p_checklist => '{}',
         p_extra => '{"skills":["figma"]}')`,
      [task],
    );
    const vis = await db.as<{ id: number }>(pro.id, `select id from public.my_notifications()`);
    expect(vis.rows).toHaveLength(1);
    expect((await db.as(free.id, `select id from public.my_notifications()`)).rows).toHaveLength(0);

    const rid = await respond(db, e.id, task);
    expect(await kinds(c.id)).toEqual(['new_response']);
    await db.as(c.id, `select public.choose_response($1)`, [rid]);
    expect(await kinds(e.id)).toContain('executor_assigned');
    await db.as(c.id, `insert into public.messages (task_id, sender_id, body) values ($1, $2, 'Привет')`, [task, c.id]);
    await db.as(c.id, `insert into public.messages (task_id, sender_id, body) values ($1, $2, 'Ещё')`, [task, c.id]);
    expect((await kinds(e.id)).filter((k) => k === 'new_message')).toHaveLength(1);
    expect((await db.as<{ n: number }>(e.id, `select public.unread_notifications() as n`)).rows[0]!.n).toBe(2);
    await db.as(e.id, `select public.mark_notifications_read()`);
    expect((await db.as<{ n: number }>(e.id, `select public.unread_notifications() as n`)).rows[0]!.n).toBe(0);
    await db.as(e.id, `select public.clear_notifications()`);
    expect(await kinds(e.id)).toEqual([]);
  });
});

describe('Приглашение в задачу', () => {
  it('закрепляет задачу только после согласия исполнителя', async () => {
    const c = await createUser(db, { balance: 10_000 });
    const e = await createUser(db);
    const task = await publish(db, c.id);
    await db.fails(db.as(e.id, `select public.invite_to_task($1, $2, 'x', 3)`, [task, c.id]), 'forbidden');
    await db.fails(db.as(c.id, `select public.invite_to_task($1, $2, 'x', 2)`, [task, e.id]), 'invalid_input');
    const inv = await db.as<{ id: string }>(c.id, `select (public.invite_to_task($1, $2, 'Посмотрите', 3)).id`, [task, e.id]);
    await db.fails(db.as(c.id, `select public.invite_to_task($1, $2, 'ещё', 3)`, [task, e.id]), 'already_invited');
    expect((await one(`select status from public.tasks where id = $1`, [task])).status).toBe('open');
    const mine = await db.as<{ incoming: boolean; status: string }>(e.id, `select incoming, status from public.my_invitations()`);
    expect(mine.rows[0]).toMatchObject({ incoming: true, status: 'pending' });
    await db.as(e.id, `select public.respond_invitation($1, true)`, [inv.rows[0]!.id]);
    const t = await one(`select status, executor_id from public.tasks where id = $1`, [task]);
    expect(t).toMatchObject({ status: 'in_progress', executor_id: e.id });
    await assertLedgerInvariants(db);
  });
});

describe('Деактивация и удаление', () => {
  it('деактивация скрывает профиль, вход только для восстановления; удаление требует пустого баланса', async () => {
    const a = await createUser(db, { balance: 1_000 });
    const b = await createUser(db);
    await db.fails(db.as(a.id, `select public.deactivate_account('перерыв', 'неверно')`), 'confirm_word');
    const task = await publish(db, a.id, { reward: 500 });
    await db.as(a.id, `select public.deactivate_account('перерыв', 'ДЕАКТИВАЦИЯ')`);
    // Открытая задача снята, деньги вернулись из Сейфа
    expect((await one(`select status from public.tasks where id = $1`, [task])).status).toBe('archived');
    expect((await wallet(db, a.id)).available).toBe(1_000);
    expect((await db.as<{ p: unknown }>(b.id, `select public.public_profile($1) as p`, [a.id])).rows[0]!.p).toBeNull();
    await db.fails(db.as(a.id, `select public.follow_user($1, true)`, [b.id]), 'account_deactivated');
    await db.as(a.id, `select public.restore_account()`);
    await db.as(a.id, `select public.follow_user($1, true)`, [b.id]);

    await db.fails(db.as(a.id, `select public.delete_account('другое', 'УДАЛЕНИЕ')`), 'has_balance');
    await db.as(b.id, `select public.delete_account('другое', 'УДАЛЕНИЕ')`);
    const gone = await one(`select first_name, deleted_at is not null as d from public.profiles where id = $1`, [b.id]);
    expect(gone).toMatchObject({ first_name: null, d: true });
    expect((await one(`select count(*)::int as n from public.follows where followee_id = $1`, [b.id])).n).toBe(0);
    await assertLedgerInvariants(db);
  });
});

describe('Публичный профиль и поиск', () => {
  it('скрывает город и портфолио по настройкам; поиск по навыку и рейтингу', async () => {
    const a = await createUser(db);
    const v = await createUser(db);
    await db.sys(`update public.profiles set city = 'Казань', username = $2, headline = 'Дизайнер' where id = $1`, [a.id, `u${a.id.slice(0, 6)}`]);
    await db.sys(`insert into public.profile_skills (profile_id, skill_slug) values ($1, 'figma')`, [a.id]);
    const p = await db.as<{ p: any }>(v.id, `select public.public_profile($1) as p`, [`u${a.id.slice(0, 6)}`]);
    expect(p.rows[0]!.p).toMatchObject({ city: 'Казань', relation: { self: false, contact: 'none', can_message: true } });
    expect(p.rows[0]!.p.privacy).toBeUndefined();
    await db.as(a.id, `select public.save_privacy('{"city":"me","who_message":"contacts"}')`);
    const p2 = await db.as<{ p: any }>(v.id, `select public.public_profile($1) as p`, [a.id]);
    expect(p2.rows[0]!.p.city).toBeNull();
    expect(p2.rows[0]!.p.relation.can_message).toBe(false);
    await db.fails(db.as(v.id, `select public.send_direct($1, 'привет')`, [a.id]), 'privacy_forbidden');

    const s = await db.as<{ id: string }>(v.id, `select id from public.search_people(p_query => 'Дизайнер', p_skill => 'figma', p_limit => 100)`);
    expect(s.rows.map((x) => x.id)).toContain(a.id);
    const s2 = await db.as<{ id: string }>(v.id, `select id from public.search_people(p_skill => 'figma', p_min_rating => 4.5, p_limit => 100)`);
    expect(s2.rows.map((x) => x.id)).not.toContain(a.id);
  });
});
