import type { Category, Deadline, ResultFormat, TaskKind, TaskStatus } from './constants';

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
}

export interface ProfilePrivate {
  id: string;
  birth_date: string | null;
  phone: string | null;
  locale: string;
}

export interface Wallet {
  user_id: string;
  available_cents: number;
  safe_cents: number;
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
}

export interface ResponseWithExecutor extends Omit<TaskResponse, 'task_id' | 'updated_at'> {
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
  customer: PersonSummary;
  executor: PersonSummary | null;
  university: { id: number; name: string } | null;
  attachments: Attachment[];
  my_response: TaskResponse | null;
  submissions: Submission[];
  dispute: Dispute | null;
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
  account: 'available' | 'escrow';
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
  query?: string;
  categories?: Category[];
  minRewardCents?: number | null;
  maxRewardCents?: number | null;
  deadlines?: Deadline[];
  maxDistanceM?: number | null;
  sort?: 'recommended' | 'newest' | 'highest_pay' | 'deadline' | 'distance';
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
