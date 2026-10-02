-- Демо-данные для локальной проверки. Пароль у всех: parri-demo-123
--   anna@parri.test  — заказчица (МГУ), баланс $500
--   ivan@parri.test  — исполнитель (МГУ), Pro
--   maria@parri.test — исполнительница (ВШЭ)
--   admin@parri.test — администратор
-- Задачи создаются через настоящие RPC, поэтому деньги проходят через Сейф по тем же правилам.

create or replace function pg_temp.mk_user(p_id uuid, p_email text) returns void
language sql as $$
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    extensions.crypt('parri-demo-123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{"locale":"ru"}', now(), now(), '', '', '', ''
  );
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (p_id::text, p_id, jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
          'email', now(), now(), now());
$$;

create or replace function pg_temp.as_user(p_id uuid) returns void
language sql as $$
  select set_config('request.jwt.claims', jsonb_build_object('sub', p_id, 'role', 'authenticated')::text, false);
$$;

select pg_temp.mk_user('a0000000-0000-4000-8000-000000000001', 'anna@parri.test');
select pg_temp.mk_user('a0000000-0000-4000-8000-000000000002', 'ivan@parri.test');
select pg_temp.mk_user('a0000000-0000-4000-8000-000000000003', 'maria@parri.test');
select pg_temp.mk_user('a0000000-0000-4000-8000-000000000004', 'admin@parri.test');

update public.profiles p set
  first_name = v.first_name, last_name = v.last_name, bio = v.bio, onboarding = 'done',
  university_id = (select id from public.universities where name = v.uni and country_code = 'RU'),
  plan = v.plan::public.plan_id, role = v.role::public.user_role
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'Анна', 'Смирнова', 'Учусь на дизайне, часто нужны быстрые руки.', 'Lomonosov Moscow State University', 'free', 'user'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'Иван', 'Петров', 'Фронтенд и презентации. Делаю быстро и аккуратно.', 'Lomonosov Moscow State University', 'pro', 'user'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'Мария', 'Ким', 'Переводы EN/RU, фото, тексты.', 'Higher School of Economics', 'free', 'user'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'Админ', 'Parri', null, null, 'free', 'admin')
) as v(id, first_name, last_name, bio, uni, plan, role)
where p.id = v.id;

update public.profile_private set birth_date = date '2004-05-14', phone = '+79990000001'
 where id = 'a0000000-0000-4000-8000-000000000001';
update public.profile_private set birth_date = date '2003-11-02', phone = '+79990000002'
 where id = 'a0000000-0000-4000-8000-000000000002';
update public.profile_private set birth_date = date '2008-02-20', phone = '+79990000003'
 where id = 'a0000000-0000-4000-8000-000000000003';
update public.profile_private set birth_date = date '1995-01-01'
 where id = 'a0000000-0000-4000-8000-000000000004';

insert into public.profile_skills (profile_id, skill_slug) values
  ('a0000000-0000-4000-8000-000000000001', 'figma'),
  ('a0000000-0000-4000-8000-000000000002', 'frontend'),
  ('a0000000-0000-4000-8000-000000000002', 'slides'),
  ('a0000000-0000-4000-8000-000000000002', 'pitch_decks'),
  ('a0000000-0000-4000-8000-000000000003', 'translation_en'),
  ('a0000000-0000-4000-8000-000000000003', 'photography'),
  ('a0000000-0000-4000-8000-000000000003', 'copywriting');

select public.dev_credit('a0000000-0000-4000-8000-000000000001', 50000, 'demo balance');
select public.dev_credit('a0000000-0000-4000-8000-000000000002', 5000, 'demo balance');
select public.dev_credit('a0000000-0000-4000-8000-000000000003', 3000, 'demo balance');

-- ---------- Задачи Анны ----------
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');

select public.publish_task('b0000000-0000-4000-8000-000000000001', 'Сверстать 6 слайдов для защиты курсовой',
  'Есть текст и структура, нужен аккуратный минималистичный дизайн в PowerPoint.', 'presentations', 'pptx', '24h', 'online', 2500,
  null, array['6 слайдов', 'Шрифты встроены', 'Исходник PPTX']);
select public.publish_task('b0000000-0000-4000-8000-000000000002', 'Перевести резюме на английский',
  'Одна страница, деловой стиль. Нужен вычитанный текст без машинного перевода.', 'translation', 'text', '24h', 'online', 4000,
  null, array['Без ошибок', 'Сохранено форматирование']);
