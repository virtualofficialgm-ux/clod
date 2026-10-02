import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Category, Deadline } from './constants';
import { hasErrorText } from './i18n';
import type { TaskDraft } from './schemas';
import type {
  ComposeResult,
  Experience,
  FeedParams,
  FeedTask,
  FileRef,
  LedgerEntry,
  Message,
  MyTask,
  PortfolioItem,
  Profile,
  ProfileData,
  ProfilePrivate,
  ReadyWhen,
  ResponseWithExecutor,
  SavedSearch,
  Skill,
  Submission,
  Task,
  ComplaintReason,
  Review,
  ReviewWithAuthor,
  TaskDetail,
  TaskDraftRow,
  TaskExtension,
  TaskQuestion,
  TaskResponse,
  University,
  Wallet,
} from './types';

/**
 * Типизированный доступ к бэкенду поверх supabase-js. Общий для веба и мобильного.
 * Все изменения состояния идут через RPC (проверки прав и деньги — на сервере).
 */

export type Client = SupabaseClient;

/** Ошибка с ключом локализации (errors.*) */
export class ApiError extends Error {
  constructor(
    public key: string,
    message?: string,
  ) {
    super(message ?? key);
  }
}

const KNOWN = [
  'insufficient_funds', 'age_under_14', 'invalid_birth_date', 'onboarding_incomplete', 'account_blocked',
  'not_authenticated', 'reward_out_of_range', 'university_required', 'location_required', 'invalid_radius',
  'invalid_checklist', 'invalid_files', 'own_task', 'task_not_open', 'already_responded', 'response_locked',
  'response_not_pending', 'invalid_status', 'empty_submission', 'checklist_incomplete', 'reason_required',
  'forbidden', 'invalid_link', 'profile_step_required', 'task_not_found',
  // auth
  'invalid_credentials', 'email_not_confirmed', 'otp_expired', 'weak_password', 'user_already_exists',
  'over_email_send_rate_limit', 'over_request_rate_limit', 'same_password',
] as const;

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const err = e as { message?: string; code?: string; status?: number } | null;
  const text = `${err?.code ?? ''} ${err?.message ?? ''}`;
  const hit = KNOWN.find((k) => text.includes(k));
  if (hit) return new ApiError(`errors.${hit}`, err?.message);
  // Коды из RPC вида raise exception 'some_code' — если для них есть текст в errors.*
  const code = /^([a-z][a-z0-9_]+)(?::|$)/.exec(err?.message ?? '')?.[1];
  if (code && hasErrorText(code)) return new ApiError(`errors.${code}`, err?.message);
  if (err?.code === '23505') return new ApiError('errors.already_responded', err.message);
  if (err?.code === '23514') return new ApiError('errors.check_failed', err.message);
  if (err?.status === 429) return new ApiError('errors.over_request_rate_limit', err.message);
  if (/fetch|network|Failed to fetch/i.test(text)) return new ApiError('errors.network', err?.message);
  return new ApiError('errors.unknown', err?.message);
}

export async function unwrap<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw toApiError(error);
  return data as T;
}

// ---------- Auth ----------

export const auth = {
  /** Шаг «Аккаунт»: email + пароль, на почту уходит код из 6 цифр */
  async signUp(sb: Client, email: string, password: string, locale = 'ru') {
    const { data, error } = await sb.auth.signUp({ email, password, options: { data: { locale } } });
    if (error) throw toApiError(error);
    return data;
  },
  /** Регистрация по шагам: код на email (аккаунт создаётся, если его нет), пароль задаётся после кода */
  async startEmail(sb: Client, email: string, locale = 'ru') {
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true, data: { locale } } });
    if (error) throw toApiError(error);
  },
  async verifyEmail(sb: Client, email: string, token: string) {
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw toApiError(error);
    return data;
  },
  /** Вход через Google / Apple (нужно включить провайдера в Supabase) */
  async signInWithProvider(sb: Client, provider: 'google' | 'apple', redirectTo?: string) {
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) throw toApiError(error);
  },
  async verifySignup(sb: Client, email: string, token: string) {
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'signup' });
    if (error) throw toApiError(error);
    return data;
  },
  async resendSignup(sb: Client, email: string) {
    const { error } = await sb.auth.resend({ type: 'signup', email });
    if (error) throw toApiError(error);
  },
  async signIn(sb: Client, email: string, password: string) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw toApiError(error);
    return data;
  },
  /** Вход по коду из письма (без пароля) */
  async sendLoginCode(sb: Client, email: string) {
    const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) throw toApiError(error);
  },
  async verifyLoginCode(sb: Client, email: string, token: string) {
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw toApiError(error);
    return data;
  },
  async requestReset(sb: Client, email: string) {
    const { error } = await sb.auth.resetPasswordForEmail(email);
    if (error) throw toApiError(error);
  },
  async verifyReset(sb: Client, email: string, token: string) {
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'recovery' });
    if (error) throw toApiError(error);
    return data;
  },
  async updatePassword(sb: Client, password: string) {
    const { error } = await sb.auth.updateUser({ password });
    if (error) throw toApiError(error);
  },
  async signOut(sb: Client) {
    await sb.auth.signOut();
  },
};

