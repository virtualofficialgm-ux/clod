import type { Category, Deadline, ResultFormat, TaskKind, TaskStatus } from './constants';

import type { DisplayCurrency, ExperienceLevel, LanguageLevel, UiLocale } from './catalog';
import type { PlanId } from './money';
export type { PlanId };
export type OnboardingStep = 'profile' | 'skills' | 'done';
export type ResponseStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';
export type ReadyWhen = 'now' | 'in_1h' | 'today' | 'tomorrow';
export type SubmissionStatus = 'pending' | 'accepted' | 'revision_requested' | 'disputed';
export type ArchiveReason = 'expired' | 'cancelled';
export type FullTaskStatus = TaskStatus | 'disputed';
export type ViewerRole = 'customer' | 'executor' | 'candidate' | 'visitor';

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  university_id: number | null;
  portfolio_links: string[];
  role: 'user' | 'moderator' | 'admin';
  plan: PlanId;
  onboarding: OnboardingStep;
  rating_avg: number | null;
  rating_count: number;
  completed_count: number;
  earned_cents: number;
  created_at: string;
  username: string | null;
  display_name: string | null;
  headline: string | null;
  profession: string | null;
  experience_level: ExperienceLevel | null;
  country_code: string | null;
  city: string | null;
  timezone: string | null;
  languages: WorkLanguage[];
  display_currency: DisplayCurrency;
  custom_skills: string[];
  links: ProfileLink[];
  faculty: string | null;
  specialty: string | null;
  platform_role: 'executor' | 'customer' | 'both';
  availability: 'available' | 'busy' | 'hidden';
  preferred_kinds: TaskKind[];
  response_time: '5m' | '1h' | '3h' | 'day' | null;
  hidden_fields: string[];
  notify_skill_tasks: boolean;
  onboarded_at: string | null;
}

export interface WorkLanguage {
  code: string;
  level: LanguageLevel;
}

export interface ProfileLink {
  title: string;
  url: string;
}

export interface ProfilePrivate {
  id: string;
  birth_date: string | null;
  phone: string | null;
  locale: UiLocale;
  student_email: string | null;
  two_factor_enabled: boolean;
  notifications_enabled: boolean;
  terms_accepted_at: string | null;
}

export interface Experience {
  id: string;
  profile_id: string;
  company: string;
  position: string;
  from_year: number | null;
  to_year: number | null;
}

export interface PortfolioItem {
  id: string;
  profile_id: string;
  title: string;
  url: string | null;
  file_path: string | null;
  category: Category | null;
  visibility: 'public' | 'clients' | 'private';
  created_at: string;
}

/** Поля для save_profile_data: передаются только изменённые */
export type ProfileData = Partial<{
  first_name: string;
  last_name: string;
  display_name: string;
  avatar_url: string | null;
  birth_date: string;
  phone: string | null;
  username: string;
  country_code: string | null;
  city: string | null;
  timezone: string | null;
  locale: UiLocale;
  display_currency: DisplayCurrency;
  languages: WorkLanguage[];
  profession: string | null;
  headline: string | null;
  experience_level: ExperienceLevel | null;
  skills: string[];
  skill_levels: Record<string, string>;
  custom_skills: string[];
  bio: string | null;
  portfolio_links: string[];
  links: ProfileLink[];
  experience: Pick<Experience, 'company' | 'position' | 'from_year' | 'to_year'>[];
  university_id: number | null;
  faculty: string | null;
  specialty: string | null;
  student_email: string | null;
  platform_role: Profile['platform_role'];
  availability: Profile['availability'];
  preferred_kinds: TaskKind[];
  response_time: Profile['response_time'];
  hidden_fields: string[];
  notify_skill_tasks: boolean;
  notifications_enabled: boolean;
  two_factor_enabled: boolean;
}>;

export interface Wallet {
  user_id: string;
  available_cents: number;
  safe_cents: number;
  held_cents: number;
  usdt_available_cents: number;
  usdt_safe_cents: number;
  usdt_held_cents: number;
}

export interface University {
  id: number;
  name: string;
  country_code: string;
  country: string;
}

export interface Skill {
  slug: string;
  category: Category;
  sort: number;
}

export interface FileRef {
  path: string;
  name: string;
  size: number;
  mime: string;
}

export interface FeedTask {
  id: string;
  title: string;
  brief: string;
  category: Category;
  result_format: ResultFormat;
  deadline: Deadline;
  kind: TaskKind;
  reward_cents: number;
  university_name: string | null;
  place_name: string | null;
  radius_m: number | null;
  distance_m: number | null;
  lat: number | null;
  lng: number | null;
  response_count: number;
  published_at: string;
  expires_at: string;
  customer_id: string;
  customer_name: string;
  customer_avatar: string | null;
  customer_rating: number | null;
  has_responded: boolean;
  bookmarked: boolean;
  match: number;
  currency: 'USD' | 'USDT';
  required_level: 'junior' | 'middle' | 'expert' | null;
  language: string | null;
  proofs: string[];
}

export interface Task {
  id: string;
  customer_id: string;
  title: string;
  brief: string;
  description: string | null;
  category: Category;
  result_format: ResultFormat;
  checklist: string[];
  deadline: Deadline;
  kind: TaskKind;
  university_id: number | null;
  radius_m: number | null;
  place_name: string | null;
  reward_cents: number;
  fee_bps: number;
  fee_cents: number;
  status: FullTaskStatus;
  archive_reason: ArchiveReason | null;
  executor_id: string | null;
  accepted_response_id: string | null;
  assigned_at: string | null;
  due_at: string | null;
  expires_at: string;
  published_at: string;
  completed_at: string | null;
  response_count: number;
  lat: number | null;
  lng: number | null;
  expired: boolean;
  currency: 'USD' | 'USDT';
  started_at: string | null;
  take_mode: 'response' | 'instant' | null;
  language: string | null;
  required_level: 'junior' | 'middle' | 'expert' | null;
  proofs: string[];
  visit_window: string | null;
  campus_building: string | null;
  skills: string[];
}

