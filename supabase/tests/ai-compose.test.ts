import { describe, expect, it, vi } from 'vitest';
import { ComposeError, composeTask, MODEL, validateInput, type MessagesClient } from '../functions/ai-compose/handler';

function mockClient(reply: { stop_reason: string; text?: string } | Error) {
  const create = vi.fn(async () => {
    if (reply instanceof Error) throw reply;
    return { stop_reason: reply.stop_reason, content: reply.text ? [{ type: 'text', text: reply.text }] : [] };
  });
  return { client: { beta: { messages: { create } } } as MessagesClient, create };
}

const input = { title: 'Сверстать 6 слайдов', brief: 'Есть текст, нужен дизайн', kind: 'online' as const };

describe('ai-compose', () => {
  it('отправляет запрос в Claude со структурированным ответом и fallback', async () => {
    const { client, create } = mockClient({
      stop_reason: 'end_turn',
      text: JSON.stringify({ description: 'Описание', category: 'presentations', result_format: 'pptx', checklist: ['6 слайдов'] }),
    });
    const out = await composeTask(client, input);
    expect(out).toEqual({ description: 'Описание', category: 'presentations', result_format: 'pptx', checklist: ['6 слайдов'] });
    const body = create.mock.calls[0]![0] as Record<string, any>;
    expect(body.model).toBe(MODEL);
    expect(body.fallbacks).toBe('default');
    expect(body.betas).toEqual(['server-side-fallback-2026-07-01']);
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.thinking).toBeUndefined();
    expect(body.messages[0].content).toContain('Сверстать 6 слайдов');
  });

  it('чинит неизвестные значения и обрезает чек-лист до 6 пунктов', async () => {
    const { client } = mockClient({
      stop_reason: 'end_turn',
      text: JSON.stringify({ description: ' x ', category: 'weird', result_format: 'zip', checklist: ['1', '2', '3', '4', '5', '6', '7', ' '] }),
    });
    const out = await composeTask(client, input);
    expect(out.category).toBe('other');
    expect(out.result_format).toBe('text');
    expect(out.checklist).toHaveLength(6);
    expect(out.description).toBe('x');
  });

  it('отказ модели и мусор в ответе превращаются в понятные ошибки', async () => {
    await expect(composeTask(mockClient({ stop_reason: 'refusal' }).client, input)).rejects.toMatchObject({ code: 'refused' });
    await expect(composeTask(mockClient({ stop_reason: 'end_turn', text: 'не json' }).client, input)).rejects.toMatchObject({ code: 'bad_output' });
    await expect(composeTask(mockClient(new Error('503')).client, input)).rejects.toMatchObject({ code: 'upstream' });
  });

  it('валидирует ввод как форма создания задачи', () => {
    expect(() => validateInput({ title: 'аб', brief: 'x' })).toThrow(ComposeError);
    expect(() => validateInput({ title: 'Нормальное название', brief: 'x'.repeat(401) })).toThrow(ComposeError);
    expect(validateInput({ title: '  Нормальное название ', brief: 'x', kind: 'bogus', category: 'design' })).toEqual({
      title: 'Нормальное название', brief: 'x', kind: 'online', category: 'design',
    });
  });
});