// ---------- Профиль ----------

export interface Me {
  profile: Profile;
  private: ProfilePrivate;
  skills: string[];
  wallet: Wallet;
  university: University | null;
}

export const profile = {
  async me(sb: Client): Promise<Me | null> {
    const { data: userData } = await sb.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) return null;
    const [p, priv, skills, wallet] = await Promise.all([
      unwrap<Profile>(sb.from('profiles').select('*').eq('id', uid).single()),
      unwrap<ProfilePrivate>(sb.from('profile_private').select('*').eq('id', uid).single()),
      unwrap<{ skill_slug: string }[]>(sb.from('profile_skills').select('skill_slug').eq('profile_id', uid).order('sort')),
      unwrap<Wallet>(sb.from('wallets').select('*').eq('user_id', uid).single()),
    ]);
    const university = p.university_id
      ? await unwrap<University>(sb.from('universities').select('id,name,country_code,country').eq('id', p.university_id).single())
      : null;
    return { profile: p, private: priv, skills: skills.map((s) => s.skill_slug), wallet, university };
  },
  /** Любой шаг регистрации и редактирование профиля: обновляются только переданные ключи */
  saveData(sb: Client, data: ProfileData) {
    return unwrap<Profile>(sb.rpc('save_profile_data', { p: data }));
  },
  complete(sb: Client, v: { terms: boolean; privacy: boolean; twoFactor: boolean; notifications: boolean }) {
    return unwrap<Profile>(
      sb.rpc('complete_onboarding', {
        p_terms: v.terms,
        p_privacy: v.privacy,
        p_two_factor: v.twoFactor,
        p_notifications: v.notifications,
      }),
    );
  },
  /** Навыки с уровнями в порядке профиля */
  mySkills(sb: Client, profileId: string) {
    return unwrap<{ skill_slug: string; level: string | null; sort: number }[]>(
      sb.from('profile_skills').select('skill_slug,level,sort').eq('profile_id', profileId).order('sort'),
    );
  },
  usernameAvailable(sb: Client, username: string) {
    return unwrap<boolean>(sb.rpc('username_available', { p_username: username }));
  },
  experience(sb: Client, profileId: string) {
    return unwrap<Experience[]>(sb.from('profile_experience').select('*').eq('profile_id', profileId).order('sort'));
  },
  portfolio(sb: Client, profileId: string) {
    return unwrap<PortfolioItem[]>(
      sb.from('portfolio_items').select('*').eq('profile_id', profileId).order('created_at', { ascending: false }),
    );
  },
  addPortfolio(sb: Client, item: Pick<PortfolioItem, 'title' | 'url' | 'file_path' | 'category' | 'visibility'>) {
    return unwrap<PortfolioItem>(sb.from('portfolio_items').insert(item).select().single());
  },
  removePortfolio(sb: Client, id: string) {
    return unwrap<null>(sb.from('portfolio_items').delete().eq('id', id));
  },
  skills(sb: Client) {
    return unwrap<Skill[]>(sb.from('skills').select('*').order('sort'));
  },
  async searchUniversities(sb: Client, query: string, country?: string): Promise<University[]> {
    const q = query.trim().replace(/[%_*,()\\]/g, ' ');
    if (q.length < 2) return [];
    let req = sb.from('universities').select('id,name,country_code,country').ilike('name', `%${q}%`).order('name').limit(20);
    if (country) req = req.eq('country_code', country);
    return unwrap<University[]>(req);
  },
  publicProfile(sb: Client, id: string) {
    return unwrap<Profile>(sb.from('profiles').select('*').eq('id', id).single());
  },
};

