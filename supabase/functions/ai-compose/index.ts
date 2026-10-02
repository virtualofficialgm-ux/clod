// Supabase Edge Function (Deno). Ключ ANTHROPIC_API_KEY — только в секретах функций:
//   supabase secrets set ANTHROPIC_API_KEY=...
// JWT пользователя проверяет платформа (verify_jwt = true в config.toml).
import Anthropic from 'npm:@anthropic-ai/sdk@^0.131.0';
import { corsHeaders } from '../_shared/cors.ts';
import { ComposeError, composeTask, validateInput, type MessagesClient } from './handler.ts';

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') }) as unknown as MessagesClient;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  try {
    const input = validateInput(await req.json());
    return json(200, await composeTask(client, input));
  } catch (e) {
    if (e instanceof ComposeError) {
      const status = e.code === 'invalid_input' ? 400 : e.code === 'refused' ? 422 : 502;
      return json(status, { error: e.code });
    }
    return json(500, { error: 'internal' });
  }
});
