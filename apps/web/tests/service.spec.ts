import { expect, test } from '@playwright/test';
import { asUser, hydrated, shot } from './helpers';

test.describe.configure({ mode: 'serial' });

test('поддержка: база знаний, обращение, ответ команды', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'один раз');
  const maria = await asUser(browser, 'maria@parri.test');
  await maria.page.goto('/support');
  await hydrated(maria.page);
  await maria.page.getByRole('searchbox', { name: 'Поиск по вопросам' }).fill('Сейф');
  await maria.page.getByRole('button', { name: 'Что такое Сейф?' }).click();
  await expect(maria.page.getByTestId('kb')).toContainText('резервируются');
  await maria.page.getByRole('radio', { name: 'Оплата' }).or(maria.page.getByRole('button', { name: 'Оплата', exact: true })).first().click();
  await maria.page.getByLabel('Тема').fill('Не пришло пополнение');
  await maria.page.getByLabel('Описание').fill('Оплатила картой, баланс не изменился');
  await maria.page.getByRole('button', { name: 'Отправить обращение' }).click();
  await maria.page.waitForURL(/\/support\/[0-9a-f-]{36}$/);
  const ticketUrl = maria.page.url();
  await expect(maria.page.getByTestId('ticket-status')).toHaveText('Открыто');
  await shot(maria.page, 'support-ticket');

  const admin = await asUser(browser, 'admin@parri.test');
  await admin.page.goto('/admin?tab=support');
  await admin.page.getByTestId('admin-tickets').getByText('Не пришло пополнение').click();
  await admin.page.getByRole('textbox', { name: 'Сообщение команде' }).fill('Проверили — зачислили, обновите баланс');
  await admin.page.getByRole('button', { name: 'Отправить сообщение' }).click();
  await expect(admin.page.getByTestId('ticket-messages')).toContainText('Проверили');

  await maria.page.goto(ticketUrl);
  await expect(maria.page.getByTestId('ticket-messages')).toContainText('Команда Parri');
  await expect(maria.page.getByTestId('ticket-status')).toHaveText('Ждёт вашего ответа');
  await maria.page.getByRole('button', { name: 'Вопрос решён' }).click();
  await expect(maria.page.getByTestId('ticket-status')).toHaveText('Решено');
  await admin.ctx.close();
  await maria.ctx.close();
});

test('спор: Pro открывает, модератор решает в пользу исполнителя', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'один раз');
  const title = `E2E спор ${Date.now()}`;
  const anna = await asUser(browser, 'anna@parri.test');
  await anna.page.goto('/disputes');
  await expect(anna.page.getByTestId('disputes-pro')).toContainText('доступен на Pro');
  await anna.page.goto('/tasks/new');
  await hydrated(anna.page);
  await anna.page.getByLabel('Название').fill(title);
  await anna.page.getByLabel('Краткая инструкция').fill('Сделать баннер для группы');
  await anna.page.getByRole('button', { name: 'Дизайн', exact: true }).click();
  await anna.page.getByRole('button', { name: 'JPG', exact: true }).click();
  await anna.page.getByLabel(/Награда/).fill('6');
  await anna.page.getByRole('button', { name: /Опубликовать за/ }).click();
  await anna.page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/);
  const taskUrl = anna.page.url();

  const ivan = await asUser(browser, 'ivan@parri.test');
  await ivan.page.goto(taskUrl);
  await hydrated(ivan.page);
  await ivan.page.getByRole('button', { name: 'Взять задачу' }).first().click();
  await ivan.page.getByRole('dialog').getByRole('button', { name: /Взять задачу/ }).click();
  await expect(ivan.page.getByText('Задача ваша!')).toBeVisible();
  await ivan.page.goto('/disputes');
  await hydrated(ivan.page);
  const form = ivan.page.getByTestId('dispute-form');
  const value = await form.getByLabel('Задача').locator('option', { hasText: title }).getAttribute('value');
  await form.getByLabel('Задача').selectOption(value!);
  await form.getByRole('button', { name: 'Проблема с оплатой' }).click();
  await form.getByLabel('Подробное описание').fill('Заказчик не отвечает, работа готова и отправлена в чат');
  await form.getByText('Предоставляю достоверную информацию').click({ position: { x: 12, y: 12 } });
  await shot(ivan.page, 'dispute-form');
  await form.getByRole('button', { name: 'Отправить модератору' }).click();
  await expect(ivan.page.getByTestId('disputes')).toContainText(title);
  await expect(ivan.page.getByTestId('disputes')).toContainText('Ожидает');

  const admin = await asUser(browser, 'admin@parri.test');
  await admin.page.goto('/admin?tab=disputes');
  const row = admin.page.getByTestId('admin-disputes').locator('li').filter({ hasText: 'Заказчик не отвечает' }).first();
  await row.getByRole('button', { name: 'Отправить решение' }).click();
  await row.getByLabel('Комментарий к решению').fill('Работа сдана, заказчик молчит');
  await row.getByRole('button', { name: 'В пользу исполнителя' }).click();
  await expect(admin.page.getByText('Готово').first()).toBeVisible();

  await ivan.page.reload();
  await expect(ivan.page.getByTestId('disputes')).toContainText('В пользу исполнителя');
  await shot(ivan.page, 'disputes');
  await admin.ctx.close();
  await ivan.ctx.close();
  await anna.ctx.close();
});

