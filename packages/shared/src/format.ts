import { t } from './i18n';

/** 340 → «340 м», 1234 → «1,2 км» */
export function formatDistance(meters: number, locale = 'ru-RU'): string {
  if (meters < 1000) return t('distance.m', { value: Math.round(meters / 10) * 10 });
  const km = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(meters / 1000);
  return t('distance.km', { value: km });
}

/** «2 ч 15 мин», «3 дн», «12 мин» */
export function formatDuration(ms: number): string {
  const min = Math.max(0, Math.round(Math.abs(ms) / 60000));
  if (min < 60) return t('time.minutes', { n: min });
  const h = Math.floor(min / 60);
  if (h < 48) {
    const m = min % 60;
    return m ? `${t('time.hours', { n: h })} ${t('time.minutes', { n: m })}` : t('time.hours', { n: h });
  }
  return t('time.days', { n: Math.floor(h / 24) });
}

/** «осталось 2 ч» / «просрочено на 10 мин» */
export function formatTimeLeft(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  return diff >= 0 ? t('time.left', { v: formatDuration(diff) }) : t('time.overdue', { v: formatDuration(diff) });
}

/** «5 мин назад» / «только что» */
export function formatAgo(iso: string, now = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  if (diff < 60_000) return t('time.justNow');
  return t('time.ago', { v: formatDuration(diff) });
}

/** «12 окт., 18:30» */
export function formatDateTime(iso: string, locale = 'ru-RU'): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** «Иван П.» */
export function shortName(first?: string | null, last?: string | null): string {
  return [first ?? '', last ? `${last[0]}.` : ''].join(' ').trim() || '—';
}

/** Доллары из строки ввода → центы (null, если не число) */
export function parseDollars(input: string): number | null {
  const s = input.replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
