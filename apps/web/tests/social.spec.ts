import { expect, test } from '@playwright/test';
import { asUser, hydrated, shot } from './helpers';

test.describe.configure({ mode: 'serial' });

test('люди: поиск, подписка, контакт, уведомления, личные сообщения и «печатает»', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'один раз');
  const ivan = await asUser(browser, 'ivan@parri.test');
  await ivan.page.goto('/people');
  await hydrated(ivan.page);
  await ivan.page.getByRole('searchbox', { name: 'Имя, навык или слово' }).fill('Анна');
  await expect(ivan.page.getByTestId('people-list')).toContainText('Анна');
  await shot(ivan.page, 'people');
  await ivan.page.getByTestId('person').first().getByRole('link', { name: 'Открыть профиль' }).click();
  await ivan.page.waitForURL(/\/u\/anna$/);
  await expect(ivan.page.getByTestId('profile-name')).toContainText('Анна');
  await ivan.page.getByRole('button', { name: 'Подписаться' }).click();
  await expect(ivan.page.getByRole('button', { name: 'Вы подписаны' })).toBeVisible();
  await ivan.page.getByRole('button', { name: 'В контакты' }).click();
  await expect(ivan.page.getByRole('button', { name: 'Отменить запрос' })).toBeVisible();
  await shot(ivan.page, 'profile-public');

  const anna = await asUser(browser, 'anna@parri.test');
  await expect(anna.page.getByTestId('badge-notifications')).toBeVisible();
  await anna.page.goto('/notifications');
  await expect(anna.page.getByTestId('notifications')).toContainText('подписался на вас');
  await expect(anna.page.getByTestId('notifications')).toContainText('хочет добавить вас в контакты');
  await shot(anna.page, 'notifications');
  await anna.page.getByText('хочет добавить вас в контакты').click();
  await anna.page.waitForURL(/\/connections\?tab=requests/);
  await anna.page.getByRole('button', { name: 'Принять' }).click();
  await anna.page.getByRole('button', { name: /^Контакты$/ }).click();
  await expect(anna.page.getByTestId('connections')).toContainText('Иван');

  // Иван пишет Анне лично
  await ivan.page.reload();
  await ivan.page.getByRole('link', { name: 'Написать' }).click();
  await ivan.page.waitForURL(/\/messages\/u\//);
  await ivan.page.getByRole('textbox', { name: 'Сообщение' }).fill('Привет! Есть минутка?');
  await ivan.page.keyboard.press('Enter');
  await expect(ivan.page.getByTestId('direct-messages')).toContainText('Привет! Есть минутка?');

  await anna.page.goto('/messages');
  await anna.page.getByRole('tab', { name: /Личные/ }).click();
  await anna.page.getByTestId('direct-threads').getByText('Иван', { exact: false }).first().click();
  await expect(anna.page.getByTestId('direct-messages')).toContainText('Привет! Есть минутка?');
  await anna.page.getByRole('textbox', { name: 'Сообщение' }).pressSequentially('Да', { delay: 50 });
  await expect(ivan.page.getByTestId('peer-status')).toHaveText('печатает…', { timeout: 10_000 });
  await expect(ivan.page.getByText('Прочитано')).toBeVisible({ timeout: 10_000 });
  await anna.page.keyboard.press('Enter');
  await expect(ivan.page.getByTestId('direct-messages')).toContainText('Да', { timeout: 10_000 });
  await shot(ivan.page, 'direct');
  await anna.ctx.close();
  await ivan.ctx.close();
});

