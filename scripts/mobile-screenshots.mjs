// Скриншоты мобильной витрины через react-native-web (экспорт Expo).
// 1) pnpm --filter @parri/mobile export:web  2) python3 -m http.server 8090 -d apps/mobile/dist-web
// 3) node scripts/mobile-screenshots.mjs
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const OUT = process.env.SCREENSHOT_DIR ?? 'screenshots';
const APP_URL = process.env.MOBILE_WEB_URL ?? 'http://127.0.0.1:8090/';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch(process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {});
for (const scheme of ['light', 'dark']) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, reducedMotion: 'reduce', deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(APP_URL);
  await p.getByText('Стекло, типографика').first().waitFor();
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/mobile-${scheme}-top.png` });
  await p.mouse.move(195, 500);
  await p.mouse.wheel(0, 1500);
  await p.waitForTimeout(1200);
  const glass = await p.getByTestId('header-glass').count();
  await p.screenshot({ path: `${OUT}/mobile-${scheme}-scrolled.png` });
  await p.getByRole('button', { name: 'Фильтры' }).first().click();
  await p.waitForTimeout(1200);
  const sheet = await p.getByTestId('sheet').count();
  await p.screenshot({ path: `${OUT}/mobile-${scheme}-sheet.png` });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(scheme, { headerGlass: glass, sheet, overflow, errors });
  if (!glass || !sheet || overflow > 0 || errors.length) process.exitCode = 1;
  await ctx.close();
}
await b.close();
