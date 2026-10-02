import ru from './ru.json';

/** Словарь по умолчанию задаёт форму всех остальных языков */
export type Dictionary = typeof ru;
export type Locale = 'ru';

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<Dictionary>;

const dictionaries: Record<Locale, Dictionary> = { ru };

export const DEFAULT_LOCALE: Locale = 'ru';

function lookup(dict: Dictionary, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split('.')) {
    if (node && typeof node === 'object' && part in node) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === 'string' ? node : undefined;
}

export function createT(locale: Locale = DEFAULT_LOCALE) {
  const dict = dictionaries[locale];
  return function t(key: TranslationKey, params?: Record<string, string | number>): string {
    const raw = lookup(dict, key) ?? key;
    if (!params) return raw;
    return raw.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
  };
}

export const t = createT();
export { ru };

/** Есть ли текст ошибки errors.<code> (для кодов из RPC) */
export function hasErrorText(code: string): boolean {
  return lookup(dictionaries[DEFAULT_LOCALE], `errors.${code}`) !== undefined;
}
