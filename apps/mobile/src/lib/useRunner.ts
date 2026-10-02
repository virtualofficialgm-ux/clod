import { toApiError } from '@parri/shared';
import { useEffect, useState } from 'react';

/** Выполнение действия формы: занято/ошибка (ключ локализации) */
export function useRunner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(toApiError(e).key);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

export function useCooldown(seconds = 60) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return { left, start: () => setLeft(seconds) };
}