test('верификация селфи и решение модератора; бот PARRI; админка; служебные страницы', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'один раз');
  const maria = await asUser(browser, 'maria@parri.test');
  await maria.page.goto('/verification');
  await hydrated(maria.page);
  await maria.page.locator('input[type=file][accept="image/*"]').setInputFiles({ name: 'selfie.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
  await maria.page.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(maria.page.getByTestId('verifications')).toContainText('На проверке');
  await shot(maria.page, 'verification');

  // Бот недоступен без Pro
  await maria.page.goto('/bot');
  await expect(maria.page.getByTestId('bot-pro')).toBeVisible();

  const admin = await asUser(browser, 'admin@parri.test');
  await admin.page.goto('/admin');
  await expect(admin.page.getByTestId('admin-dashboard')).toContainText('Пользователи');
  await shot(admin.page, 'admin');
  await admin.page.getByRole('button', { name: 'KYC', exact: true }).click();
  await admin.page.getByTestId('admin-kyc').getByRole('button', { name: 'Одобрить' }).first().click();
  await expect(admin.page.getByText('Готово').first()).toBeVisible();
  await admin.page.getByRole('button', { name: 'Пользователи', exact: true }).click();
  await admin.page.getByLabel('Поиск').fill('maria@parri.test');
  await expect(admin.page.getByTestId('admin-users')).toContainText('maria@parri.test');
  await admin.page.getByTestId('admin-users').getByRole('button', { name: 'Изменить баланс' }).click();
  await admin.page.getByLabel('Сумма').fill('5');
  await admin.page.getByLabel('Комментарий').fill('Тестовое начисление');
  await admin.page.getByRole('button', { name: 'OK' }).click();
  await expect(admin.page.getByText('Готово').first()).toBeVisible();
  await admin.page.getByRole('button', { name: 'Журнал аудита', exact: true }).click();
  await expect(admin.page.getByText('balance_adjust')).toBeVisible();
  await admin.ctx.close();

  await maria.page.goto('/verification');
  await expect(maria.page.getByText('Аккаунт подтверждён')).toBeVisible();
  await maria.ctx.close();

  const ivan = await asUser(browser, 'ivan@parri.test');
  await ivan.page.goto('/bot');
  await hydrated(ivan.page);
  await ivan.page.getByRole('button', { name: 'Как работает Сейф?' }).click();
  await expect(ivan.page.getByTestId('bot-messages')).toContainText('резерв денег', { timeout: 15_000 });
  await ivan.page.getByRole('textbox', { name: 'Спроси PARRI' }).fill('Найди дизайн-задачи до $50');
  await ivan.page.getByRole('button', { name: 'Отправить' }).click();
  await expect(ivan.page.getByTestId('bot-messages')).toContainText(/Нашёл|Сейчас нет/, { timeout: 15_000 });
  await shot(ivan.page, 'bot');
  await ivan.page.getByRole('button', { name: 'Очистить' }).click();
  await expect(ivan.page.getByTestId('bot-messages')).not.toContainText('Сейф');

  await ivan.page.goto('/no-such-page');
  await expect(ivan.page.getByRole('heading', { name: 'Страница не найдена' })).toBeVisible();
  await ivan.page.goto('/legal/terms');
  await expect(ivan.page.getByRole('heading', { name: 'Пользовательское соглашение' })).toBeVisible();
  await ivan.page.goto('/403');
  await expect(ivan.page.getByRole('heading', { name: 'Нет доступа' })).toBeVisible();
  await ivan.ctx.close();
});