export interface PersonSummary {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  rating_avg: number | null;
  rating_count: number;
  completed_count: number;
}

export interface TaskResponse {
  id: string;
  task_id: string;
  executor_id: string;
  cover_letter: string;
  price_cents: number;
  deadline: Deadline;
  skills: string[];
  portfolio_links: string[];
  ready: ReadyWhen;
  status: ResponseStatus;
  created_at: string;
  updated_at: string;
  video_url: string | null;
  viewed_at: string | null;
  compared: boolean;
}

export interface ResponseWithExecutor extends Omit<TaskResponse, 'task_id' | 'updated_at'> {
  match: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  rating_avg: number | null;
  rating_count: number;
  completed_count: number;
}

export interface Submission {
  id: string;
  task_id: string;
  executor_id: string;
  version: number;
  link: string | null;
  comment: string | null;
  files: FileRef[];
  status: SubmissionStatus;
  checklist_result: boolean[] | null;
  review_comment: string | null;
  reviewed_at: string | null;
  created_at: string;
  stage: 'final' | 'intermediate';
  included: string[];
  note: string | null;
  revision_items: number[] | null;
  revision_criteria: string[] | null;
  revision_due: string | null;
}

export interface Dispute {
  id: string;
  task_id: string | null;
  opened_by: string;
  reason: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  path: string;
  name: string;
  size_bytes: number;
  mime: string;
}

export interface TaskDetail {
  task: Task;
  viewer_role: ViewerRole;
  customer: PersonSummary & { created_at: string; username: string | null; customer_completed: number; customer_open: number };
  executor: PersonSummary | null;
  university: { id: number; name: string } | null;
  attachments: Attachment[];
  my_response: TaskResponse | null;
  submissions: Submission[];
  dispute: Dispute | null;
  bookmarked: boolean;
  questions_count: number;
  extension: TaskExtension | null;
  my_review: Review | null;
  takes_left: number;
  start_deadline: string | null;
}

export interface TaskExtension {
  id: string;
  task_id: string;
  requested_by: string;
  minutes: number;
  reason: string | null;
  status: 'pending' | 'accepted' | 'declined';
  decided_at: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  task_id: string;
  author_id: string;
  target_id: string;
  author_role: 'customer' | 'executor';
  rating: number;
  quality: number | null;
  communication: number | null;
  deadlines: number | null;
  requirements: number | null;
  public_text: string | null;
  skills_confirmed: string[];
  work_again: boolean | null;
  created_at: string;
}

export interface ReviewWithAuthor extends Review {
  author: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
  task: { id: string; title: string } | null;
}

export interface TaskQuestion {
  id: string;
  parent_id: string | null;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  body: string;
  deleted: boolean;
  is_customer: boolean;
  created_at: string;
}

export type ComplaintReason = 'fraud' | 'prohibited' | 'discrimination' | 'wrong_category' | 'spam' | 'other';

export interface TaskDraftRow {
  id: string;
  user_id: string;
  data: Record<string, unknown>;
  updated_at: string;
}

export interface MyTask {
  id: string;
  title: string;
  category: Category;
  kind: TaskKind;
  deadline: Deadline;
  reward_cents: number;
  fee_cents: number;
  status: FullTaskStatus;
  archive_reason: ArchiveReason | null;
  expired: boolean;
  response_count: number;
  due_at: string | null;
  expires_at: string;
  published_at: string;
  completed_at: string | null;
  counterpart_name: string | null;
  my_response_status: ResponseStatus | null;
  currency: 'USD' | 'USDT';
  new_responses: number;
  assigned_at: string | null;
  started_at: string | null;
  take_mode: 'response' | 'instant' | null;
  counterpart_id: string | null;
  reviewed: boolean;
}

export type SystemEvent =
  | 'executor_assigned'
  | 'work_submitted'
  | 'work_accepted'
  | 'revision_requested'
  | 'dispute_opened';

export interface Message {
  id: string;
  task_id: string;
  sender_id: string | null;
  kind: 'text' | 'system';
  body: string;
  files: FileRef[];
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface LedgerEntry {
  id: number;
  tx_id: string;
  kind: string;
  account: 'available' | 'escrow' | 'hold';
  currency: 'USD' | 'USDT';
  task_id: string | null;
  amount_cents: number;
  memo: string | null;
  created_at: string;
}

export interface SavedSearch {
  id: string;
  name: string;
  params: FeedParams;
  created_at: string;
}

export interface FeedParams {
  kind: TaskKind;
  levels?: ('junior' | 'middle' | 'expert')[];
  language?: string | null;
  bookmarked?: boolean;
  /** Срок выполнения не больше N минут (фильтр «до 24 часов», «до недели») */
  maxMinutes?: number | null;
  query?: string;
  categories?: Category[];
  minRewardCents?: number | null;
  maxRewardCents?: number | null;
  deadlines?: Deadline[];
  maxDistanceM?: number | null;
  sort?: 'recommended' | 'newest' | 'highest_pay' | 'deadline' | 'distance' | 'best_match';
}

export interface ComposeResult {
  description: string;
  category: Category;
  result_format: ResultFormat;
  checklist: string[];
}

/** Статус задачи с точки зрения интерфейса (просроченная открытая = архив) */
export function displayStatus(t: { status: FullTaskStatus; expired?: boolean }): FullTaskStatus {
  return t.status === 'open' && t.expired ? 'archived' : t.status;
}