select public.publish_task('b0000000-0000-4000-8000-000000000003', 'Проверить наличие кроссовок в ТЦ «Атриум»',
  'Зайти в магазин на 2 этаже, найти модель по фото, сфотографировать ценник и размерный ряд.', 'photo', 'photo', '1h', 'nearby', 800,
  null, array['Фото ценника', 'Фото полки с размерами'], 55.7575, 37.6590, 250, 'ТЦ «Атриум», Земляной Вал, 33');
select public.publish_task('b0000000-0000-4000-8000-000000000004', 'Сфотографировать расписание в главном здании',
  'Нужна чёткая фотография стенда с расписанием на 3 этаже, сектор Б.', 'photo', 'photo', '1h', 'nearby', 500,
  null, '{}', 55.7033, 37.5302, 100, 'МГУ, Главное здание');
select public.publish_task('b0000000-0000-4000-8000-000000000005', 'Конспект лекции по матанализу',
  'Лекция 12 сентября, поток 2. Нужен аккуратный конспект в PDF.', 'study', 'pdf', '3d', 'campus', 1500,
  null, array['Все темы лекции', 'Читаемый почерк или набор']);
select public.publish_task('b0000000-0000-4000-8000-000000000006', 'Логотип для студенческого клуба',
  'Клуб настольных игр. Нужны 2–3 варианта логотипа в векторе.', 'design', 'jpg', '3d', 'online', 6000,
  null, array['3 варианта', 'SVG и PNG']);
select public.publish_task('b0000000-0000-4000-8000-000000000007', 'Собрать таблицу цен конкурентов',
  '20 магазинов, цены на 5 позиций, Google Sheets.', 'data', 'text', '24h', 'online', 3000,
  null, array['20 магазинов', 'Ссылки на источники']);

-- ---------- Отклики ----------
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select public.submit_response('b0000000-0000-4000-8000-000000000001',
  'Делаю презентации для защиты уже два года, могу показать примеры. Сделаю сегодня.', 2500, '24h',
  array['slides'], array['https://example.com/ivan-portfolio'], 'now');
select public.submit_response('b0000000-0000-4000-8000-000000000006',
  'Нарисую три разных направления: шрифтовое, знак и маскот. Исходники отдам в SVG.', 7000, '3d',
  array['figma', 'logo'], '{}', 'today');
select public.submit_response('b0000000-0000-4000-8000-000000000007',
  'Соберу таблицу с формулами сравнения и ссылками на каждый источник.', 3000, '24h',
  array['excel'], '{}', 'now');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
select public.submit_response('b0000000-0000-4000-8000-000000000001',
  'Сделаю чистый минималистичный дизайн, есть опыт с академическими презентациями.', 2200, '24h',
  array['slides'], '{}', 'in_1h');
select public.submit_response('b0000000-0000-4000-8000-000000000002',
  'Переводчик EN/RU, C1. Переведу и вычитаю, сохраню вёрстку резюме.', 4000, '24h',
  array['translation_en'], array['https://example.com/maria'], 'now');

-- Анна выбирает исполнителей: задача 2 — в работе, задача 7 — дойдёт до приёмки
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select public.choose_response((select id from public.task_responses
  where task_id = 'b0000000-0000-4000-8000-000000000002' and executor_id = 'a0000000-0000-4000-8000-000000000003'));
select public.choose_response((select id from public.task_responses
  where task_id = 'b0000000-0000-4000-8000-000000000007' and executor_id = 'a0000000-0000-4000-8000-000000000002'));

-- Иван сдаёт таблицу, задача уходит на проверку
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
insert into public.messages (task_id, sender_id, body) values
  ('b0000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000002', 'Привет! Начинаю, к вечеру пришлю.');
select public.submit_work('b0000000-0000-4000-8000-000000000007', 'https://docs.google.com/spreadsheets/d/demo',
  'Готово: 20 магазинов, на втором листе сравнение.', '[]');

-- ---------- Задачи Ивана (для вкладки «Мои задачи» у Ивана и ленты у Анны) ----------
select public.publish_task('b0000000-0000-4000-8000-000000000008', 'Нарезать reels из лекции',
  'Видео 40 минут, нужно 3 ролика по 30 секунд с субтитрами.', 'video', 'text', '3d', 'online', 4500,
  null, array['3 ролика', 'Субтитры']);

select set_config('request.jwt.claims', '', false);
