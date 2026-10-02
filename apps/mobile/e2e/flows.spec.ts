import { expect, test, type Browser, type Page } from '@playwright/test';

const SHOTS = process.env.SCREENSHOT_DIR;
const DEVSTACK = 'http://127.0.0.1:54321';

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/mobile-${name}.png` });
}

async function otp(email: string) {
  for (let i = 0; i < 20; i++) {
    const { code } = (await (await fetch(`${DEVSTACK}/dev/otp?email=${encodeURIComponent(email)}`)).json()) as { code: string | null };
    if (code) return code;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('no otp');
}

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill('parri-demo-123');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  // После входа — главная; большинство сценариев начинается с ленты
  await expect(page.getByTestId('balance-card')).toBeVisible();
  await page.goto('/feed');
  await expect(page.getByTestId('tabbar')).toBeVisible();
}

async function asUser(browser: Browser, email: string, colorScheme: 'light' | 'dark' = 'light', extra: Parameters<Browser['newContext']>[0] = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme, ...extra });
  const page = await ctx.newPage();
  await login(page, email);
  return { ctx, page };
}

test('приветствие для гостя', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Задачи лентой, как посты')).toBeVisible();
  await expect(page.getByTestId('start-email')).toBeVisible();
  await shot(page, 'welcome');
});

test('регистрация по шагам: email, код, пароль, профиль, навыки, соглашения', async ({ page }) => {
  const email = `m-${Date.now()}@parri.test`;
  await page.goto('/register');
  await page.getByTestId('start-email').click();
  await page.getByLabel('Email').fill(email);
  await page.getByTestId('next').click();
  await expect(page.getByText('Примите условия использования')).toBeVisible();
  // Галочка (не ссылки внутри подписи)
  await page.getByTestId('terms').click({ position: { x: 12, y: 12 } });
  await page.getByTestId('next').click();
  await page.getByRole('textbox', { name: 'Код из письма' }).fill(await otp(email));
  await page.getByTestId('next').click();
  await page.getByLabel('Пароль', { exact: true }).fill('Parri-Demo-2026!');
  await page.getByLabel('Повторите пароль').fill('Parri-Demo-2026!');
  await page.getByTestId('next').click();
  await page.getByLabel('Имя', { exact: true }).fill('Моб');
  await page.getByLabel('Фамилия').fill('Тестов');
  await page.getByTestId('next').click();
  await expect(page.getByText('Где вы находитесь?')).toBeVisible();
  await page.getByTestId('next').click();
  await page.getByRole('radio', { name: 'Переводчик' }).click();
  await page.getByTestId('next').click();
  for (const n of ['Английский', 'Другие языки', 'Корректура', 'Редактура', 'Figma']) await page.getByRole('checkbox', { name: n, exact: true }).first().click();
  await shot(page, 'register-skills');
  await page.getByTestId('next').click();
  await expect(page.getByText('Расскажите о себе')).toBeVisible();
  await page.getByTestId('next').click();
  await page.getByTestId('skip').click();
  await page.getByTestId('agree-terms').click();
  await page.getByTestId('agree-privacy').click();
  await page.getByTestId('next').click();
  await expect(page.getByText('Всё готово!')).toBeVisible();
  await page.getByTestId('to-tasks').click();
  await expect(page.getByTestId('tabbar')).toBeVisible();
});

for (const scheme of ['light', 'dark'] as const) {
  test(`экраны в теме ${scheme}`, async ({ browser }) => {
    const { ctx, page } = await asUser(browser, 'maria@parri.test', scheme);
    await expect(page.getByTestId('feed-list')).toBeVisible();
    await shot(page, `feed-${scheme}`);
    await page.getByRole('button', { name: 'Фильтры' }).click();
    await expect(page.getByTestId('sheet')).toBeVisible();
    await shot(page, `filters-${scheme}`);
    await page.getByRole('button', { name: 'Закрыть' }).first().click();
    await page.getByRole('tab', { name: 'Рядом' }).click();
    await expect(page.getByText('Нужен доступ к геолокации')).toBeVisible();
    await shot(page, `nearby-nogeo-${scheme}`);
    await page.getByRole('tab', { name: 'Онлайн' }).click();
    await page.getByRole('button', { name: /Логотип для студенческого клуба/ }).click();
    await expect(page.getByText('Клуб настольных игр', { exact: false })).toBeVisible();
    await shot(page, `task-${scheme}`);
    await page.goto('/task/new');
    await expect(page.getByText('Бюджет и защита')).toBeVisible();
    await shot(page, `create-${scheme}`);
    await page.goto('/task/b0000000-0000-4000-8000-000000000002/room');
    await expect(page.getByText('Исполнитель выбран. Удачной работы!')).toBeVisible();
    await shot(page, `room-${scheme}`);
    await page.goto('/tasks');
    await expect(page.getByTestId('my-tasks')).toBeVisible();
    await shot(page, `my-tasks-${scheme}`);
    await ctx.close();
  });
}

test('«Рядом» по реальной геолокации', async ({ browser }) => {
  const { ctx, page } = await asUser(browser, 'maria@parri.test', 'light', {
    geolocation: { latitude: 55.758, longitude: 37.66 },
    permissions: ['geolocation'],
  });
  await page.getByRole('tab', { name: 'Рядом' }).click();
  await expect(page.getByText('Проверить наличие кроссовок', { exact: false })).toBeVisible();
  await shot(page, 'nearby');
  await ctx.close();
});

test('полный цикл на мобильном: отклик → выбор → чат → сдача → приёмка', async ({ browser }) => {
  const maria = await asUser(browser, 'maria@parri.test');
  await maria.page.getByRole('button', { name: /Логотип для студенческого клуба/ }).click();
  await maria.page.getByRole('button', { name: 'Откликнуться' }).click();
  await maria.page.getByLabel('Сопроводительное сообщение').fill('Нарисую три варианта логотипа в векторе, есть портфолио.');
  await maria.page.getByLabel('Ваша цена').fill('60');
  await shot(maria.page, 'respond');
  await maria.page.getByRole('button', { name: 'Отправить отклик' }).click();
  await expect(maria.page.getByText(/Ваш отклик: 60/)).toBeVisible();

  const anna = await asUser(browser, 'anna@parri.test');
  await anna.page.goto('/task/b0000000-0000-4000-8000-000000000006/responses');
  await expect(anna.page.getByText('Мария К.')).toBeVisible();
  await shot(anna.page, 'responses');
  const card = anna.page.getByText('Нарисую три варианта', { exact: false });
  await expect(card).toBeVisible();
  // Выбираем Марию (второй отклик после Ивана)
  await anna.page.getByRole('button', { name: 'Выбрать', exact: true }).last().click();
  await anna.page.getByTestId('sheet').getByRole('button', { name: 'Выбрать' }).click();
  await expect(anna.page.getByText('Исполнитель выбран. Удачной работы!')).toBeVisible();
  await anna.page.getByLabel('Сообщение').fill('Жду эскизы!');
  await anna.page.getByRole('button', { name: 'Отправить' }).click();
  await expect(anna.page.getByText('Жду эскизы!')).toBeVisible();

  await maria.page.goto('/task/b0000000-0000-4000-8000-000000000006/room');
  await expect(maria.page.getByText('Жду эскизы!')).toBeVisible();
  await maria.page.getByRole('button', { name: 'Сдать работу' }).click();
  await maria.page.getByLabel('Ссылка на результат').fill('https://example.com/logo.svg');
  await maria.page.getByRole('button', { name: 'Сдать на проверку' }).click();
  await expect(maria.page.getByText('Работа сдана на проверку (версия 1)')).toBeVisible();
  await shot(maria.page, 'room-submitted');

  await anna.page.reload();
  await anna.page.getByRole('button', { name: 'Проверить работу' }).click();
  for (const item of ['3 варианта', 'SVG и PNG']) await anna.page.getByRole('checkbox', { name: item }).click();
  await shot(anna.page, 'review');
  await anna.page.getByRole('button', { name: 'Принять и оплатить' }).click();
  await expect(anna.page.getByText('Работа принята, награда выплачена')).toBeVisible();

  await maria.page.goto('/balance');
  await expect(maria.page.getByText('+60 $').first()).toBeVisible();
  await shot(maria.page, 'balance');
  await anna.ctx.close();
  await maria.ctx.close();
});
