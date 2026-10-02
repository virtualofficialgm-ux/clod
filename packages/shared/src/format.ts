import { t } from './i18n';

/** 340 → «340 м», 1234 → «1,2 км» */
export function formatDistance(meters: number, locale = 'ru-RU'): string {
  if (meters < 1000) return t('distance.m', { value: Math.round(meters / 10) * 10 });
  const km = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(meters / 1000);
  return t('distance.km', { value: km });
}
