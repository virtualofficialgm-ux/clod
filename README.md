# Parri

Платформа микро-задач для студентов: веб (Next.js) и мобильное приложение (Expo) с общим бэкендом на Supabase.

## Структура

```
apps/web          Next.js 16 (App Router), Tailwind CSS 4, Framer Motion
apps/mobile       Expo SDK 57, Expo Router, expo-glass-effect (iOS 26) + expo-blur (фолбэк)
packages/ui       дизайн-токены Liquid Glass (TS → CSS-переменные для веба)
packages/shared   типы, денежная логика, Zod-схемы, API-клиент, хуки React Query, тексты (ru)
supabase/         миграции, RLS, RPC, сиды, Edge Function ai-compose, интеграционные тесты
tools/devstack    локальная замена шлюза Supabase без Docker (только для проверки)
```

## Бэкенд локально

Обычный путь — Supabase CLI с Docker:

```bash
supabase start          # Postgres :54322, API :54321
supabase db reset       # миграции + сиды (вузы мира и демо-данные)
```

Без Docker (так проверялся проект в CI-контейнере): Postgres 16 + PostGIS и dev-шлюз,
который повторяет нужное подмножество Auth, REST/RPC, Storage и Edge Functions поверх настоящих RLS:

```bash
bash supabase/local/db.sh reset           # кластер на :54322, заглушки auth/storage, миграции, сиды
pnpm --filter @parri/devstack start       # http://127.0.0.1:54321, коды из «писем» — в консоли и на /dev/otp
```

Realtime в dev-шлюзе нет: чат автоматически переходит на опрос раз в 4 секунды.

Демо-аккаунты (пароль `parri-demo-123`): `anna@parri.test` (заказчица, $500 на балансе),
`ivan@parri.test` (исполнитель, Pro), `maria@parri.test`, `admin@parri.test`.

## Приложения

```bash
pnpm install
cp .env.example apps/web/.env.local       # для локального бэкенда значения уже подходят
cp .env.example apps/mobile/.env.local
pnpm --filter @parri/web dev              # http://localhost:3000
pnpm --filter @parri/mobile start         # Expo; нативное стекло, push и Apple Pay — только в dev build
```

«Оформить с ИИ» вызывает Edge Function `ai-compose` (Claude). Ключ — только в секретах функций:
`supabase secrets set ANTHROPIC_API_KEY=...`. Без ключа dev-шлюз отдаёт офлайн-черновик.

## Проверки

```bash
pnpm typecheck
pnpm test                                    # юнит-тесты + интеграционные тесты БД (деньги, RLS, хранилище)
pnpm build
pnpm --filter @parri/web test:e2e            # Playwright: 1440 и 390 px, светлая и тёмная темы
pnpm --filter @parri/mobile export:web && pnpm --filter @parri/mobile test:e2e   # мобильное через react-native-web
```

Интеграционные тесты БД ждут базу на `127.0.0.1:54322` (`supabase start` или `supabase/local/db.sh reset`).
Каждый тест идёт в транзакции с откатом, а отложенные проверки выполняются под ролью пользователя — как в PostgREST.

## Деньги

Все суммы — целые центы. Двойная запись: каждая операция — набор проводок с нулевой суммой.
При публикации награда и комиссия 10% (её платит заказчик сверху) уходят с баланса в Сейф задачи;
после приёмки награда целиком уходит исполнителю, комиссия — платформе. Отмена и истечение срока
возвращают всё, включая комиссию. Деньги меняют только security definer функции; у клиента нет прав
на запись в кошельки и журнал. Формула комиссии одна для TS и SQL, тесты сверяют обе.

## Дизайн-токены

Источник правды — `packages/ui/src/tokens.ts`. После изменения: `pnpm --filter @parri/ui build`
(перегенерирует `packages/ui/css/tokens.css`; тест проверяет, что файл актуален).
