import { expect, type Browser, type Page } from '@playwright/test';

export const SHOTS = process.env.SCREENSHOT_DIR;
export const DEVSTACK = process.env.DEVSTACK_URL ?? 'http://127.0.0.1:54321';
export const PASSWORD = 'parri-demo-123';

export async function hydrated(page: Page) {
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

export async function lastOtp(email: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${DEVSTACK}/dev/otp?email=${encodeURIComponent(email)}`);
    const { code } = (await res.json()) as { code: string | null };
    if (code) return code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no otp for ${email}`);
}

export async function fillOtp(page: Page, code: string) {
  await page.getByRole('textbox', { name: /цифра 1/ }).fill(code[0]!);
  for (let i = 1; i < 6; i++) await page.getByRole('textbox', { name: new RegExp(`цифра ${i + 1}`) }).fill(code[i]!);
}

export async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login');
  await hydrated(page);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Привет');
  // Большинство сценариев начинается с ленты
  await page.goto('/feed');
  await hydrated(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Лента');
}

export async function asUser(browser: Browser, email: string, opts: { colorScheme?: 'light' | 'dark' } = {}) {
  const ctx = await browser.newContext({ colorScheme: opts.colorScheme ?? 'light' });
  const page = await ctx.newPage();
  await login(page, email);
  return { ctx, page };
}

export async function shot(page: Page, name: string, fullPage = false) {
  if (!SHOTS) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
}

export async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
