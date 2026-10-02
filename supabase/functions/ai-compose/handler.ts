/**
 * «Оформить с ИИ»: Claude дописывает описание задачи, предлагает категорию,
 * формат результата и чек-лист приёмки. Чистая логика без зависимостей от Deno —
 * вызывается из Edge Function (index.ts), dev-шлюза и тестов.
 */

export const CATEGORIES = [
  'design', 'code', 'writing', 'marketing', 'video', 'study',
  'translation', 'photo', 'presentations', 'data', 'other',
] as const;
export const RESULT_FORMATS = ['pptx', 'pdf', 'jpg', 'text', 'photo', 'checkin'] as const;

export const MODEL = 'claude-opus-5-5';

export interface ComposeInput {
  title: string;
  brief: string;
  kind?: 'online' | 'nearby' | 'campus';
  category?: string | null;
}

export interface ComposeResult {
  description: string;
  category: (typeof CATEGORIES)[number];
  result_format: (typeof RESULT_FORMATS)[number];
  checklist: string[];
}

/** Минимальный контракт клиента Anthropic SDK, который нужен функции (упрощает моки в тестах) */
export interface MessagesClient {
  beta: {
    messages: {
      create(body: Record<string, unknown>): Promise<{
        stop_reason: string | null;
        content: { type: string; text?: string }[];
      }>;
    };
  };
}

export class ComposeError extends Error {
  constructor(
    public code: 'invalid_input' | 'refused' | 'bad_output' | 'upstream',
    message: string,
  ) {
    super(message);
  }
}

const SYSTEM = `Ты помогаешь студентам оформлять микро-задачи для биржи Parri.
По названию и краткой инструкции заказчика напиши понятное описание задачи для исполнителя
на русском языке: что именно сделать, исходные данные, требования к результату.
Не выдумывай факты, которых нет во вводных: если чего-то не хватает, сформулируй это как
вопрос к заказчику в конце описания. Описание — 3–6 коротких абзацев или списков, без приветствий,
не длиннее 1500 символов. Предложи категорию, формат результата и чек-лист приёмки
из 3–6 проверяемых пунктов (каждый до 100 символов).
Если просьба нарушает академическую честность (сдать экзамен или тест за другого человека)
или закон, всё равно верни JSON, но в описании вежливо объясни, что такую задачу опубликовать нельзя,
и выбери категорию other.`;

const SCHEMA = {
  type: 'object',
  properties: {
    description: { type: 'string' },
    category: { type: 'string', enum: [...CATEGORIES] },
    result_format: { type: 'string', enum: [...RESULT_FORMATS] },
    checklist: { type: 'array', items: { type: 'string' } },
  },
  required: ['description', 'category', 'result_format', 'checklist'],
  additionalProperties: false,
} as const;

export function validateInput(raw: unknown): ComposeInput {
  const v = raw as Partial<ComposeInput> | null;
  const title = typeof v?.title === 'string' ? v.title.trim() : '';
  const brief = typeof v?.brief === 'string' ? v.brief.trim() : '';
  if (title.length < 3 || title.length > 80) throw new ComposeError('invalid_input', 'title must be 3–80 chars');
  if (brief.length < 1 || brief.length > 400) throw new ComposeError('invalid_input', 'brief must be 1–400 chars');
  const kind = v?.kind && ['online', 'nearby', 'campus'].includes(v.kind) ? v.kind : 'online';
  const category = typeof v?.category === 'string' && (CATEGORIES as readonly string[]).includes(v.category) ? v.category : null;
  return { title, brief, kind, category };
}

function normalize(out: ComposeResult): ComposeResult {
  return {
    description: out.description.trim().slice(0, 4000),
    category: (CATEGORIES as readonly string[]).includes(out.category) ? out.category : 'other',
    result_format: (RESULT_FORMATS as readonly string[]).includes(out.result_format) ? out.result_format : 'text',
    checklist: out.checklist
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6)
      .map((s) => s.slice(0, 200)),
  };
}

export async function composeTask(client: MessagesClient, input: ComposeInput): Promise<ComposeResult> {
  const kindHint = {
    online: 'Задача выполняется онлайн.',
    nearby: 'Задача выполняется рядом, на месте: исполнитель приходит в точку на карте и подтверждает прибытие.',
    campus: 'Задача для студентов того же вуза.',
  }[input.kind ?? 'online'];

  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      // Отказ классификатора безопасности автоматически переотправляется на рекомендованную модель
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Короткий черновик в интерфейсе: низкое усилие даёт быстрый ответ
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content:
            `${kindHint}\nНазвание: ${input.title}\nКраткая инструкция: ${input.brief}` +
            (input.category ? `\nКатегория, выбранная заказчиком: ${input.category}` : ''),
        },
      ],
    });
  } catch (e) {
    throw new ComposeError('upstream', (e as Error).message);
  }

  if (response.stop_reason === 'refusal') throw new ComposeError('refused', 'request was declined');
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new ComposeError('bad_output', 'empty response');
  let parsed: ComposeResult;
  try {
    parsed = JSON.parse(text) as ComposeResult;
  } catch {
    throw new ComposeError('bad_output', 'response is not JSON');
  }
  if (typeof parsed.description !== 'string' || !Array.isArray(parsed.checklist)) {
    throw new ComposeError('bad_output', 'unexpected shape');
  }
  return normalize(parsed);
}

/** Офлайн-заглушка для локальной разработки без ключа: детерминированный черновик */
export function offlineDraft(input: ComposeInput): ComposeResult {
  return {
    description:
      `${input.brief}\n\nЧто нужно сделать:\n— ${input.title}\n\nРезультат: аккуратный, готовый к использованию файл.\n\n` +
      'Вопросы к заказчику: есть ли примеры или требования к оформлению?',
    category: (input.category as ComposeResult['category']) ?? 'other',
    result_format: 'text',
    checklist: ['Сделано по инструкции', 'Без ошибок и опечаток', 'Сдано в срок'],
  };
}
