/** Справочники для регистрации и профиля: профессии, языки, страны, валюты */
import type { Category } from './constants';

export const LOCALES = ['ru', 'en', 'de', 'fr', 'it', 'es'] as const;
export type UiLocale = (typeof LOCALES)[number];
export const LOCALE_NAMES: Record<UiLocale, string> = {
  ru: 'Русский',
  en: 'English',
  de: 'Deutsch',
  fr: 'Français',
  it: 'Italiano',
  es: 'Español',
};

export const DISPLAY_CURRENCIES = ['USD', 'EUR', 'RUB', 'AED', 'KZT'] as const;
export type DisplayCurrency = (typeof DISPLAY_CURRENCIES)[number];

export const EXPERIENCE_LEVELS = ['junior', 'middle', 'expert'] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const LANGUAGE_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2', 'native'] as const;
export type LanguageLevel = (typeof LANGUAGE_LEVELS)[number];

/** Рабочие языки на выбор (названия — через Intl.DisplayNames) */
export const WORK_LANGUAGES = [
  'ru', 'en', 'de', 'fr', 'it', 'es', 'pt', 'zh', 'ja', 'ko', 'ar', 'tr', 'uk', 'kk', 'uz', 'hy', 'ka', 'pl', 'cs', 'hi',
] as const;

export interface Profession {
  id: string;
  category: Category;
  /** Рекомендуемые навыки (slug из каталога) */
  skills: string[];
}

/** Каталог профессий: от профессии зависят рекомендуемые навыки на следующем шаге */
export const PROFESSIONS: Profession[] = [
  { id: 'designer', category: 'design', skills: ['figma', 'ui_ux', 'web_design', 'branding', 'logo', 'illustration'] },
  { id: 'frontend', category: 'code', skills: ['frontend', 'javascript', 'typescript', 'web_design', 'figma'] },
  { id: 'backend', category: 'code', skills: ['backend', 'python', 'sql', 'bots', 'typescript'] },
  { id: 'mobile_dev', category: 'mobile', skills: ['ios', 'android', 'flutter', 'react_native', 'mobile_dev'] },
  { id: 'gamedev', category: 'gamedev', skills: ['unity', 'unreal', 'game_design', 'modeling_3d'] },
  { id: 'data_analyst', category: 'data', skills: ['excel', 'data_analysis', 'sql', 'python', 'data_entry'] },
  { id: 'ml_engineer', category: 'ai', skills: ['ml', 'python', 'prompting', 'ai_automation', 'data_analysis'] },
  { id: 'copywriter', category: 'writing', skills: ['copywriting', 'editing', 'articles', 'proofreading', 'seo'] },
  { id: 'translator', category: 'translation', skills: ['translation_en', 'translation_other', 'proofreading', 'editing'] },
  { id: 'marketer', category: 'marketing', skills: ['smm', 'seo', 'targeting', 'content_plan', 'market_analysis'] },
  { id: 'video_editor', category: 'video', skills: ['video_editing', 'motion', 'reels', 'animation_2d'] },
  { id: 'animator', category: 'animation', skills: ['animation_2d', 'animation_3d', 'motion', 'blender'] },
  { id: '3d_artist', category: '3d', skills: ['blender', 'modeling_3d', 'rendering', 'animation_3d'] },
  { id: 'photographer', category: 'photo', skills: ['photography', 'retouch', 'reels'] },
  { id: 'musician', category: 'music', skills: ['beatmaking', 'mixing', 'songwriting'] },
  { id: 'voice_actor', category: 'voiceover', skills: ['voice_acting', 'dubbing', 'podcast_editing'] },
  { id: 'podcaster', category: 'podcast', skills: ['podcast_editing', 'podcast_hosting', 'mixing'] },
  { id: 'presentation_designer', category: 'presentations', skills: ['slides', 'pitch_decks', 'presentation_design', 'figma'] },
  { id: 'tutor', category: 'tutor', skills: ['math_tutor', 'language_tutor', 'exam_prep', 'tutoring'] },
  { id: 'student', category: 'study', skills: ['lecture_notes', 'tutoring', 'desk_research', 'slides', 'excel'] },
  { id: 'researcher', category: 'research', skills: ['desk_research', 'surveys', 'fact_checking', 'data_analysis'] },
  { id: 'lawyer', category: 'legal', skills: ['contracts', 'legal_advice'] },
  { id: 'accountant', category: 'finance', skills: ['accounting', 'financial_models', 'excel'] },
  { id: 'entrepreneur', category: 'business', skills: ['business_plans', 'market_analysis', 'sales', 'pitch_decks'] },
  { id: 'courier', category: 'other', skills: ['errands', 'mystery_shopping', 'photography'] },
];

/** ISO-коды стран (названия — через Intl.DisplayNames) */
export const COUNTRY_CODES = (
  'AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ ' +
  'DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP ' +
  'KE KG KH KI KM KN KP KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI ' +
  'NL NO NP NR NZ OM PA PE PG PH PK PL PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL ' +
  'TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW'
).split(' ');

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['ru'], { type: 'region' });
  } catch {
    return null;
  }
})();
const languageNames = (() => {
  try {
    return new Intl.DisplayNames(['ru'], { type: 'language' });
  } catch {
    return null;
  }
})();

export const countryName = (code: string) => regionNames?.of(code) ?? code;
export const languageName = (code: string) => {
  const n = languageNames?.of(code) ?? code;
  return n.charAt(0).toUpperCase() + n.slice(1);
};

/** Часовой пояс устройства */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Оценка надёжности пароля: 0 слабый, 1 средний, 2 надёжный */
export function passwordStrength(pw: string): 0 | 1 | 2 {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-zа-я]/.test(pw) && /[A-ZА-Я]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^\p{L}\p{N}]/u.test(pw)) score++;
  if (pw.length < 8 || score <= 2) return 0;
  return score >= 4 ? 2 : 1;
}
