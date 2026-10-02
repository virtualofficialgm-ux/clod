'use client';

/**
 * «Запомнить меня»: если снято, сессия живёт только до закрытия браузера.
 * Флаг хранится в localStorage, маркер «вкладка жива» — в sessionStorage (очищается при закрытии).
 */
const KEY = 'parri.remember';
const ALIVE = 'parri.alive';

export function setRemember(remember: boolean) {
  try {
    localStorage.setItem(KEY, remember ? '1' : '0');
    sessionStorage.setItem(ALIVE, '1');
  } catch {}
}

/** true — сессию нужно завершить (браузер перезапущен, «запомнить» было снято) */
export function shouldForgetSession(): boolean {
  try {
    const forget = localStorage.getItem(KEY) === '0' && !sessionStorage.getItem(ALIVE);
    sessionStorage.setItem(ALIVE, '1');
    return forget;
  } catch {
    return false;
  }
}
