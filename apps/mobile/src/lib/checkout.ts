import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

/** Адрес сайта для возврата из Stripe (на телефоне страница закрывается сама или пользователем) */
export function returnUrl(path: string): string {
  if (Platform.OS === 'web' && typeof location !== 'undefined') return `${location.origin}${path}`;
  return `${process.env.EXPO_PUBLIC_SITE_URL ?? 'http://localhost:3000'}${path}`;
}

/**
 * Открыть страницу Stripe (Checkout, Connect, портал). На вебе — переход в этой вкладке
 * (Stripe вернёт обратно), на телефоне — встроенный браузер; после закрытия статус проверяется опросом.
 */
export async function openProviderPage(url: string): Promise<'returned' | 'navigated'> {
  if (Platform.OS === 'web') {
    location.assign(url);
    return 'navigated';
  }
  await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET });
  return 'returned';
}
