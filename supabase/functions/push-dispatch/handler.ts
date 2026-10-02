/**
 * Рассылка push через Expo Push API: берёт пачку неотправленных уведомлений (svc_push_batch)
 * и отправляет по токенам устройств. Вызывается по расписанию (cron) или вебхуком базы.
 * Чистая логика без Deno — тесты и dev-шлюз используют её напрямую.
 */

export interface PushRow {
  id: number;
  user_id: string;
  kind: string;
  payload: Record<string, unknown>;
  actor_name: string | null;
  task_id: string | null;
  tokens: string[];
}

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: { kind: string; task_id: string | null; id: number };
}

/** Короткие тексты push (полный текст — в приложении) */
const TITLES: Record<string, string> = {
  new_response: 'Новый отклик',
  executor_assigned: 'Вас выбрали исполнителем',
  task_taken: 'Задачу взяли',
  work_submitted: 'Работа сдана на проверку',
  work_accepted: 'Работа принята',
  revision_requested: 'Нужна доработка',
  new_message: 'Новое сообщение',
  direct_message: 'Личное сообщение',
  task_invitation: 'Приглашение в задачу',
  skill_task: 'Задача по вашим навыкам',
  dispute_resolved: 'Спор решён',
  support_reply: 'Ответ поддержки',
};

export function buildMessages(rows: PushRow[]): ExpoMessage[] {
  const out: ExpoMessage[] = [];
  for (const r of rows) {
    const title = TITLES[r.kind] ?? 'Parri';
    const what = typeof r.payload.title === 'string' ? r.payload.title : typeof r.payload.body === 'string' ? r.payload.body : '';
    const body = [r.actor_name, what].filter(Boolean).join(' · ').slice(0, 178) || 'Откройте приложение';
    for (const to of r.tokens) {
      if (!/^Expo(nent)?PushToken\[.+\]$/.test(to)) continue;
      out.push({ to, title, body, sound: 'default', data: { kind: r.kind, task_id: r.task_id, id: r.id } });
    }
  }
  return out;
}

/** Отправка пачками по 100 (лимит Expo) */
export async function dispatch(rows: PushRow[], send: (batch: ExpoMessage[]) => Promise<void>): Promise<number> {
  const messages = buildMessages(rows);
  for (let i = 0; i < messages.length; i += 100) await send(messages.slice(i, i + 100));
  return messages.length;
}