// ---------- Задачи ----------

export const tasks = {
  feed(sb: Client, p: FeedParams & { lat?: number | null; lng?: number | null; limit?: number; offset?: number }) {
    return unwrap<FeedTask[]>(
      sb.rpc('feed_tasks', {
        p_kind: p.kind,
        p_query: p.query || null,
        p_categories: p.categories?.length ? p.categories : null,
        p_min_reward: p.minRewardCents ?? null,
        p_max_reward: p.maxRewardCents ?? null,
        p_deadlines: p.deadlines?.length ? p.deadlines : null,
        p_lat: p.lat ?? null,
        p_lng: p.lng ?? null,
        p_max_distance_m: p.maxDistanceM ?? null,
        p_sort: p.sort ?? 'recommended',
        p_limit: p.limit ?? 20,
        p_offset: p.offset ?? 0,
        p_levels: p.levels?.length ? p.levels : null,
        p_language: p.language || null,
        p_bookmarked: !!p.bookmarked,
        p_max_minutes: p.maxMinutes ?? null,
      }),
    );
  },
  detail(sb: Client, id: string) {
    return unwrap<TaskDetail | null>(sb.rpc('task_detail', { p_task: id }));
  },
  mine(sb: Client, role: 'customer' | 'executor') {
    return unwrap<MyTask[]>(sb.rpc('my_tasks', { p_role: role }));
  },
  /**
   * Публикация (идемпотентна по id: повторный вызов не списывает деньги второй раз).
   * price: валюта счёта (USD/USDT) и, для цены в рублях, исходная сумма и время курса —
   * если курс успел обновиться, сервер вернёт rate_changed и форма попросит подтвердить сумму.
   */
  publish(
    sb: Client,
    id: string,
    d: TaskDraft,
    attachments: FileRef[],
    price: { currency?: 'USD' | 'USDT'; inputCurrency?: 'RUB' | null; inputAmount?: number | null; rateFetchedAt?: string | null } = {},
    extra: TaskExtra = {},
  ) {
    return unwrap<Task>(
      sb.rpc('publish_task', {
        p_id: id,
        p_title: d.title,
        p_brief: d.brief,
        p_category: d.category,
        p_result_format: d.resultFormat,
        p_deadline: d.deadline,
        p_kind: d.kind,
        p_reward_cents: d.rewardCents,
        p_description: d.description || null,
        p_checklist: d.checklist,
        p_lat: d.kind === 'nearby' ? d.lat : null,
        p_lng: d.kind === 'nearby' ? d.lng : null,
        p_radius_m: d.kind === 'nearby' ? d.radiusM : null,
        p_place_name: d.kind === 'nearby' ? d.placeName || null : null,
        p_attachments: attachments,
        p_currency: price.currency ?? 'USD',
        p_input_currency: price.inputCurrency ?? null,
        p_input_amount: price.inputAmount ?? null,
        p_rate_fetched_at: price.rateFetchedAt ?? null,
        p_extra: {
          language: extra.language ?? null,
          required_level: extra.requiredLevel ?? null,
          proofs: extra.proofs ?? [],
          visit_window: extra.visitWindow ?? null,
          campus_building: extra.campusBuilding ?? null,
          skills: extra.skills ?? [],
        },
      }),
    );
  },
  cancel(sb: Client, id: string) {
    return unwrap<Task>(sb.rpc('cancel_task', { p_task: id }));
  },
  republish(sb: Client, id: string) {
    return unwrap<Task>(sb.rpc('republish_task', { p_task: id }));
  },
  async composeWithAI(sb: Client, input: { title: string; brief: string; kind: string; category?: Category | null }) {
    const { data, error } = await sb.functions.invoke<ComposeResult>('ai-compose', { body: input });
    if (error) throw new ApiError('errors.ai_failed', error.message);
    return data as ComposeResult;
  },
};

