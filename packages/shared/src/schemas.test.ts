import { describe, expect, it } from 'vitest';
import { passwordStrength } from './catalog';
import {
  ageOn,
  fieldErrors,
  bioSchema,
  personalStepSchema,
  phoneSchema,
  responseFormSchema,
  usernameSchema,
  reviewSchema,
  submissionSchema,
  taskDraftSchema,
} from './schemas';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('возраст 16+', () => {
  it('ровно 16 лет сегодня — можно, на день младше — нельзя', () => {
    const today = new Date();
    const exactly = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate());
    const younger = new Date(exactly.getFullYear(), exactly.getMonth(), exactly.getDate() + 1);
    expect(ageOn(exactly, today)).toBe(16);
    const base = { firstName: 'Аня', lastName: 'Ли', displayName: 'Аня Л.' };
    expect(personalStepSchema.safeParse({ ...base, birthDate: iso(exactly) }).success).toBe(true);
    const bad = personalStepSchema.safeParse({ ...base, birthDate: iso(younger) });
    expect(bad.success).toBe(false);
    expect(fieldErrors(bad.error!).birthDate).toBe('errors.age_under_16');
  });

  it('нормализует телефон и отклоняет мусор', () => {
    expect(phoneSchema.parse('+7 (999) 000-11-22')).toBe('+79990001122');
    expect(phoneSchema.safeParse('8999').success).toBe(false);
  });

  it('имя пользователя и «о себе»', () => {
    expect(usernameSchema.parse('Neo_One')).toBe('neo_one');
    expect(usernameSchema.safeParse('ab').success).toBe(false);
    expect(bioSchema.safeParse('').success).toBe(true);
    expect(bioSchema.safeParse('коротко').success).toBe(false);
    expect(bioSchema.safeParse('x'.repeat(40)).success).toBe(true);
  });

  it('надёжность пароля', () => {
    expect(passwordStrength('12345678')).toBe(0);
    expect(passwordStrength('parridemo123')).toBe(1);
    expect(passwordStrength('Parri-Demo-2026!')).toBe(2);
  });
});

describe('форма задачи', () => {
  const base = {
    title: 'Сверстать слайды', brief: 'Коротко', category: 'design', resultFormat: 'pptx',
    checklist: ['A'], deadline: '24h', kind: 'online', rewardCents: 2500,
  } as const;

  it('ограничения длины и бюджета', () => {
    expect(taskDraftSchema.safeParse(base).success).toBe(true);
    const e = fieldErrors(taskDraftSchema.safeParse({ ...base, title: 'x'.repeat(81), brief: 'y'.repeat(401), rewardCents: 50 }).error!);
    expect(e).toMatchObject({ title: 'errors.title_long', brief: 'errors.brief_long', rewardCents: 'errors.reward_range' });
    expect(taskDraftSchema.safeParse({ ...base, rewardCents: 1_000_001 }).success).toBe(false);
  });

  it('«Рядом» требует точку и радиус', () => {
    const r = taskDraftSchema.safeParse({ ...base, kind: 'nearby' });
    expect(fieldErrors(r.error!)).toMatchObject({ lat: 'errors.location_required', radiusM: 'errors.required' });
    expect(taskDraftSchema.safeParse({ ...base, kind: 'nearby', lat: 55.7, lng: 37.6, radiusM: 250 }).success).toBe(true);
    expect(taskDraftSchema.safeParse({ ...base, kind: 'nearby', lat: 55.7, lng: 37.6, radiusM: 300 }).success).toBe(false);
  });
});

describe('отклик, сдача, приёмка', () => {
  it('сопроводительное от 20 символов, ссылки только http(s)', () => {
    const base = { priceCents: 2000, deadline: '24h' } as const;
    expect(fieldErrors(responseFormSchema.safeParse({ ...base, coverLetter: 'коротко' }).error!).coverLetter).toBe('errors.cover_short');
    const r = responseFormSchema.safeParse({ ...base, coverLetter: 'Достаточно длинное письмо', portfolioLinks: ['javascript:alert(1)'] });
    expect(r.success).toBe(false);
  });

  it('пустая сдача запрещена', () => {
    expect(submissionSchema.safeParse({}).success).toBe(false);
    expect(submissionSchema.safeParse({ link: 'https://x.y' }).success).toBe(true);
    expect(submissionSchema.safeParse({ fileCount: 1 }).success).toBe(true);
  });

  it('принять — только с полным чек-листом; доработка и спор — только с причиной', () => {
    expect(reviewSchema.safeParse({ decision: 'accept', checklist: [true, false] }).success).toBe(false);
    expect(reviewSchema.safeParse({ decision: 'accept', checklist: [true, true] }).success).toBe(true);
    expect(fieldErrors(reviewSchema.safeParse({ decision: 'revision', checklist: [], comment: 'нет' }).error!).comment).toBe('errors.reason_required');
    expect(reviewSchema.safeParse({ decision: 'dispute', checklist: [], comment: 'Работа не по заданию' }).success).toBe(true);
  });
});
