import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, flatten } from './contrast';
import { renderTokensCss } from './css';
import { themes } from './tokens';

describe('контраст WCAG AA', () => {
  for (const [name, t] of Object.entries(themes)) {
    const card = flatten(t.card, t.background);
    const glassOnBg = flatten(t.glassFill, t.background);

    it(`${name}: основной и второстепенный текст на фоне, карточке и стекле ≥ 4.5`, () => {
      for (const surface of [t.background, card, t.cardSolid, glassOnBg, t.glassSolid]) {
        expect(contrastRatio(t.text, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(t.textSecondary, surface)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${name}: акцентный текст (цены) на карточке ≥ 4.5`, () => {
      expect(contrastRatio(t.accentText, card)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.accentText, t.cardSolid)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${name}: подпись главной кнопки (крупный жирный текст) ≥ 3`, () => {
      expect(contrastRatio(t.onAccent, t.accent)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(t.onAccent, t.accentPressed)).toBeGreaterThanOrEqual(3);
    });
  }
});

describe('tokens.css', () => {
  it('совпадает с токенами (запустите pnpm --filter @parri/ui build)', () => {
    const file = readFileSync(new URL('../css/tokens.css', import.meta.url), 'utf8');
    expect(file).toBe(renderTokensCss());
  });
});

describe('плитки и «чернила»', () => {
  for (const [name, t] of Object.entries(themes)) {
    it(`${name}: текст на плитке и на «чернилах» ≥ 4.5`, () => {
      expect(contrastRatio(t.text, t.fill)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.textSecondary, t.fill)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.onInk, t.ink)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