// ---------- Отклики ----------

export interface ResponseInput {
  coverLetter: string;
  priceCents: number;
  deadline: Deadline;
  skills: string[];
  portfolioLinks: string[];
  ready: ReadyWhen;
  videoUrl?: string | null;
}

/** Дополнительные поля задачи (необязательные) */
export interface TaskExtra {
  language?: string | null;
  requiredLevel?: 'junior' | 'middle' | 'expert' | null;
  proofs?: ('photo' | 'checkin' | 'comment')[];
  visitWindow?: string | null;
  campusBuilding?: string | null;
  skills?: string[];
}

const responseArgs = (v: ResponseInput) => ({
  p_cover_letter: v.coverLetter,
  p_price_cents: v.priceCents,
  p_deadline: v.deadline,
  p_skills: v.skills,
  p_portfolio_links: v.portfolioLinks,
  p_ready: v.ready,
  p_video_url: v.videoUrl || null,
});

export const responses = {
  submit(sb: Client, taskId: string, v: ResponseInput) {
    return unwrap<TaskResponse>(sb.rpc('submit_response', { p_task: taskId, ...responseArgs(v) }));
  },
  update(sb: Client, responseId: string, v: ResponseInput) {
    return unwrap<TaskResponse>(sb.rpc('update_response', { p_response: responseId, ...responseArgs(v) }));
  },
  withdraw(sb: Client, responseId: string) {
    return unwrap<TaskResponse>(sb.rpc('withdraw_response', { p_response: responseId }));
  },
  forTask(sb: Client, taskId: string) {
    return unwrap<ResponseWithExecutor[]>(sb.rpc('task_responses_for', { p_task: taskId }));
  },
  choose(sb: Client, responseId: string) {
    return unwrap<Task>(sb.rpc('choose_response', { p_response: responseId }));
  },
  markViewed(sb: Client, taskId: string) {
    return unwrap<number>(sb.rpc('mark_responses_viewed', { p_task: taskId }));
  },
  setCompared(sb: Client, responseId: string, on: boolean) {
    return unwrap<null>(sb.rpc('set_response_compared', { p_response: responseId, p_on: on }));
  },
  /** Мой отклик с данными задачи — для страницы отклика */
  async mine(sb: Client, responseId: string) {
    const r = await unwrap<TaskResponse | null>(sb.from('task_responses').select('*').eq('id', responseId).maybeSingle());
    if (!r) return null;
    const task = await unwrap<Pick<Task, 'id' | 'title' | 'status' | 'customer_id' | 'reward_cents' | 'currency' | 'expires_at'> | null>(
      sb.from('tasks').select('id,title,status,customer_id,reward_cents,currency,expires_at').eq('id', r.task_id).maybeSingle(),
    );
    return task ? { ...r, tasks: task } : null;
  },
};

// ---------- Сдача и приёмка ----------

