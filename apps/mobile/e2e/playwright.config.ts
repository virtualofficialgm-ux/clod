import { defineConfig, devices } from '@playwright/test';

// Мобильное приложение проверяется через веб-экспорт Expo (react-native-web) на ширине телефона.
// Перед запуском: pnpm --filter @parri/mobile export:web и supabase/local/db.sh reset
export default defineConfig({
  testDir: '.',
  outputDir: './test-results',
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:8090',
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  webServer: [
    {
      command: 'pnpm --filter @parri/devstack start',
      url: 'http://127.0.0.1:54321/dev/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    { command: 'node e2e/serve.mjs', url: 'http://127.0.0.1:8090', reuseExistingServer: true, cwd: '..' },
  ],
});
