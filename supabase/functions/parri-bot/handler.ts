/**
 * Бот-помощник PARRI (только Pro): ищет задачи по словам пользователя и отвечает на вопросы о
 * платформе. С ключом ANTHROPIC_API_KEY разговор ведёт Claude с инструментом search_tasks;
 * без ключа — простой разбор запроса (категория, бюджет «до $N», срочность) и готовые ответы.
 * Чистая логика без Deno — вызывается из Edge Function, dev-шлюза и тестов.
 */

export const MODEL = 'claude-opus-5-5';

export interface BotTask {
  id: string;
  title: string;
  reward_cents: number;
  currency: string;
  category: string;
  deadline: string;
  kind: string;
}

export interface TaskFilters {
  query?: string | null;
  categories?: string[] | null;
  maxRewardCents?: number | null;
  maxMinutes?: number | null;
  kind?: 'online' | 'nearby' | 'campus';
}

export interface BotDeps {
  /** Запомнить реплику (заодно проверяет, что у пользователя Pro) */
  log(role: 'user' | 'assistant', body: string, tasks?: BotTask[]): Promise<void>;
  /** Последние реплики для контекста, старые → новые */
  history(): Promise<{ role: 'user' | 'assistant'; body: string }[]>;
  searchTasks(f: TaskFilters): Promise<BotTask[]>;
}

export interface ToolClient {
  messages: {
    create(body: Record<string, unknown>): Promise<{
      stop_reason: string | null;
      content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
    }>;
  };
}

export class BotError extends Error {
  constructor(
    public code: 'invalid_input' | 'bot_requires_pro' | 'upstream',
    message: string,
  ) {
    super(message);
  }
}

export interface BotReply {
  reply: string;
  tasks: BotTask[];
}

const CATEGORY_WORDS: [RegExp, string][] = [
  [/дизайн|логотип|баннер|figma|фигм/i, 'design'],
  [/текст|стать|копирайт|пост/i, 'writing'],
  [/перевод|англ|translate/i, 'translation'],
  [/код|сайт|верст|программ|бот\b|скрипт/i, 'code'],
  [/презентац|слайд/i, 'presentations'],
  [/видео|монтаж|ролик/i, 'video'],
  [/фото/i, 'photo'],
  [/маркетинг|smm|реклам/i, 'marketing'],
  [/учёб|учеб|конспект|курсов/i, 'study'],
  [/данн|excel|таблиц/i, 'data'],
];

/** Разбор запроса без модели: «найди дизайн-задачи до $20», «что-нибудь по тексту срочное» */
export function parseFilters(text: string): TaskFilters {
  const f: TaskFilters = {};
  const cats = CATEGORY_WORDS.filter(([re]) => re.test(text)).map(([, c]) => c);
  if (cats.length) f.categories = [...new Set(cats)];
  const money = /(?:до|не дороже|меньше)\s*\$?\s*(\d+(?:[.,]\d+)?)\s*\$?/i.exec(text);
  if (money) f.maxRewardCents = Math.round(Number(money[1]!.replace(',', '.')) * 100);
  if (/срочн|быстр|сегодня|час/i.test(text))
    f.maxMinutes = /час/i.test(text) && !/сегодня/i.test(text) ? 60 : 1440;
  if (/рядом|поблизости/i.test(text)) f.kind = 'nearby';
  else if (/вуз|универ|кампус/i.test(text)) f.kind = 'campus';
  return f;
}

const FAQ: [RegExp, string][] = [
  [
    /сейф|эскроу|безопасн/i,
    'Сейф — это резерв денег под задачу. Когда заказчик публикует задачу, награда и комиссия списываются в Сейф. Исполнитель получает деньги, только когда заказчик принял работу. Если задачу отменили или она истекла, Сейф возвращается заказчику.',
  ],
  [
    /max|макс/i,
    'Подписка Max пока не продаётся — она появится позже. Сейчас есть Free и Pro: Pro даёт этого бота, +15 минут к дедлайну каждой взятой задачи, приоритет в рассылке задач и споры с модератором.',
  ],
  [
    /pro|подписк|тариф/i,
    'Pro стоит $15 в месяц или $144 в год. Он даёт бота PARRI, +15 минут к дедлайну каждой взятой задачи, подходящие задачи на 10 минут раньше остальных и споры с модератором.',
  ],
  [
    /комисси/i,
    'Комиссия платформы — от 5% до 2,5% в зависимости от суммы: до $49,99 — 5%, от $50 — 4%, от $100 — 3,5%, от $200 — 3%, от $500 — 2,5%. Её платит заказчик сверху награды.',
  ],
  [
    /вывод|вывести|выплат/i,
    'Вывести деньги можно в разделе «Баланс» → «Вывести»: на карту через Stripe или в USDT. Вывод доступен с 18 лет; крупные суммы проверяются вручную.',
  ],
  [
    /спор/i,
    'Спор можно открыть на Pro по задаче в работе или на проверке. Модератор отвечает в течение 48 часов; пока идёт спор, деньги остаются в Сейфе.',
  ],
];

const SEARCH_WORDS = /найд|ищ|задач|подбер|покажи|что-нибудь|подработ|работу/i;

function describeFilters(f: TaskFilters): string {
  const parts: string[] = [];
  if (f.categories?.length) parts.push(`категория: ${f.categories.join(', ')}`);
  if (f.maxRewardCents) parts.push(`до $${(f.maxRewardCents / 100).toFixed(0)}`);
  if (f.maxMinutes) parts.push(f.maxMinutes <= 60 ? 'срок до часа' : 'срок до суток');
  if (f.kind === 'nearby') parts.push('рядом');
  if (f.kind === 'campus') parts.push('в вузе');
  return parts.join(', ');
}

