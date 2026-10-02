import { expect, test } from '@playwright/test';
import { asUser, fillOtp, hydrated, lastOtp, login, noHorizontalScroll, shot } from './helpers';

test('лендинг для гостя', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Работа, задачи и люди рядом.');
  await expect(page.getByRole('link', { name: 'Начать бесплатно' }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Три формата работы' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Как это работает' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Безопасность' })).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, `landing-${info.project.name}`);
});

test('гостя из приложения отправляет на вход', async ({ page }) => {
  await page.goto('/feed');
  await page.waitForURL('**/login?next=%2Ffeed');
});

test('регистрация по шагам: email → код → пароль → профиль (16+) → … → готово', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'один раз');
  const email = `e2e-${Date.now()}@parri.test`;
  await page.goto('/register');
  await hydrated(page);
  await expect(page.getByRole('button', { name: 'Продолжить с Google' })).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить по email' }).click();

  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByText('Примите условия использования')).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Продолжить' }).click();

  await expect(page.getByRole('heading', { name: 'Введите код' })).toBeVisible();
  await fillOtp(page, '000000');
  await page.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page.getByText('Код неверный или устарел')).toBeVisible();
  await fillOtp(page, await lastOtp(email));
  await page.getByRole('button', { name: 'Подтвердить' }).click();

  await expect(page.getByRole('heading', { name: 'Придумайте пароль' })).toBeVisible();
  await page.getByLabel('Пароль', { exact: true }).fill('short');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByText('Пароль — от 8 символов')).toBeVisible();
  await page.getByLabel('Пароль', { exact: true }).fill('Parri-Demo-2026!');
  await expect(page.getByText('Надёжный')).toBeVisible();
  await page.getByLabel('Повторите пароль').fill('Parri-Demo-2026!');
  await page.getByRole('button', { name: 'Продолжить' }).click();

  await expect(page.getByRole('heading', { name: 'Как вас зовут?' })).toBeVisible();
  await page.getByLabel('Имя', { exact: true }).fill('Тест');
  await page.getByLabel('Фамилия').fill('Студентов');
  const young = new Date();
  young.setFullYear(young.getFullYear() - 15);
  await page.getByLabel('Дата рождения').fill(young.toISOString().slice(0, 10));
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByText('Регистрация доступна с 16 лет').first()).toBeVisible();
  await page.getByLabel('Дата рождения').fill('2005-06-15');
  await page.getByRole('button', { name: 'Продолжить' }).click();

  await expect(page.getByRole('heading', { name: 'Где вы находитесь?' })).toBeVisible();
  await page.getByLabel('Страна').selectOption('RU');
  await page.getByLabel('Город').fill('Москва');
  await page.getByRole('button', { name: 'Продолжить' }).click();

  await expect(page.getByRole('heading', { name: 'Чем вы занимаетесь?' })).toBeVisible();
  await page.getByRole('radio', { name: 'Дизайнер презентаций' }).click();
  await page.getByRole('radio', { name: /Начинающий/ }).click();
  await expect(page.getByText('Так увидят ваш профиль')).toBeVisible();
  await page.getByRole('button', { name: 'Далее' }).click();

  await expect(page.getByRole('heading', { name: 'Что вы умеете?' })).toBeVisible();
  for (const n of ['Слайды', 'Питч-деки', 'Дизайн презентаций', 'Figma']) await page.getByRole('checkbox', { name: n, exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Далее' })).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Логотипы', exact: true }).click();
  await shot(page, 'register-skills');
  await page.getByRole('button', { name: 'Далее' }).click();

  await expect(page.getByRole('heading', { name: 'Расскажите о себе' })).toBeVisible();
  await page.getByRole('button', { name: 'Оформить с ИИ' }).click();
  await page.getByRole('button', { name: 'Продолжить' }).click();

  await expect(page.getByRole('heading', { name: 'Где вы учитесь?' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Университет' }).fill('Lomonosov');
  await page.getByRole('radio', { name: /Lomonosov Moscow State University/ }).click();
  await page.getByRole('button', { name: 'Добавить и продолжить' }).click();

  await expect(page.getByRole('heading', { name: 'Проверим и подтвердим' })).toBeVisible();
  await expect(page.getByText('Слайды, Питч-деки')).toBeVisible();
  const confirm = page.getByRole('button', { name: 'Подтвердить и продолжить' });
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox', { name: /Пользовательское соглашение/ }).check();
  await page.getByRole('checkbox', { name: /Политика конфиденциальности/ }).check();
  await confirm.click();

  await expect(page.getByRole('heading', { name: 'Всё готово!' })).toBeVisible();
  await shot(page, 'register-done');
  await page.getByRole('button', { name: 'Перейти к задачам' }).click();
  await page.waitForURL('**/feed');
  // Новичок видит задачи своего вуза
  await page.getByRole('tab', { name: 'В моём вузе' }).click();
  await expect(page.getByText('Конспект лекции по матанализу')).toBeVisible();
});

test('полный цикл: публикация → отклик → выбор → чат → сдача → приёмка с выплатой', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'один раз');
  const title = `E2E задача ${Date.now()}`;

  // Анна публикует задачу с ИИ-оформлением
  const anna = await asUser(browser, 'anna@parri.test');
  await anna.page.goto('/tasks/new');
  await hydrated(anna.page);
  await anna.page.getByLabel('Название').fill(title);
  await anna.page.getByLabel('Краткая инструкция').fill('Сделать обложку для доклада');
  await anna.page.getByRole('button', { name: 'Оформить с ИИ' }).click();
  await expect(anna.page.getByLabel('Описание')).not.toHaveValue('');
  await anna.page.getByRole('button', { name: 'Дизайн', exact: true }).click();
  await anna.page.getByRole('button', { name: 'JPG', exact: true }).click();
  await anna.page.getByLabel('Награда').fill('12');
  await expect(anna.page.getByTestId('total')).toHaveText(/12,60/);
  await shot(anna.page, 'create-task');
  await anna.page.getByRole('button', { name: /Опубликовать за/ }).click();
  await anna.page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/);
  const taskUrl = anna.page.url();
  await expect(anna.page.getByText('Открыта').first()).toBeVisible();

  // Иван находит её поиском, задаёт вопрос и откликается со своей ценой
  const ivan = await asUser(browser, 'ivan@parri.test');
  await ivan.page.getByRole('searchbox', { name: 'Название задачи, навык, заказчик' }).fill(title);
  await ivan.page.getByRole('link', { name: new RegExp(title) }).first().click();
  await ivan.page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/);
  await hydrated(ivan.page);
  await ivan.page.getByRole('link', { name: /Вопросы · 0/ }).click();
  await ivan.page.getByLabel('Задать вопрос').fill('Какой размер обложки?');
  await ivan.page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(ivan.page.getByTestId('question')).toContainText('Какой размер обложки?');
  await ivan.page.goto(taskUrl);
  await hydrated(ivan.page);
  await ivan.page.getByRole('button', { name: 'Откликнуться со своими условиями' }).click();
  await ivan.page.getByLabel('Сопроводительное письмо').fill('коротко');
  await ivan.page.getByText('Я ознакомился с описанием').click({ position: { x: 12, y: 12 } });
  await ivan.page.getByRole('button', { name: 'Отправить отклик' }).click();
  await expect(ivan.page.getByText('Сообщение — от 20 символов')).toBeVisible();
  await ivan.page.getByLabel('Сопроводительное письмо').fill('Сделаю обложку в фирменном стиле, есть опыт.');
  await ivan.page.getByLabel('Стоимость').fill('15');
  await ivan.page.getByRole('button', { name: 'Отправить отклик' }).click();
  await expect(ivan.page.getByTestId('response-sent')).toBeVisible();
  await shot(ivan.page, 'response-sent');
  await ivan.page.getByRole('link', { name: 'Посмотреть отклик' }).click();
  await expect(ivan.page.getByTestId('response-status')).toHaveText('Ожидает просмотра');

  // Анна отвечает на вопрос, сравнивает и выбирает Ивана: доплата $3.15 в Сейф (награда +$3 и комиссия 5% с неё)
  await anna.page.goto(taskUrl + '/questions');
  await anna.page.getByRole('button', { name: 'Ответить' }).click();
  await anna.page.getByLabel('Ответить').fill('1920×1080');
  await anna.page.getByRole('button', { name: 'Опубликовать' }).click();
  await expect(anna.page.getByTestId('question')).toContainText('1920×1080');
  await anna.page.goto(taskUrl + '/responses');
  await expect(anna.page.getByTestId('responses')).toContainText('Иван П.');
  await shot(anna.page, 'responses');
  await ivan.page.reload();
  await expect(ivan.page.getByTestId('response-status')).toHaveText('Просмотрен');
  await anna.page.getByRole('button', { name: 'Выбрать', exact: true }).click();
  await expect(anna.page.getByText('Доплата в Сейф: 3,15 $')).toBeVisible();
  await anna.page.getByRole('dialog').getByRole('button', { name: 'Выбрать' }).click();
  await anna.page.waitForURL(/\/room$/);
  await expect(anna.page.getByText('Исполнитель выбран. Удачной работы!')).toBeVisible();
  await anna.page.getByRole('textbox', { name: 'Сообщение' }).fill('Привет! Жду к вечеру');
  await anna.page.getByRole('button', { name: 'Отправить', exact: true }).click();
  await expect(anna.page.getByText('Привет! Жду к вечеру')).toBeVisible();

  // Иван видит сообщение («Прочитано» у Анны), просит продление и сдаёт работу
  await ivan.page.goto(taskUrl + '/room');
  await expect(ivan.page.getByText('Привет! Жду к вечеру')).toBeVisible();
  await expect(anna.page.getByText('Прочитано').first()).toBeVisible({ timeout: 15_000 });
  const ivanPanel = ivan.page.locator('aside .lg\\:block');
  await ivanPanel.getByRole('button', { name: 'Запросить продление' }).click();
  await ivan.page.getByRole('dialog').getByRole('button', { name: '1 час' }).click();
  await ivan.page.getByRole('dialog').getByRole('button', { name: 'Запросить продление' }).click();
  await expect(ivan.page.getByText('Исполнитель просит продлить срок').first()).toBeVisible();
  await ivan.page.getByRole('button', { name: 'Сдать работу' }).first().click();
  await ivan.page.getByLabel('Ссылка на результат или прототип').fill('https://example.com/cover.jpg');
  await ivan.page.getByLabel('Описание результата').fill('Готово, два варианта');
  await ivan.page.getByText('Соответствует заданию').click();
  await ivan.page.getByRole('button', { name: 'Предпросмотр' }).click();
  await expect(ivan.page.getByTestId('submit-preview')).toContainText('Готово, два варианта');
  await ivan.page.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(ivan.page.getByText('Работа сдана на проверку (версия 1)')).toBeVisible();
  await shot(ivan.page, 'room');

  // Анна продлевает срок, просит доработку по пункту, Иван сдаёт версию 2
  await anna.page.reload();
  const annaPanel = anna.page.locator('aside .lg\\:block');
  await annaPanel.getByRole('button', { name: 'Продлить' }).click();
  await expect(anna.page.getByText('Срок продлён').first()).toBeVisible();
  await anna.page.getByRole('button', { name: 'Проверить работу' }).first().click();
  await anna.page.getByRole('button', { name: 'Запросить доработку' }).click();
  await expect(anna.page.getByTestId('revision-form')).toBeVisible();
  await anna.page.getByRole('button', { name: 'Оформление' }).click();
  await anna.page.getByLabel('Что нужно исправить').fill('Сделайте шрифт крупнее');
  await shot(anna.page, 'revision');
  await anna.page.getByRole('button', { name: 'Отправить запрос на доработку' }).click();
  await expect(anna.page.getByText('Заказчик запросил доработку (версия 1)')).toBeVisible();
  await ivan.page.reload();
  await ivan.page.getByRole('button', { name: 'Сдать работу' }).first().click();
  await ivan.page.getByLabel('Описание результата').fill('Шрифт увеличен');
  await ivan.page.getByRole('button', { name: 'Отправить на проверку' }).click();
  await expect(ivan.page.getByText('Работа сдана на проверку (версия 2)')).toBeVisible();

  // Анна проходит чек-лист и принимает
  await anna.page.reload();
  await anna.page.getByRole('button', { name: 'Проверить работу' }).first().click();
  const accept = anna.page.getByRole('button', { name: /Принять и оплатить/ });
  const items = anna.page.getByRole('dialog').locator('label:has(input[type=checkbox])');
  const n = await items.count();
  if (n > 0) {
    await expect(accept).toBeDisabled();
    for (let i = 0; i < n; i++) await items.nth(i).click();
  }
  await shot(anna.page, 'review');
  await accept.click();
  await expect(anna.page.getByText('Работа принята, оплата отправлена')).toBeVisible();
  await expect(anna.page.getByText('Работа принята, награда выплачена')).toBeVisible();

  // Чаевые $3 и отзыв
  await anna.page.locator('aside .lg\\:block').getByRole('button', { name: 'Чаевые' }).click();
  await anna.page.getByRole('dialog').getByRole('button', { name: /Отправить 3/ }).click();
  await expect(anna.page.getByText('Заказчик отправил чаевые').first()).toBeVisible();
  await anna.page.goto(taskUrl);
  await expect(anna.page.getByText('Задача выполнена')).toBeVisible();
  await anna.page.getByRole('button', { name: 'Оставить отзыв' }).click();
  await anna.page.getByRole('radiogroup', { name: 'Общая оценка' }).getByRole('radio', { name: '5' }).click();
  await anna.page.getByLabel('Публичный отзыв').fill('Быстро и аккуратно');
  await anna.page.getByRole('button', { name: 'Опубликовать отзыв' }).click();
  await expect(anna.page.getByText('Спасибо за отзыв!')).toBeVisible();

  // Иван получил $15 на баланс
  await ivan.page.goto('/balance');
  await expect(ivan.page.getByText('Выплата за задачу').first()).toBeVisible();
  await expect(ivan.page.getByText('+15 $').first()).toBeVisible();
  await expect(ivan.page.getByText('+3 $').first()).toBeVisible();
  await anna.ctx.close();
  await ivan.ctx.close();
});

