import { z } from 'zod';
import { CATEGORIES, DEADLINES, LIMITS, NEARBY_RADII_M, RESULT_FORMATS, TASK_KINDS } from './constants';
import { MAX_REWARD_CENTS, MIN_REWARD_CENTS } from './money';

/**
 * Схемы форм. Сообщения об ошибках — ключи локализации (errors.*), интерфейс переводит их через t().
 * Сервер проверяет те же правила повторно (constraints и RPC в миграциях).
 */

export const emailSchema = z.string().trim().toLowerCase().email('errors.email_invalid');
export const passwordSchema = z
  .string()
  .min(LIMITS.passwordMin, 'errors.password_short')
  .max(72, 'errors.password_long');
export const otpSchema = z.string().trim().regex(/^\d{6}$/, 'errors.otp_invalid');

export const accountSchema = z.object({ email: emailSchema, password: passwordSchema });
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'errors.required') });

/** Полных лет на дату today */
export function ageOn(birth: Date, today = new Date()): number {
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'errors.date_invalid')
  .refine((s) => !Number.isNaN(new Date(s + 'T00:00:00').getTime()), 'errors.date_invalid')
  .refine((s) => ageOn(new Date(s + 'T00:00:00')) >= LIMITS.minAge, 'errors.age_under_14')
  .refine((s) => ageOn(new Date(s + 'T00:00:00')) <= 120, 'errors.date_invalid');

export const phoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s()-]/g, ''))
  .pipe(z.string().regex(/^\+[1-9]\d{6,14}$/, 'errors.phone_invalid'));

export const profileStepSchema = z.object({
  firstName: z.string().trim().min(1, 'errors.required').max(50, 'errors.too_long'),
  lastName: z.string().trim().min(1, 'errors.required').max(50, 'errors.too_long'),
  birthDate: birthDateSchema,
  phone: phoneSchema,
  locale: z.enum(['ru']).default('ru'),
});
export type ProfileStepInput = z.input<typeof profileStepSchema>;

export const skillsStepSchema = z.object({
  skills: z.array(z.string()).max(20, 'errors.too_many'),
  universityId: z.number().int().positive().nullable(),
});

const urlSchema = z
  .string()
  .trim()
  .regex(/^https?:\/\/\S+$/i, 'errors.url_invalid')
  .max(500, 'errors.too_long');

export const taskDraftSchema = z
  .object({
    title: z.string().trim().min(3, 'errors.title_short').max(LIMITS.titleMax, 'errors.title_long'),
    brief: z.string().trim().min(1, 'errors.required').max(LIMITS.briefMax, 'errors.brief_long'),
    description: z.string().trim().max(4000, 'errors.too_long').optional().default(''),
    category: z.enum(CATEGORIES, 'errors.required'),
    resultFormat: z.enum(RESULT_FORMATS, 'errors.required'),
    checklist: z
      .array(z.string().trim().min(1, 'errors.required').max(200, 'errors.too_long'))
      .max(10, 'errors.too_many'),
    deadline: z.enum(DEADLINES, 'errors.required'),
    kind: z.enum(TASK_KINDS),
    rewardCents: z
      .number('errors.reward_range')
      .int('errors.reward_range')
      .min(MIN_REWARD_CENTS, 'errors.reward_range')
      .max(MAX_REWARD_CENTS, 'errors.reward_range'),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    radiusM: z
      .number()
      .refine((v) => (NEARBY_RADII_M as readonly number[]).includes(v), 'errors.required')
      .nullable()
      .optional(),
    placeName: z.string().trim().max(120, 'errors.too_long').optional().default(''),
  })
  .superRefine((v, ctx) => {
    if (v.kind === 'nearby') {
      if (v.lat == null || v.lng == null) ctx.addIssue({ code: 'custom', path: ['lat'], message: 'errors.location_required' });
      if (v.radiusM == null) ctx.addIssue({ code: 'custom', path: ['radiusM'], message: 'errors.required' });
    }
  });
export type TaskDraftInput = z.input<typeof taskDraftSchema>;
export type TaskDraft = z.output<typeof taskDraftSchema>;

export const responseFormSchema = z.object({
  coverLetter: z
    .string()
    .trim()
    .min(LIMITS.coverLetterMin, 'errors.cover_short')
    .max(2000, 'errors.too_long'),
  priceCents: z
    .number('errors.reward_range')
    .int('errors.reward_range')
    .min(MIN_REWARD_CENTS, 'errors.reward_range')
    .max(MAX_REWARD_CENTS, 'errors.reward_range'),
  deadline: z.enum(DEADLINES),
  skills: z.array(z.string()).max(10, 'errors.too_many').default([]),
  portfolioLinks: z.array(urlSchema).max(5, 'errors.too_many').default([]),
  ready: z.enum(['now', 'in_1h', 'today', 'tomorrow']).default('now'),
});
export type ResponseFormInput = z.input<typeof responseFormSchema>;

export const submissionSchema = z
  .object({
    link: z.union([urlSchema, z.literal('')]).optional().default(''),
    comment: z.string().trim().max(2000, 'errors.too_long').optional().default(''),
    fileCount: z.number().int().min(0).max(10, 'errors.too_many').default(0),
  })
  .refine((v) => v.link !== '' || v.comment !== '' || v.fileCount > 0, {
    message: 'errors.submission_empty',
    path: ['link'],
  });

export const reviewSchema = z
  .object({
    decision: z.enum(['accept', 'revision', 'dispute']),
    checklist: z.array(z.boolean()),
    comment: z.string().trim().max(2000, 'errors.too_long').optional().default(''),
  })
  .superRefine((v, ctx) => {
    if (v.decision === 'accept' && v.checklist.some((x) => !x)) {
      ctx.addIssue({ code: 'custom', path: ['checklist'], message: 'errors.checklist_incomplete' });
    }
    if (v.decision !== 'accept' && v.comment.length < 10) {
      ctx.addIssue({ code: 'custom', path: ['comment'], message: 'errors.reason_required' });
    }
  });

export const messageSchema = z.object({
  body: z.string().trim().max(4000, 'errors.too_long'),
});

export const savedSearchNameSchema = z.string().trim().min(1, 'errors.required').max(60, 'errors.too_long');

/** Первая ошибка по каждому полю: { field: 'errors.key' } */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
