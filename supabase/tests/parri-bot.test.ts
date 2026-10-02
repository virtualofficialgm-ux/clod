import { describe, expect, it } from 'vitest';
import { BotError, handleBot, parseFilters, type BotDeps, type BotTask, type ToolClient } from '../functions/parri-bot/handler';

const task: BotTask = { id: 't1', title: 'Логотип для клуба', reward_cents: 1500, currency: 'USD', category: 'design', deadline: '24h', kind: 'online' };

function deps(opts: { pro?: boolean; tasks?: BotTask[] } = {}) {
  const log: { role: string; body: string }[] = [];
  const searches: unknown[] = [];
  const d: BotDeps = {
    async log(role, body) {
      if (opts.pro === false) throw new Error('bot_requires_pro');
      log.push({ role, body });
    },
    async history() {
      return [];
    },
    async searchTasks(f) {
      searches.push(f);
      return opts.tasks ?? [task];
    },
  };
  return { d, log, searches };
}

describe('бот PARRI', () => {
  it('разбирает категорию, бюджет и срочность', () => {
    expect(parseFilters('Найди дизайн-задачи до $20')).toMatchObject({ categories: ['design'], maxRewardCents: 2000 });
    expect(parseFilters('Что-нибудь по тексту срочное')).toMatchObject({ categories: ['writing'], maxMinutes: 1440 });
    expect(parseFilters('переводы рядом')).toMatchObject({ categories: ['translation'], kind: 'nearby' });
  });

  it('без ключа ищет задачи и отвечает на вопросы о платформе', async () => {
    const { d, log, searches } = deps();
    const r = await handleBot('Найди дизайн-задачи до $20', d, null);
    expect(r.tasks).toEqual([task]);
    expect(searches[0]).toMatchObject({ maxRewardCents: 2000 });
    expect(log.map((x) => x.role)).toEqual(['user', 'assistant']);
    const faq = await handleBot('Как работает Сейф?', d, null);
    expect(faq.reply).toMatch(/Сейф/);
    expect(faq.tasks).toEqual([]);
    const max = await handleBot('Что даёт подписка Max?', d, null);
    expect(max.reply).toMatch(/пока не продаётся/);
  });

  it('только на Pro', async () => {
    const { d } = deps({ pro: false });
    await expect(handleBot('привет', d, null)).rejects.toMatchObject({ code: 'bot_requires_pro' });
    await expect(handleBot('', deps().d, null)).rejects.toBeInstanceOf(BotError);
  });

  it('с Claude: вызывает поиск и возвращает ответ модели', async () => {
    const calls: Record<string, unknown>[] = [];
    const client: ToolClient = {
      messages: {
        async create(body) {
          calls.push(body);
          if (calls.length === 1) {
            return { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'c1', name: 'search_tasks', input: { categories: ['design'], max_reward_usd: 20 } }] };
          }
          return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Есть логотип за $15.' }] };
        },
      },
    };
    const { d, searches } = deps();
    const r = await handleBot('дизайн до 20 долларов', d, client);
    expect(r).toEqual({ reply: 'Есть логотип за $15.', tasks: [task] });
    expect(searches[0]).toMatchObject({ categories: ['design'], maxRewardCents: 2000 });
    expect(calls[0]).toMatchObject({ model: 'claude-opus-5-5' });
    expect((calls[1]!.messages as unknown[]).length).toBe(3);
  });
});