test('взять задачу сразу, начать, черновик задачи', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'один раз');
  const title = `E2E сразу ${Date.now()}`;
  const anna = await asUser(browser, 'anna@parri.test');
  await anna.page.goto('/tasks/new');
  await hydrated(anna.page);
  await anna.page.getByLabel('Название').fill(title);
  await anna.page.getByLabel('Краткая инструкция').fill('Проверить орфографию в тексте на одну страницу');
  await anna.page.getByRole('button', { name: 'Сохранить черновик' }).click();
  await expect(anna.page.getByText('Черновик сохранён')).toBeVisible();
  await anna.page.goto('/my-tasks');
  await anna.page.getByRole('tab', { name: 'Мои задачи' }).click();
  await anna.page.getByRole('button', { name: /Черновики · 1/ }).click();
  await expect(anna.page.getByText(title)).toBeVisible();
  await anna.page.getByRole('link', { name: 'Продолжить черновик' }).click();
  await expect(anna.page.getByLabel('Название')).toHaveValue(title);
  await anna.page.getByRole('button', { name: 'Тексты', exact: true }).click();
  await anna.page.getByRole('button', { name: 'Текст', exact: true }).click();
  await anna.page.getByLabel(/Награда/).fill('5');
  await anna.page.getByRole('button', { name: /Опубликовать за/ }).click();
  await anna.page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/);
  const taskUrl = anna.page.url();

  const ivan = await asUser(browser, 'ivan@parri.test');
  await ivan.page.goto(taskUrl);
  await hydrated(ivan.page);
  await ivan.page.getByRole('button', { name: 'Взять задачу' }).first().click();
  await ivan.page.getByRole('dialog').getByRole('button', { name: /Взять задачу/ }).click();
  await ivan.page.waitForURL(taskUrl);
  await expect(ivan.page.getByText('Задача ваша!')).toBeVisible();
  await ivan.page.getByRole('button', { name: /Начать выполнение/ }).click();
  await expect(ivan.page.getByText('Исполнитель начал работу').or(ivan.page.getByRole('link', { name: 'Открыть рабочую комнату' })).first()).toBeVisible();
  await shot(ivan.page, 'task-yours');
  await ivan.page.goto('/my-tasks');
  await expect(ivan.page.getByTestId('my-tasks')).toContainText(title);
  await expect(ivan.page.getByRole('link', { name: 'Продолжить работу' }).first()).toBeVisible();
  await anna.ctx.close();
  await ivan.ctx.close();
});

