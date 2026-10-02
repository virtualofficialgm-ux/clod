/**
 * Перевод сообщения в чате задачи. С ключом ANTHROPIC_API_KEY — Claude, без ключа — отказ
 * с кодом unavailable (приложение показывает «Перевод недоступен»).
 */
export const MODEL = 'claude-opus-5-5';
export const LANGS = { ru: 'русский', en: 'английский', de: 'немецкий', es: 'испанский', fr: 'французский', zh: 'китайский', tr: 'турецкий', uk: 'украинский', kk: 'казахский' } as const;
export type Lang = keyof typeof LANGS;

export interface TextClient {
  messages: { create(body: Record<string, unknown>): Promise<{ content: { type: string; text?: string }[] }> };
}

export class TranslateError extends Error {
  constructor(public code: 'invalid_input' | 'unavailable' | 'upstream', message: string) {
    super(message);
  }
}

export function validate(raw: unknown): { text: string; to: Lang } {
  const v = raw as { text?: unknown; to?: unknown } | null;
  const text = typeof v?.text === 'string' ? v.text.trim() : '';
  const to = typeof v?.to === 'string' && v.to in LANGS ? (v.to as Lang) : 'ru';
  if (!text || text.length > 4000) throw new TranslateError('invalid_input', 'text must be 1–4000 chars');
  return { text, to };
}

export async function translate(client: TextClient | null, raw: unknown): Promise<{ text: string; to: Lang }> {
  const { text, to } = validate(raw);
  if (!client) throw new TranslateError('unavailable', 'no ANTHROPIC_API_KEY');
  let res;
  try {
    res = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: `Переведи сообщение пользователя на ${LANGS[to]} язык. Верни только перевод, без пояснений и кавычек. Если текст уже на этом языке — верни его без изменений.`,
      messages: [{ role: 'user', content: text }],
    });
  } catch (e) {
    throw new TranslateError('upstream', (e as Error).message);
  }
  const out = res.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('').trim();
  if (!out) throw new TranslateError('upstream', 'empty');
  return { text: out, to };
}
