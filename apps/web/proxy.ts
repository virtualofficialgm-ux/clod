import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';

/** Разделы приложения, куда без входа нельзя */
const PROTECTED = [
  '/dashboard', '/feed', '/nearby', '/tasks', '/my-tasks', '/messages', '/balance', '/account', '/people', '/saved', '/receipt', '/responses', '/notifications', '/connections', '/settings', '/u',
  '/u', '/notifications', '/settings', '/support', '/disputes', '/verification', '/subscription', '/assistant', '/admin',
];
/** Страницы входа: вошедшего пользователя отправляем в ленту */
const AUTH_ONLY_GUEST = ['/login', '/reset'];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  // Обновляет токен при необходимости и проверяет его на сервере авторизации
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!user && PROTECTED.some((p) => path === p || path.startsWith(p + '/'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  if (user && AUTH_ONLY_GUEST.includes(path)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)'],
};
