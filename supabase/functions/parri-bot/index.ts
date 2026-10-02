// Supabase Edge Function (Deno): бот PARRI. Ключ ANTHROPIC_API_KEY — в секретах функций.
// Запросы к базе идут от имени пользователя (его JWT), поэтому RLS и проверка Pro работают как в приложении.
import Anthropic from 'npm:@anthropic-ai/sdk@^0.131.0';
import { createClient } from 'npm:@supabase/supabase-js@^2.117.2';
import { corsHeaders } from '../_shared/cors.ts';
import { BotError, handleBot, type BotTask, type ToolClient } from './handler.ts';

const key = Deno.env.get('ANTHROPIC_API_KEY');
const claude = key ? (new Anthropic({ apiKey: key }) as unknown as ToolClient) : null;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  try {
    const { message } = await req.json();
    const out = await handleBot(
      message,
      {
        async log(role, body, tasks) {
          const { error } = await sb.rpc('bot_log', {
            p_role: role,
            p_body: body,
            p_tasks: tasks ?? [],
          });
          if (error) throw new Error(error.message);
        },
        async history() {
          const { data } = await sb
            .from('bot_messages')
            .select('role, body')
            .order('id', { ascending: false })
            .limit(10);
          return (data ?? []).reverse();
        },
        async searchTasks(f) {
          const { data, error } = await sb.rpc('feed_tasks', {
            p_kind: f.kind ?? 'online',
            p_query: f.query ?? null,
            p_categories: f.categories ?? null,
            p_max_reward: f.maxRewardCents ?? null,
            p_max_minutes: f.maxMinutes ?? null,
            p_limit: 5,
          });
          if (error) throw new Error(error.message);
          return (data ?? []) as BotTask[];
        },
      },
      claude,
    );
    return json(200, out);
  } catch (e) {
    if (e instanceof BotError)
      return json(e.code === 'invalid_input' ? 400 : e.code === 'bot_requires_pro' ? 403 : 502, {
        error: e.code,
      });
    return json(500, { error: 'internal' });
  }
});