test.describe('экраны в двух темах', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`лента, задача, мои задачи — ${scheme}`, async ({ browser }, info) => {
      const ctx = await browser.newContext({
        colorScheme: scheme,
        viewport: info.project.name === 'phone' ? { width: 390, height: 844 } : { width: 1440, height: 960 },
        isMobile: info.project.name === 'phone',
        hasTouch: info.project.name === 'phone',
      });
      const page = await ctx.newPage();
      await login(page, 'maria@parri.test');
      await expect(page.getByTestId('feed-list')).toBeVisible();
      await noHorizontalScroll(page);
      await shot(page, `feed-${info.project.name}-${scheme}`);

      await page.getByRole('button', { name: 'Фильтры' }).click();
      await expect(page.getByRole('dialog', { name: 'Фильтры' })).toBeVisible();
      await shot(page, `filters-${info.project.name}-${scheme}`);
      await page.keyboard.press('Escape');

      await page.getByRole('tab', { name: 'Рядом' }).click();
      await expect(page.getByText('Нужен доступ к геолокации')).toBeVisible();
      await shot(page, `nearby-nogeo-${info.project.name}-${scheme}`);

      await page.goto('/tasks/b0000000-0000-4000-8000-000000000002');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Перевести резюме');
      await noHorizontalScroll(page);
      await shot(page, `task-${info.project.name}-${scheme}`);

      await page.goto('/tasks/b0000000-0000-4000-8000-000000000002/room');
      await expect(page.getByText('Исполнитель выбран. Удачной работы!')).toBeVisible();
      await shot(page, `room-${info.project.name}-${scheme}`);

      await page.goto('/my-tasks');
      await expect(page.getByTestId('my-tasks')).toBeVisible();
      await shot(page, `my-tasks-${info.project.name}-${scheme}`);

      await page.goto('/tasks/new');
      await hydrated(page);
      await noHorizontalScroll(page);
      await shot(page, `create-${info.project.name}-${scheme}`);
      await ctx.close();
    });
  }
});

