import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Значения из .env (EXPO_PUBLIC_*). Локально по умолчанию — supabase start / tools/devstack.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Демо одной страницей (tools/demo): бэкенд работает во вкладке, запросы идут в него через fetch */
export const DEMO = process.env.EXPO_PUBLIC_DEMO === '1';

export const supabase = createClient(url, anonKey, {
  ...(DEMO
    ? { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => (globalThis as unknown as { __parriFetch: typeof fetch }).__parriFetch(input, init) } }
    : {}),
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Обновлять токен только пока приложение на экране (рекомендация Supabase для RN)
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
