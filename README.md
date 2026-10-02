# Parri

Платформа микро-задач для студентов: веб (Next.js) и мобильное приложение (Expo) с общим бэкендом на Supabase.

## Структура

```
apps/web        Next.js (App Router), Tailwind CSS 4, Framer Motion
apps/mobile     Expo SDK 57, Expo Router, expo-glass-effect (iOS 26) + expo-blur (фолбэк)
packages/ui     дизайн-токены Liquid Glass (TS → CSS-переменные для веба)
packages/shared типы, денежная логика, справочники, тексты локализации (ru)
scripts/        служебные скрипты (скриншоты)
```

## Запуск

```bash
pnpm install
cp .env.example .env          # ключи пока не нужны для витрины
pnpm --filter @parri/web dev  # http://localhost:3000/dev/showcase
pnpm --filter @parri/mobile start
```

Нативный Liquid Glass, push и Apple Pay требуют dev build (`npx expo run:ios` или `eas build --profile development`), в Expo Go их нет.

## Проверки

```bash
pnpm typecheck
pnpm test                                        # юнит-тесты (комиссия, контраст WCAG, токены)
pnpm build
pnpm --filter @parri/web test:e2e                # Playwright, светлая/тёмная тема, 1440px и 390px
```

Скриншоты мобильной витрины через react-native-web:

```bash
pnpm --filter @parri/mobile export:web
python3 -m http.server 8090 -d apps/mobile/dist-web &
node scripts/mobile-screenshots.mjs
```

## Дизайн-токены

Источник правды — `packages/ui/src/tokens.ts`. После изменения выполните `pnpm --filter @parri/ui build`,
чтобы перегенерировать `packages/ui/css/tokens.css` (тест проверяет, что файл актуален).
