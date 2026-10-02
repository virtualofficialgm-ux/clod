import { expect, test, type Page } from '@playwright/test';

const SHOTS = process.env.SCREENSHOT_DIR;

async function open(page: Page) {
  await page.goto('/dev/showcase');
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`витрина, ${scheme}`, () => {
    test.use({ colorScheme: scheme });

    test('рендерится без горизонтального скролла', async ({ page }, info) => {
      await open(page);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Витрина');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      if (SHOTS) {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.screenshot({ path: `${SHOTS}/web-${info.project.name}-${scheme}.png`, fullPage: true });
      }
    });

    test('шторка открывается и закрывается по Esc', async ({ page }, info) => {
      await open(page);
      await page.getByRole('button', { name: 'Фильтры' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Фильтры' });
      await expect(dialog).toBeVisible();
      await page.waitForTimeout(600);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/web-${info.project.name}-${scheme}-sheet.png` });
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });

    test('шапка становится стеклянной при скролле', async ({ page }, info) => {
      await open(page);
      const bar = page.locator('header [data-scrolled]');
      await expect(bar).toHaveAttribute('data-scrolled', 'false');
      await page.mouse.wheel(0, 900);
      await expect(bar).toHaveAttribute('data-scrolled', 'true');
      await expect(bar).toHaveClass(/glass/);
      if (SHOTS) {
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SHOTS}/web-${info.project.name}-${scheme}-scrolled.png` });
      }
    });
  });
}

test('«Уменьшить прозрачность» заменяет стекло сплошным фоном', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Уменьшить прозрачность' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-transparency', 'reduce');
  const filter = await page
    .locator('.glass')
    .first()
    .evaluate((el) => getComputedStyle(el).backdropFilter);
  expect(filter).toBe('none');
});
