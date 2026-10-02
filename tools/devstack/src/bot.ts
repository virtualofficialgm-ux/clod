import {
  BotError,
  handleBot,
  type BotTask,
  type ToolClient,
} from '../../../supabase/functions/parri-bot/handler.ts';
import { withRole, type Claims } from './db.ts';

/** Бот PARRI в dev-шлюзе: та же логика, что в Edge Function, запросы — от имени пользователя */
export async function botAction(claims: Claims, body: unknown, client: ToolClient | null) {
  const message = (body as { message?: unknown } | null)?.message;
  return handleBot(
    message,
    {
      async log(role, text, tasks) {
        await withRole(claims, (c) =>
          c.query(`select public.bot_log($1, $2, $3::jsonb)`, [
            role,
            text,
            JSON.stringify(tasks ?? []),
          ]),
        );
      },
      async history() {
        const rows = await withRole(
          claims,
          async (c) =>
            (await c.query(`select role, body from public.bot_messages order by id desc limit 10`))
              .rows,
        );
        return (rows as { role: 'user' | 'assistant'; body: string }[]).reverse();
      },
      async searchTasks(f) {
        const rows = await withRole(
          claims,
          async (c) =>
            (
              await c.query(
                `select id, title, reward_cents::int, currency, category, deadline, kind
                 from public.feed_tasks(p_kind => $1, p_query => $2, p_categories => $3::public.task_category[], p_max_reward => $4, p_max_minutes => $5, p_limit => 5)`,
                [
                  f.kind ?? 'online',
                  f.query ?? null,
                  f.categories ?? null,
                  f.maxRewardCents ?? null,
                  f.maxMinutes ?? null,
                ],
              )
            ).rows,
        );
        return rows as BotTask[];
      },
    },
    client,
  );
}

export { BotError };
