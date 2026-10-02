import { describe, expect, it } from 'vitest';
import {
  ageOn,
  fieldErrors,
  profileStepSchema,
  responseFormSchema,
  reviewSchema,
  submissionSchema,
  taskDraftSchema,
} from './schemas';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('возраст 14+', () => {
  it('ровно 14 лет сегодня — можно, на день младше — нельзя', () => {
    const today = new Date();
    const exactly = new Date(today.getFullYear() - 14, today.getMonth(), today.getDate());
    const younger = new Date(exactly.getFullYear(), exactly.getMonth(), exactly.getDate() + 1);
    expect(ageOn(exactly, today)).toBe(14);
    const base = { firstName: 'Аня', lastName: 'Ли', phone: '+7 999 000-11-22' };
    expect(profileStepSchema.safeParse({ ...base, birthDate: iso(exactly) }).success).toBe(true);
    const bad = profileStepSchema.safeParse({ ...base, birthDate: iso(younger) });
    expect(bad.success).toBe(false);
    expect(fieldErrors(bad.error!).birthDate).toBe('errors.age_under_14');
  });

  it('нормализует телефон и отклоняет мусор', () => {
    const ok = profileStepSchema.parse({ firstName: 'А', lastName: 'Б', birthDate: '2004-01-01', phone: '+7 (999) 000-11-22' });
    expect(ok.phone).toBe('+79990001122');
    expect(profileStepSchema.safeParse({ firstName: 'А', lastName: 'Б', birthDate: '2004-01-01', phone: '8999' }).success).toBe(false);
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
