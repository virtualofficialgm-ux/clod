'use client';

import { useEffect, useState } from 'react';

/** Обратный отсчёт до повторной отправки кода */
export function useCooldown(seconds = 60) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((v) => v - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);
  return { left, start: () => setLeft(seconds) };
}
