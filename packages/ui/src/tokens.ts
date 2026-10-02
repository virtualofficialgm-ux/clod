/**
 * Дизайн-токены Parri (Liquid Glass). Единый источник для веба и мобильного.
 * Веб получает их как CSS-переменные (css/tokens.css генерируется из этого файла),
 * мобильное приложение импортирует объект напрямую.
 */

export type ThemeName = 'light' | 'dark';

export const palette = {
  accent: '#FF5428',
  accentPressed: '#E8441A',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export interface ThemeColors {
  /** Фон страницы под градиент-мешем */
  background: string;
  /** Основной текст */
  text: string;
  /** Второстепенный текст */
  textSecondary: string;
  /** Подсказки, плейсхолдеры (только для крупного/вспомогательного текста) */
  textTertiary: string;
  /** Заливка главной кнопки */
  accent: string;
  accentPressed: string;
  /** Текст на акценте */
  onAccent: string;
  /** Акцент как цвет текста (цены, ссылки) — затемнён/осветлён ради контраста AA */
  accentText: string;
  /** Почти непрозрачная карточка контента */
  card: string;
  /** Карточка без прозрачности (для «Уменьшить прозрачность») */
  cardSolid: string;
  cardBorder: string;
  separator: string;
  success: string;
  warning: string;
  danger: string;
  /** Стекло */
  glassFill: string;
  /** Сплошной фолбэк стекла */
  glassSolid: string;
  glassBorderTop: string;
  glassBorderBottom: string;
  glassHighlight: string;
  glassShadow: string;
  /** Пятна фона */
  blobs: readonly [string, string, string];
  blobOpacity: number;
}

export const themes: Record<ThemeName, ThemeColors> = {
  light: {
    background: '#F4F1EC',
    text: '#0B0B0F',
    textSecondary: '#5B5B66',
    textTertiary: '#6B6B76',
    accent: palette.accent,
    accentPressed: palette.accentPressed,
    onAccent: '#FFFFFF',
    accentText: '#C93A14',
    card: 'rgba(255,255,255,0.92)',
    cardSolid: '#FFFFFF',
    cardBorder: 'rgba(11,11,15,0.06)',
    separator: 'rgba(11,11,15,0.08)',
    success: '#1E7D45',
    warning: '#9A5B00',
    danger: '#C42B1C',
    glassFill: 'rgba(255,255,255,0.45)',
    glassSolid: '#F7F5F2',
    glassBorderTop: 'rgba(255,255,255,0.7)',
    glassBorderBottom: 'rgba(255,255,255,0.1)',
    glassHighlight: 'rgba(255,255,255,0.3)',
    glassShadow: 'rgba(0,0,0,0.12)',
    blobs: ['#FF7A45', '#FFC4A3', '#9CC8FF'],
    blobOpacity: 0.75,
  },
  dark: {
    background: '#09090B',
    text: '#F5F5F7',
    textSecondary: '#A1A1AA',
    textTertiary: '#8E8E98',
    accent: palette.accent,
    accentPressed: palette.accentPressed,
    onAccent: '#FFFFFF',
    accentText: '#FF6A40',
    card: 'rgba(28,28,32,0.92)',
    cardSolid: '#1C1C20',
    cardBorder: 'rgba(255,255,255,0.08)',
    separator: 'rgba(255,255,255,0.1)',
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#FF6B5E',
    glassFill: 'rgba(30,30,35,0.40)',
    glassSolid: '#1E1E23',
    glassBorderTop: 'rgba(255,255,255,0.35)',
    glassBorderBottom: 'rgba(255,255,255,0.06)',
    glassHighlight: 'rgba(255,255,255,0.12)',
    glassShadow: 'rgba(0,0,0,0.45)',
    blobs: ['#FF5428', '#B85A3C', '#2F5D9E'],
    blobOpacity: 0.45,
  },
};

export const radii = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 28,
  xxl: 32,
  pill: 999,
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const glass = {
  blur: 24,
  saturate: 180,
  shadow: { x: 0, y: 8, blur: 32, opacity: 0.12 },
  borderWidth: 1,
} as const;

export const fonts = {
  /** Manrope поддерживает кириллицу; на iOS можно использовать системный SF Pro */
  family: 'Manrope',
  fallbackWeb:
    "'Manrope Variable', 'Manrope', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
  weights: { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' },
} as const;

export interface TextStyleToken {
  size: number;
  lineHeight: number;
  weight: '400' | '500' | '600' | '700' | '800';
  /** Трекинг в долях em (-0.02 = -2%) */
  tracking: number;
}

/** Мобильная шкала (px = pt) */
export const typeScaleMobile = {
  display: { size: 56, lineHeight: 58, weight: '800', tracking: -0.03 },
  title1: { size: 40, lineHeight: 44, weight: '800', tracking: -0.025 },
  title2: { size: 28, lineHeight: 32, weight: '700', tracking: -0.02 },
  title3: { size: 22, lineHeight: 26, weight: '700', tracking: -0.015 },
  price: { size: 32, lineHeight: 36, weight: '800', tracking: -0.02 },
  body: { size: 17, lineHeight: 24, weight: '400', tracking: -0.005 },
  bodyStrong: { size: 17, lineHeight: 24, weight: '600', tracking: -0.005 },
  callout: { size: 16, lineHeight: 22, weight: '500', tracking: 0 },
  caption: { size: 13, lineHeight: 18, weight: '600', tracking: 0 },
  /** Подпись главной кнопки: ≥18.67px bold — «крупный текст» по WCAG */
  button: { size: 19, lineHeight: 24, weight: '700', tracking: -0.01 },
} as const satisfies Record<string, TextStyleToken>;

/** Веб-шкала */
export const typeScaleWeb = {
  display: { size: 96, lineHeight: 92, weight: '800', tracking: -0.03 },
  title1: { size: 64, lineHeight: 64, weight: '800', tracking: -0.03 },
  title2: { size: 40, lineHeight: 44, weight: '800', tracking: -0.025 },
  title3: { size: 24, lineHeight: 30, weight: '700', tracking: -0.015 },
  price: { size: 36, lineHeight: 40, weight: '800', tracking: -0.02 },
  body: { size: 17, lineHeight: 26, weight: '400', tracking: -0.005 },
  bodyStrong: { size: 17, lineHeight: 26, weight: '600', tracking: -0.005 },
  callout: { size: 16, lineHeight: 22, weight: '500', tracking: 0 },
  caption: { size: 13, lineHeight: 18, weight: '600', tracking: 0 },
  button: { size: 19, lineHeight: 24, weight: '700', tracking: -0.01 },
} as const satisfies Record<string, TextStyleToken>;

export const motion = {
  /** Пружины: stiffness/damping/mass — одинаково трактуются Framer Motion и Reanimated */
  spring: {
    press: { stiffness: 500, damping: 30, mass: 0.6 },
    sheet: { stiffness: 320, damping: 34, mass: 1 },
    appear: { stiffness: 260, damping: 26, mass: 1 },
  },
  pressScale: 0.96,
  /** Длительность одного цикла движения пятен фона, мс */
  blobCycleMs: 22000,
  /** Порог «скролл начался» для шапки, px */
  headerScrollThreshold: 8,
} as const;

export const layout = {
  /** Боковой отступ на телефоне */
  gutter: 16,
  tabBarHeight: 64,
  sidebarWidth: 264,
  contentMaxWidth: 1200,
} as const;
