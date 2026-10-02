// Supabase Edge Function (Deno): рассылка push. Запускать по расписанию (pg_cron → net.http_post) раз в минуту.
// Ключ доступа Expo (EXPO_ACCESS_TOKEN) необязателен; SERVICE_ROLE — только в секретах.
import { serviceClient } from '../_shared/service.ts';
import { dispatch, type PushRow } from './handler.ts';

Deno.serve(async () => {
  const sb = serviceClient();
  const { data, error } = await sb.rpc('svc_push_batch', { p_limit: 300 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  const token = Deno.env.get('EXPO_ACCESS_TOKEN');
  const sent = await dispatch((data ?? []) as PushRow[], async (batch) => {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(batch),
    });
  });
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } });
});