test('приглашение в задачу: заказчик предлагает, исполнитель соглашается', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'один раз');
  const title = `E2E приглашение ${Date.now()}`;
  const anna = await asUser(browser, 'anna@parri.test');
  await anna.page.goto('/tasks/new');
  await hydrated(anna.page);
  await anna.page.getByLabel('Название').fill(title);
  await anna.page.getByLabel('Краткая инструкция').fill('Сверстать лендинг по макету');
  await anna.page.getByRole('button', { name: 'Код', exact: true }).click();
  await anna.page.getByRole('button', { name: 'Текст', exact: true }).click();
  await anna.page.getByLabel(/Награда/).fill('8');
  await anna.page.getByRole('button', { name: /Опубликовать за/ }).click();
  await anna.page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/);

  await anna.page.goto('/u/ivan');
  await anna.page.getByRole('button', { name: 'Предложить задачу' }).click();
  const sheet = anna.page.getByTestId('invite-sheet');
  await sheet.getByRole('radio', { name: new RegExp(title) }).click();
  await sheet.getByLabel('Личное сообщение').fill('Вам подойдёт, посмотрите');
  await anna.page.getByRole('button', { name: 'Отправить приглашение' }).click();
  await expect(anna.page.getByText('Приглашение отправлено')).toBeVisible();

  const ivan = await asUser(browser, 'ivan@parri.test');
  await ivan.page.goto('/connections?tab=invitations');
  const inv = ivan.page.getByTestId('invitation').filter({ hasText: title });
  await expect(inv).toContainText('Вам подойдёт');
  await shot(ivan.page, 'invitations');
  await inv.getByRole('button', { name: 'Принять' }).click();
  await ivan.page.waitForURL(/\/room$/);
  await expect(ivan.page.getByText('Исполнитель выбран. Удачной работы!')).toBeVisible();
  await anna.ctx.close();
  await ivan.ctx.close();
});

test('настройки: приватность, блокировка, деактивация и восстановление', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'один раз');
  const maria = await asUser(browser, 'maria@parri.test');
  await maria.page.goto('/settings?tab=privacy');
  await hydrated(maria.page);
  await maria.page.getByRole('tablist', { name: 'Город' }).getByRole('tab', { name: 'Только я' }).click();
  await maria.page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(maria.page.getByText('Настройки приватности сохранены')).toBeVisible();
  await shot(maria.page, 'settings-privacy');

  await maria.page.goto('/u/admin');
  await maria.page.getByRole('button', { name: 'Ещё' }).click();
  await maria.page.getByRole('button', { name: 'Заблокировать' }).click();
  await maria.page.getByRole('dialog').getByRole('button', { name: 'Заблокировать' }).click();
  await maria.page.waitForURL(/\/people$/);
  await maria.page.goto('/settings?tab=blocked');
  await expect(maria.page.getByTestId('blocked')).toContainText('Админ');
  await maria.page.getByRole('button', { name: 'Разблокировать' }).click();
  await maria.page.getByRole('dialog').getByRole('button', { name: 'Разблокировать' }).click();
  await expect(maria.page.getByText('Вы никого не блокировали')).toBeVisible();
  await maria.ctx.close();

  const admin = await asUser(browser, 'admin@parri.test');
  await admin.page.goto('/settings/exit?mode=deactivate');
  await hydrated(admin.page);
  await admin.page.getByRole('button', { name: 'Далее' }).click();
  await expect(admin.page.getByTestId('exit-blockers')).toContainText('Всё готово');
  await admin.page.getByRole('button', { name: 'Далее' }).click();
  await admin.page.getByRole('radio', { name: 'Беру перерыв' }).click();
  await admin.page.getByRole('button', { name: 'Далее' }).click();
  await admin.page.getByLabel('Пароль').fill('parri-demo-123');
  await admin.page.getByText('Я понимаю последствия').click({ position: { x: 12, y: 12 } });
  await admin.page.getByLabel(/Впишите слово/).fill('ДЕАКТИВАЦИЯ');
  await shot(admin.page, 'exit-confirm');
  await admin.page.getByRole('button', { name: 'Деактивировать', exact: true }).click();
  await expect(admin.page.getByTestId('account-deactivated')).toBeVisible();
  await admin.page.getByRole('button', { name: 'Восстановить аккаунт' }).click();
  await expect(admin.page.getByTestId('exit-flow')).toBeVisible();
  await admin.ctx.close();
});
