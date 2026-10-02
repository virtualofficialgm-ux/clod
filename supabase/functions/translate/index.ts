// Supabase Edge Function (Deno): перевод сообщения. Ключ ANTHROPIC_API_KEY — в секретах функций.
import Anthropic from 'npm:@anthropic-ai/sdk@^0.131.0';
import { corsHeaders } from '../_shared/cors.ts';
import { TranslateError, translate, type TextClient } from './handler.ts';

const key = Deno.env.get('ANTHROPIC_API_KEY');
const client = key ? (new Anthropic({ apiKey: key }) as unknown as TextClient) : null;
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    return json(200, await translate(client, await req.json()));
  } catch (e) {
    if (e instanceof TranslateError) return json(e.code === 'invalid_input' ? 400 : e.code === 'unavailable' ? 503 : 502, { error: e.code });
    return json(500, { error: 'internal' });
  }
});
