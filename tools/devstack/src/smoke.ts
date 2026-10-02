// Дымовой тест devstack через настоящий supabase-js: pnpm --filter @parri/devstack smoke
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { ANON_KEY } from './jwt.ts';

const URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
const ok = (cond: unknown, msg: string) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`ok  ${msg}`);
};
const client = () => createClient(URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

// 1. Регистрация с кодом
const sb = client();
const email = `smoke-${randomUUID().slice(0, 8)}@parri.test`;
const signUp = await sb.auth.signUp({ email, password: 'password123', options: { data: { locale: 'ru' } } });
ok(!signUp.error && !signUp.data.session, 'signUp без сессии до подтверждения');
const code = (await (await fetch(`${URL}/dev/otp?email=${email}`)).json()).code as string;
ok(/^\d{6}$/.test(code), 'код из 6 цифр');
const bad = await sb.auth.verifyOtp({ email, token: '000000', type: 'signup' });
ok(bad.error, 'неверный код отклонён');
const verified = await sb.auth.verifyOtp({ email, token: code, type: 'signup' });
ok(verified.data.session, 'код подтверждён, есть сессия');

// 2. Онбординг
const young = await sb.rpc('save_profile', { p_first_name: 'Юный', p_last_name: 'Тест', p_birth_date: '2020-01-01', p_phone: null });
ok(young.error?.message.includes('age_under_14'), 'младше 14 — отказ');
const prof = await sb.rpc('save_profile', { p_first_name: 'Смоук', p_last_name: 'Тест', p_birth_date: '2005-03-03', p_phone: '+79991234567' });
ok(!prof.error && prof.data.onboarding === 'skills', 'шаг профиля');
const skills = await sb.rpc('save_skills', { p_skills: ['figma', 'slides'] });
ok(!skills.error && skills.data.onboarding === 'done', 'шаг навыков');
const me = await sb.from('profiles').select('id,first_name,onboarding').eq('id', verified.data.user!.id).single();
ok(me.data?.first_name === 'Смоук', 'select profile .single()');

// 3. Вход сидового пользователя и лента
const anna = client();
const login = await anna.auth.signInWithPassword({ email: 'anna@parri.test', password: 'parri-demo-123' });
ok(login.data.session, 'вход по паролю');
const wrong = await client().auth.signInWithPassword({ email: 'anna@parri.test', password: 'nope-nope' });
ok(wrong.error, 'неверный пароль отклонён');
const feed = await sb.rpc('feed_tasks', { p_kind: 'online', p_sort: 'highest_pay' });
ok(!feed.error && feed.data.length >= 3, `лента онлайн: ${feed.data?.length} задач`);
const campus = await sb.rpc('feed_tasks', { p_kind: 'campus' });
ok(!campus.error && campus.data.length === 0, 'вузовская лента без вуза пуста');
const wallet = await anna.from('wallets').select('*').single();
ok(wallet.data?.available_cents > 0, 'кошелёк Анны');
const otherWallets = await sb.from('wallets').select('*');
ok(otherWallets.data?.length === 1, 'видит только свой кошелёк');

// 4. Публикация с вложением и деньгами
const taskId = randomUUID();
const annaId = login.data.user!.id;
const path = `${annaId}/${taskId}/brief/spec.txt`;
const up = await anna.storage.from('task-files').upload(path, new Blob(['ТЗ'], { type: 'text/plain' }));
ok(!up.error, 'загрузка в свою папку');
const upForeign = await sb.storage.from('task-files').upload(path.replace(annaId, randomUUID()), new Blob(['x']));
ok(upForeign.error, 'загрузка в чужую папку запрещена');
const pub = await anna.rpc('publish_task', {
  p_id: taskId, p_title: 'Смоук-задача', p_brief: 'Проверка шлюза', p_category: 'design', p_result_format: 'pdf',
  p_deadline: '24h', p_kind: 'online', p_reward_cents: 1000, p_checklist: ['Готово'],
  p_attachments: [{ path, name: 'spec.txt', size: 4, mime: 'text/plain' }],
});
ok(!pub.error && pub.data.status === 'open', 'publish_task');
const detail = await sb.rpc('task_detail', { p_task: taskId });
ok(detail.data?.attachments?.length === 1 && detail.data.viewer_role === 'visitor', 'task_detail');
const signed = await sb.storage.from('task-files').createSignedUrl(path, 60);
ok(signed.data?.signedUrl, 'подписанная ссылка на вложение');
const file = await fetch(signed.data!.signedUrl);
ok((await file.text()) === 'ТЗ', 'файл скачивается');
const resp = await sb.rpc('submit_response', { p_task: taskId, p_cover_letter: 'Сделаю быстро и аккуратно, есть опыт.', p_price_cents: 1000, p_deadline: '24h' });
ok(!resp.error, 'отклик');
const dup = await sb.rpc('submit_response', { p_task: taskId, p_cover_letter: 'Сделаю быстро и аккуратно, есть опыт.', p_price_cents: 1000, p_deadline: '24h' });
ok(dup.error?.code === '23505', 'повторный отклик → 409');
const cancel = await anna.rpc('cancel_task', { p_task: taskId });
ok(!cancel.error && cancel.data.status === 'archived', 'отмена с возвратом');

// 5. Сохранённые поиски (insert/select/delete через REST)
const ins = await sb.from('saved_searches').insert({ name: 'Дизайн', params: { categories: ['design'] } }).select().single();
ok(!ins.error && ins.data.name === 'Дизайн', 'insert .select().single()');
const del = await sb.from('saved_searches').delete().eq('id', ins.data!.id);
ok(!del.error, 'delete');

// 6. ИИ
const ai = await sb.functions.invoke('ai-compose', { body: { title: 'Логотип для клуба', brief: 'Нужны три варианта' } });
ok(!ai.error && typeof ai.data.description === 'string', 'functions.invoke ai-compose');

// 7. Восстановление пароля
await client().auth.resetPasswordForEmail(email);
const rcode = (await (await fetch(`${URL}/dev/otp?email=${email}`)).json()).code as string;
const rec = client();
const rv = await rec.auth.verifyOtp({ email, token: rcode, type: 'recovery' });
ok(rv.data.session, 'код восстановления');
const upd = await rec.auth.updateUser({ password: 'newpassword123' });
ok(!upd.error, 'новый пароль');
const relog = await client().auth.signInWithPassword({ email, password: 'newpassword123' });
ok(relog.data.session, 'вход с новым паролем');

console.log('\nsmoke: всё прошло');
