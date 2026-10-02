/** Справочники домена. Подписи — в i18n по ключу `<group>.<id>`. */

export const TASK_KINDS = ['online', 'nearby', 'campus'] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const CATEGORIES = [
  'design',
  'code',
  'writing',
  'marketing',
  'video',
  'study',
  'research',
  'translation',
  'photo',
  'music',
  '3d',
  'animation',
  'presentations',
  'data',
  'mobile',
  'gamedev',
  'ai',
  'tutor',
  'legal',
  'finance',
  'business',
  'voiceover',
  'podcast',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const RESULT_FORMATS = ['pptx', 'pdf', 'jpg', 'text', 'photo', 'checkin'] as const;
export type ResultFormat = (typeof RESULT_FORMATS)[number];

export const DEADLINES = ['1h', '24h', '3d'] as const;
export type Deadline = (typeof DEADLINES)[number];
export const DEADLINE_MINUTES: Record<Deadline, number> = { '1h': 60, '24h': 1440, '3d': 4320 };

export const NEARBY_RADII_M = [100, 250, 500] as const;
export type NearbyRadius = (typeof NEARBY_RADII_M)[number];

export const TASK_STATUSES = ['open', 'in_progress', 'review', 'completed', 'archived'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const SORTS = ['recommended', 'newest', 'highest_pay', 'deadline', 'distance', 'best_match'] as const;
export type FeedSort = (typeof SORTS)[number];

export const LIMITS = {
  titleMax: 80,
  briefMax: 400,
  coverLetterMin: 20,
  passwordMin: 8,
  minAge: 16,
  payoutMinAge: 18,
  /** Открытая задача без исполнителя становится просроченной через N дней */
  openTaskTtlDays: 7,
} as const;