export const work = {
  submit(
    sb: Client,
    taskId: string,
    v: { link: string; comment: string; files: FileRef[]; stage?: 'final' | 'intermediate'; included?: string[]; note?: string },
  ) {
    return unwrap<Submission>(
      sb.rpc('submit_work', {
        p_task: taskId,
        p_link: v.link || null,
        p_comment: v.comment || null,
        p_files: v.files,
        p_stage: v.stage ?? 'final',
        p_included: v.included ?? [],
        p_note: v.note || null,
      }),
    );
  },
  review(
    sb: Client,
    submissionId: string,
    v: {
      decision: 'accept' | 'revision' | 'dispute';
      checklist: boolean[];
      comment: string;
      revisionItems?: number[];
      revisionCriteria?: string[];
      revisionDue?: string | null;
    },
  ) {
    return unwrap<Task>(
      sb.rpc('review_submission', {
        p_submission: submissionId,
        p_decision: v.decision,
        p_checklist: v.checklist,
        p_comment: v.comment || null,
        p_revision_items: v.revisionItems?.length ? v.revisionItems : null,
        p_revision_criteria: v.revisionCriteria?.length ? v.revisionCriteria : null,
        p_revision_due: v.revisionDue ?? null,
      }),
    );
  },
  take(sb: Client, taskId: string) {
    return unwrap<Task>(sb.rpc('take_task', { p_task: taskId }));
  },
  start(sb: Client, taskId: string) {
    return unwrap<Task>(sb.rpc('start_task', { p_task: taskId }));
  },
  refuse(sb: Client, taskId: string, reason?: string) {
    return unwrap<Task>(sb.rpc('refuse_task', { p_task: taskId, p_reason: reason || null }));
  },
  requestExtension(sb: Client, taskId: string, minutes: number, reason?: string) {
    return unwrap<TaskExtension>(sb.rpc('request_extension', { p_task: taskId, p_minutes: minutes, p_reason: reason || null }));
  },
  decideExtension(sb: Client, extensionId: string, accept: boolean) {
    return unwrap<TaskExtension>(sb.rpc('decide_extension', { p_extension: extensionId, p_accept: accept }));
  },
  tip(sb: Client, taskId: string, cents: number) {
    return unwrap<null>(sb.rpc('send_tip', { p_task: taskId, p_amount_cents: cents }));
  },
  review_counterpart(sb: Client, taskId: string, v: ReviewInput) {
    return unwrap<Review>(
      sb.rpc('leave_review', {
        p_task: taskId,
        p_rating: v.rating,
        p_quality: v.quality ?? null,
        p_communication: v.communication ?? null,
        p_deadlines: v.deadlines ?? null,
        p_requirements: v.requirements ?? null,
        p_public: v.publicText || null,
        p_private: v.privateText || null,
        p_skills: v.skills ?? [],
        p_work_again: v.workAgain ?? null,
      }),
    );
  },
};

export interface ReviewInput {
  rating: number;
  quality?: number | null;
  communication?: number | null;
  deadlines?: number | null;
  requirements?: number | null;
  publicText?: string;
  privateText?: string;
  skills?: string[];
  workAgain?: boolean | null;
}

// ---------- Вопросы, жалобы, закладки, пропуск, черновики ----------

export const taskExtras = {
  questions(sb: Client, taskId: string) {
    return unwrap<TaskQuestion[]>(sb.rpc('task_questions_for', { p_task: taskId }));
  },
  ask(sb: Client, taskId: string, body: string, parentId?: string | null) {
    return unwrap<TaskQuestion>(sb.rpc('ask_question', { p_task: taskId, p_body: body, p_parent: parentId ?? null }));
  },
  deleteQuestion(sb: Client, id: string) {
    return unwrap<null>(sb.rpc('delete_question', { p_question: id }));
  },
  complain(sb: Client, taskId: string, reason: ComplaintReason, details?: string) {
    return unwrap<null>(sb.rpc('complain_task', { p_task: taskId, p_reason: reason, p_details: details || null }));
  },
  async bookmark(sb: Client, taskId: string, on: boolean) {
    if (on) return unwrap<null>(sb.from('task_bookmarks').upsert({ task_id: taskId }, { onConflict: 'user_id,task_id', ignoreDuplicates: true }));
    return unwrap<null>(sb.from('task_bookmarks').delete().eq('task_id', taskId));
  },
  skip(sb: Client, taskId: string) {
    return unwrap<null>(sb.from('task_skips').upsert({ task_id: taskId }, { onConflict: 'user_id,task_id', ignoreDuplicates: true }));
  },
  drafts(sb: Client) {
    return unwrap<TaskDraftRow[]>(sb.from('task_drafts').select('*').order('updated_at', { ascending: false }));
  },
  saveDraft(sb: Client, id: string, data: Record<string, unknown>) {
    return unwrap<TaskDraftRow>(sb.from('task_drafts').upsert({ id, data, updated_at: new Date().toISOString() }).select().single());
  },
  deleteDraft(sb: Client, id: string) {
    return unwrap<null>(sb.from('task_drafts').delete().eq('id', id));
  },
  async reviewsFor(sb: Client, userId: string): Promise<ReviewWithAuthor[]> {
    const rows = await unwrap<Review[]>(sb.from('reviews').select('*').eq('target_id', userId).order('created_at', { ascending: false }));
    if (!rows.length) return [];
    const ids = [...new Set(rows.map((r) => r.author_id))];
    const taskIds = [...new Set(rows.map((r) => r.task_id))];
    const [authors, taskRows] = await Promise.all([
      unwrap<NonNullable<ReviewWithAuthor['author']>[]>(sb.from('profiles').select('id,first_name,last_name,avatar_url').in('id', ids)),
      unwrap<NonNullable<ReviewWithAuthor['task']>[]>(sb.from('tasks').select('id,title').in('id', taskIds)),
    ]);
    return rows.map((r) => ({
      ...r,
      author: authors.find((a) => a.id === r.author_id) ?? null,
      task: taskRows.find((x) => x.id === r.task_id) ?? null,
    }));
  },
};


