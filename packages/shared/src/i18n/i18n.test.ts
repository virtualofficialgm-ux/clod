import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('i18n', () => {
  it('находит вложенные ключи', () => expect(t('kind.campus')).toBe('В моём вузе'));
  it('подставляет параметры', () => expect(t('distance.km', { value: '1,2' })).toBe('1,2 км'));
});