test('«Рядом» по реальной геолокации', async ({ browser }) => {
  const ctx = await browser.newContext({ geolocation: { latitude: 55.758, longitude: 37.66 }, permissions: ['geolocation'] });
  const page = await ctx.newPage();
  await login(page, 'maria@parri.test');
  await page.getByRole('tab', { name: 'Рядом' }).click();
  await expect(page.getByText('Проверить наличие кроссовок')).toBeVisible();
  await expect(page.getByText(/^\d+ м$/).first()).toBeVisible();
  await ctx.close();
});

test('деньги: пополнение через Stripe, подписка Pro, выплаты и заявка на вывод', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'один раз');
  const { ctx, page } = await asUser(browser, 'maria@parri.test');
  await page.goto('/balance');
  await hydrated(page);
  const before = await page.getByText(/Готово к выводу/).locator('..').innerText();
  await page.getByRole('button', { name: 'Пополнить' }).first().click();
  await page.getByRole('radio', { name: /50\s?\$/ }).click();
  await page.getByRole('button', { name: /Оплатить 50/ }).click();
  // Тестовая страница Stripe из devstack: событие подписывается секретом вебхука
  await page.waitForURL('**/dev/stripe/checkout/**');
  await page.getByRole('button', { name: 'Оплатить' }).click();
  await page.waitForURL('**/balance?payment=success**');
  await expect(page.getByText('Оплата прошла')).toBeVisible({ timeout: 15_000 });
  await shot(page, 'topup-success');
  await page.getByRole('button', { name: 'К балансу' }).click();
  await expect(page.getByText(/Готово к выводу/).locator('..')).not.toHaveText(before);

  // Отклонённый платёж не зачисляется
  await page.getByRole('button', { name: 'Пополнить' }).first().click();
  await page.getByRole('button', { name: /Оплатить 25/ }).click();
  await page.waitForURL('**/dev/stripe/checkout/**');
  await page.getByRole('button', { name: 'Отклонить платёж' }).click();
  await expect(page.getByText('Платёж отклонён')).toBeVisible();
  await page.getByRole('button', { name: 'К балансу' }).click();

  // Подписка Pro
  await page.goto('/subscription');
  await page.getByRole('button', { name: 'Подключить Pro' }).click();
  await page.waitForURL('**/dev/stripe/checkout/**');
  await page.getByRole('button', { name: 'Оплатить' }).click();
  await page.waitForURL('**/subscription?payment=success');
  await expect(page.getByRole('button', { name: 'Управлять подпиской' })).toBeVisible({ timeout: 15_000 });
  await shot(page, 'subscription-pro');

  // Выплаты: настройка Connect и заявка
  await page.goto('/balance/withdraw');
  await page.getByRole('button', { name: 'Настроить выплаты' }).click();
  await page.waitForURL('**/dev/stripe/connect/**');
  await page.getByRole('button', { name: 'Завершить проверку' }).click();
  await expect(page.getByText('Выплаты настроены')).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Сумма', { exact: true }).fill('15');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Подтвердить вывод' }).click();
  await expect(page.getByText('Заявка создана')).toBeVisible();
  await expect(page.getByText('Ожидает проверки').first()).toBeVisible();
  // Вторая заявка в течение часа — нельзя
  await page.getByRole('button', { name: 'Изменить детали' }).click();
  await page.getByLabel('Сумма', { exact: true }).fill('10');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Подтвердить вывод' }).click();
  await expect(page.getByText('Не чаще одной заявки в час')).toBeVisible();
  await ctx.close();
});
