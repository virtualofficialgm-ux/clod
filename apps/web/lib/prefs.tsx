'use client';

import { MotionConfig, useReducedMotion } from 'framer-motion';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemePref = 'system' | 'light' | 'dark';
export type ReducePref = 'system' | 'reduce';

interface Prefs {
  theme: ThemePref;
  transparency: ReducePref;
  motion: ReducePref;
}

interface PrefsContextValue extends Prefs {
  set: (patch: Partial<Prefs>) => void;
}

const STORAGE_KEY = 'parri.prefs';
const DEFAULTS: Prefs = { theme: 'system', transparency: 'system', motion: 'system' };

const PrefsContext = createContext<PrefsContextValue>({ ...DEFAULTS, set: () => {} });

function readStored(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function apply(p: Prefs) {
  const root = document.documentElement;
  const attr = (name: string, value: string | null) =>
    value ? root.setAttribute(name, value) : root.removeAttribute(name);
  attr('data-theme', p.theme === 'system' ? null : p.theme);
  attr('data-transparency', p.transparency === 'reduce' ? 'reduce' : null);
  attr('data-motion', p.motion === 'reduce' ? 'reduce' : null);
}

/**
 * Скрипт до гидратации: выставляет тему из localStorage, чтобы не было вспышки.
 * Вставляется в <head> как строка.
 */
export const prefsBootScript = `(function(){try{var p=JSON.parse(localStorage.getItem('${STORAGE_KEY}')||'{}');var r=document.documentElement;if(p.theme&&p.theme!=='system')r.setAttribute('data-theme',p.theme);if(p.transparency==='reduce')r.setAttribute('data-transparency','reduce');if(p.motion==='reduce')r.setAttribute('data-motion','reduce');}catch(e){}})();`;

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    setPrefs(readStored());
    // Маркер для e2e-тестов: React гидратировал страницу
    document.documentElement.dataset.hydrated = 'true';
  }, []);

  const set = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // приватный режим — настройки живут до перезагрузки
      }
      apply(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ ...prefs, set }), [prefs, set]);

  return (
    <PrefsContext.Provider value={value}>
      <MotionConfig reducedMotion={prefs.motion === 'reduce' ? 'always' : 'user'}>
        {children}
      </MotionConfig>
    </PrefsContext.Provider>
  );
}

export const usePrefs = () => useContext(PrefsContext);

/** true, если движение нужно отключить (система или ручная настройка) */
export function useMotionReduced(): boolean {
  const system = useReducedMotion();
  const { motion } = usePrefs();
  return motion === 'reduce' || Boolean(system);
}
