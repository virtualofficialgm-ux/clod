import { describe, expect, it } from 'vitest';
import { buildMessages, dispatch } from '../functions/push-dispatch/handler';
import { TranslateError, translate } from '../functions/translate/handler';

describe('push-dispatch', () => {
  const row = { id: 1, user_id: 'u', kind: 'new_response', payload: { title: 'Логотип' }, actor_name: 'Иван П.', task_id: 't', tokens: ['ExponentPushToken[abc]', 'not-a-token'] };
  it('собирает сообщения только для настоящих токенов Expo', () => {
    expect(buildMessages([row])).toEqual([
      { to: 'ExponentPushToken[abc]', title: 'Новый отклик', body: 'Иван П. · Логотип', sound: 'default', data: { kind: 'new_response', task_id: 't', id: 1 } },
    ]);
  });
  it('отправляет пачками по 100', async () => {
    const tokens = Array.from({ length: 250 }, (_, i) => `ExponentPushToken[${i}]`);
    const sizes: number[] = [];
    const n = await dispatch([{ ...row, tokens }], async (b) => {
      sizes.push(b.length);
    });
    expect(n).toBe(250);
    expect(sizes).toEqual([100, 100, 50]);
  });
});

describe('translate', () => {
  it('без ключа — unavailable, пустой текст — invalid_input', async () => {
    await expect(translate(null, { text: 'hi', to: 'ru' })).rejects.toMatchObject({ code: 'unavailable' });
    await expect(translate(null, { text: '' })).rejects.toBeInstanceOf(TranslateError);
  });
  it('возвращает текст модели', async () => {
    const calls: Record<string, unknown>[] = [];
    const r = await translate(
      { messages: { create: async (b) => (calls.push(b), { content: [{ type: 'text', text: 'Привет' }] }) } },
      { text: 'Hello', to: 'ru' },
    );
    expect(r).toEqual({ text: 'Привет', to: 'ru' });
    expect(calls[0]).toMatchObject({ model: 'claude-opus-5-5' });
  });
});
