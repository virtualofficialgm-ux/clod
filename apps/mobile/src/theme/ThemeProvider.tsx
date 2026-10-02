import { themes, type ThemeColors, type ThemeName } from '@parri/ui';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';

export type ThemePref = 'system' | ThemeName;

interface ThemeContextValue {
  name: ThemeName;
  colors: ThemeColors;
  themePref: ThemePref;
  setThemePref: (p: ThemePref) => void;
  /** Системная настройка или ручное переключение на витрине */
  reduceTransparency: boolean;
  reduceMotion: boolean;
  forceReduceTransparency: boolean;
  forceReduceMotion: boolean;
  setForceReduceTransparency: (v: boolean) => void;
  setForceReduceMotion: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Подписка на системный флаг доступности (iOS: прозрачность, iOS/Android: движение) */
function useA11yFlag(
  read: (() => Promise<boolean>) | undefined,
  event: 'reduceTransparencyChanged' | 'reduceMotionChanged',
): boolean {
  const [value, setValue] = useState(false);
  useEffect(() => {
    // На вебе и части платформ метода нет — считаем, что настройка выключена
    if (typeof read !== 'function') return;
    let alive = true;
    read()
      .then((v) => alive && setValue(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(event, setValue);
    return () => {
      alive = false;
      sub.remove();
    };
  }, [read, event]);
  return value;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [themePref, setThemePref] = useState<ThemePref>('system');
  const [forceReduceTransparency, setForceReduceTransparency] = useState(false);
  const [forceReduceMotion, setForceReduceMotion] = useState(false);

  const sysTransparency = useA11yFlag(
    AccessibilityInfo.isReduceTransparencyEnabled,
    'reduceTransparencyChanged',
  );
  const sysMotion = useA11yFlag(AccessibilityInfo.isReduceMotionEnabled, 'reduceMotionChanged');

  const name: ThemeName = themePref === 'system' ? (system === 'dark' ? 'dark' : 'light') : themePref;
  const reduceMotion = sysMotion || forceReduceMotion;

  const value = useMemo<ThemeContextValue>(
    () => ({
      name,
      colors: themes[name],
      themePref,
      setThemePref,
      reduceTransparency: sysTransparency || forceReduceTransparency,
      reduceMotion,
      forceReduceTransparency,
      forceReduceMotion,
      setForceReduceTransparency,
      setForceReduceMotion,
    }),
    [name, themePref, sysTransparency, forceReduceTransparency, reduceMotion, forceReduceMotion],
  );

  return (
    <ThemeContext.Provider value={value}>
      <ReducedMotionConfig mode={reduceMotion ? ReduceMotion.Always : ReduceMotion.System} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