/** Ответ без модели */
export async function offlineReply(text: string, deps: BotDeps): Promise<BotReply> {
  for (const [re, answer] of FAQ)
    if (re.test(text) && !SEARCH_WORDS.test(text)) return { reply: answer, tasks: [] };
  if (SEARCH_WORDS.test(text) || CATEGORY_WORDS.some(([re]) => re.test(text))) {
    const f = parseFilters(text);
    const tasks = await deps.searchTasks(f);
    const what = describeFilters(f);
    if (!tasks.length)
      return {
        reply: `Сейчас нет открытых задач${what ? ` (${what})` : ''}. Попробуйте смягчить условия или загляните позже.`,
        tasks,
      };
    return {
      reply: `Нашёл ${tasks.length} ${tasks.length === 1 ? 'задачу' : tasks.length < 5 ? 'задачи' : 'задач'}${what ? ` (${what})` : ''}. Откройте нужную и нажмите «Взять задачу» или откликнитесь со своими условиями.`,
      tasks,
    };
  }
  for (const [re, answer] of FAQ) if (re.test(text)) return { reply: answer, tasks: [] };
  return {
    reply:
      'Я ищу задачи и отвечаю на вопросы о Parri. Попробуйте: «Найди дизайн-задачи до $20», «Что-нибудь по тексту срочное», «Как работает Сейф?».',
    tasks: [],
  };
}

const SYSTEM = `Ты — PARRI, помощник биржи микро-задач Parri. Отвечай по-русски, коротко и дружелюбно.
Ищи задачи инструментом search_tasks, когда человек просит найти работу; не выдумывай задачи.
Факты о платформе: деньги заказчика лежат в Сейфе до приёмки работы; комиссия по шкале (до $49,99 — 5%,
от $50 — 4%, от $100 — 3,5%, от $200 — 3%, от $500 — 2,5%) платит заказчик; Pro — $15 в месяц или $144 в год:
бот, +15 минут к дедлайну, подходящие задачи на 10 минут раньше, споры с модератором; подписки Max пока нет.
Вывод денег — с 18 лет. Не обещай того, чего нет в этих фактах.`;

const TOOL = {
  name: 'search_tasks',
  description: 'Найти открытые задачи в ленте Parri',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Слова для поиска в названии' },
      categories: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'design',
            'code',
            'writing',
            'marketing',
            'video',
            'study',
            'translation',
            'photo',
            'presentations',
            'data',
            'other',
          ],
        },
      },
      max_reward_usd: { type: 'number' },
      max_minutes: {
        type: 'number',
        description: '60 — до часа, 1440 — до суток, 4320 — до трёх дней',
      },
      kind: { type: 'string', enum: ['online', 'nearby', 'campus'] },
    },
    additionalProperties: false,
  },
} as const;

/** Разговор с Claude: до трёх вызовов поиска */
export async function claudeReply(
  client: ToolClient,
  text: string,
  deps: BotDeps,
  prior: { role: 'user' | 'assistant'; body: string }[] = [],
): Promise<BotReply> {
  const history = prior.slice(-10);
  const messages: Record<string, unknown>[] = [
    ...history.map((m) => ({ role: m.role, content: m.body })),
    { role: 'user', content: text },
  ];
  let found: BotTask[] = [];
  for (let i = 0; i < 4; i++) {
    let res;
    try {
      res = await client.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM,
        tools: [TOOL],
        messages,
      });
    } catch (e) {
      throw new BotError('upstream', (e as Error).message);
    }
    if (res.stop_reason === 'tool_use') {
      const calls = res.content.filter((c) => c.type === 'tool_use');
      messages.push({ role: 'assistant', content: res.content });
      const results = [];
      for (const call of calls) {
        const inp = (call.input ?? {}) as {
          query?: string;
          categories?: string[];
          max_reward_usd?: number;
          max_minutes?: number;
          kind?: TaskFilters['kind'];
        };
        const tasks = await deps.searchTasks({
          query: inp.query ?? null,
          categories: inp.categories ?? null,
          maxRewardCents: inp.max_reward_usd ? Math.round(inp.max_reward_usd * 100) : null,
          maxMinutes: inp.max_minutes ?? null,
          kind: inp.kind,
        });
        found = tasks;
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify(
            tasks.map((x) => ({
              title: x.title,
              reward_usd: x.reward_cents / 100,
              currency: x.currency,
              category: x.category,
              deadline: x.deadline,
            })),
          ),
        });
      }
      messages.push({ role: 'user', content: results });
      continue;
    }
    const reply = res.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('\n')
      .trim();
    return {
      reply: reply || 'Не получилось ответить, попробуйте переформулировать.',
      tasks: found,
    };
  }
  return { reply: 'Слишком много шагов поиска — уточните запрос.', tasks: found };
}

export async function handleBot(
  text: unknown,
  deps: BotDeps,
  client: ToolClient | null,
): Promise<BotReply> {
  const msg = typeof text === 'string' ? text.trim() : '';
  if (msg.length < 1 || msg.length > 1000)
    throw new BotError('invalid_input', 'message must be 1–1000 chars');
  const prior = client ? await deps.history() : [];
  try {
    await deps.log('user', msg);
  } catch (e) {
    if (/bot_requires_pro/.test((e as Error).message))
      throw new BotError('bot_requires_pro', 'pro only');
    throw e;
  }
  const out = client ? await claudeReply(client, msg, deps, prior) : await offlineReply(msg, deps);
  await deps.log('assistant', out.reply, out.tasks);
  return out;
}
