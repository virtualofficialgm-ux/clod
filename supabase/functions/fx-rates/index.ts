// Курсы ЦБ РФ для отображения цен в рублях (и других валютах). Запускается по расписанию (cron) раз в час.
import { paymentsDb, serviceClient } from '../_shared/service.ts';
import { ratesFromCbr } from '../payments/handler.ts';

Deno.serve(async () => {
  const res = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
  if (!res.ok) return Response.json({ error: 'cbr_unavailable' }, { status: 502 });
  const rates = ratesFromCbr(await res.json());
  const n = await paymentsDb(serviceClient()).rpc('svc_set_rates', { p_rates: rates, p_source: 'cbr' });
  return Response.json({ updated: n, rates });
});
