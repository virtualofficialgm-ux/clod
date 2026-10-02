import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: './tests',
  // Сценарии меняют общую базу — по одному
  workers: 1,
  timeout: 60_000,
  outputDir: './test-results',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 960 } } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: [
    {
      // Локальная замена шлюза Supabase (нужен запущенный Postgres: supabase/local/db.sh reset)
      command: 'pnpm --filter @parri/devstack start',
      url: 'http://127.0.0.1:54321/dev/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `pnpm start --port ${PORT}`,
      url: `http://127.0.0.1:${PORT}`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