// ---------- Рабочая комната ----------

export const room = {
  messages(sb: Client, taskId: string) {
    return unwrap<Message[]>(sb.from('messages').select('*').eq('task_id', taskId).order('created_at').limit(500));
  },
  async send(sb: Client, taskId: string, body: string, files: FileRef[] = []) {
    const { data: u } = await sb.auth.getUser();
    return unwrap<Message>(
      sb.from('messages').insert({ task_id: taskId, sender_id: u.user?.id, body, files }).select().single(),
    );
  },
  /**
   * Подписка на новые сообщения через Realtime. Возвращает отписку.
   * onStatus сообщает, удалось ли подключиться (если нет — клиент переходит на опрос).
   */
  subscribe(sb: Client, taskId: string, onMessage: (m: Message) => void, onStatus?: (ok: boolean) => void) {
    const channel: RealtimeChannel = sb
      .channel(`room:${taskId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `task_id=eq.${taskId}` }, (payload) =>
        onMessage(payload.new as Message),
      )
      .subscribe((status) => onStatus?.(status === 'SUBSCRIBED'));
    return () => {
      void sb.removeChannel(channel);
    };
  },
};

// ---------- Файлы ----------

export const BUCKET = 'task-files';

export const files = {
  /** Аватар: публичный бакет, путь {user}/avatar-{ts}.{ext}; возвращает публичную ссылку */
  async uploadAvatar(sb: Client, userId: string, body: Blob | ArrayBuffer, contentType: string): Promise<string> {
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `${userId}/avatar-${Date.now()}.${ext}`;
    const { error } = await sb.storage.from('avatars').upload(path, body, { contentType, upsert: true });
    if (error) throw new ApiError('errors.upload_failed', error.message);
    return sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  },
  /** Путь в бакете: {user}/{task}/{brief|chat|submission}/{uuid}-{name} */
  path(userId: string, taskId: string, area: 'brief' | 'chat' | 'submission', name: string, id: string) {
    const safe = name.replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-80);
    return `${userId}/${taskId}/${area}/${id}-${safe}`;
  },
  async upload(sb: Client, path: string, body: Blob | ArrayBuffer, contentType: string, bucket = BUCKET): Promise<void> {
    const { error } = await sb.storage.from(bucket).upload(path, body, { contentType, upsert: bucket === 'avatars' });
    if (error) throw new ApiError('errors.upload_failed', error.message);
  },
  async signedUrl(sb: Client, path: string, bucket = BUCKET): Promise<string> {
    const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 3600);
    if (error || !data) throw new ApiError('errors.download_failed', error?.message);
    return data.signedUrl;
  },
};

// ---------- Сохранённые поиски ----------

export const savedSearches = {
  list(sb: Client) {
    return unwrap<SavedSearch[]>(sb.from('saved_searches').select('*').order('created_at', { ascending: false }));
  },
  create(sb: Client, name: string, params: FeedParams) {
    return unwrap<SavedSearch>(sb.from('saved_searches').insert({ name, params }).select().single());
  },
  remove(sb: Client, id: string) {
    return unwrap<null>(sb.from('saved_searches').delete().eq('id', id));
  },
};

// ---------- Кошелёк ----------

export const wallet = {
  ledger(sb: Client, limit = 50) {
    return unwrap<LedgerEntry[]>(
      sb.from('ledger_entries').select('*').order('created_at', { ascending: false }).limit(limit),
    );
  },
};
