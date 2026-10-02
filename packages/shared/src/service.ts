import { ApiError, unwrap, type Client } from './api';
import type { MoneyCurrency } from './money';
import type { TaskKind } from './constants';
import type { FileRef, FullTaskStatus } from './types';

// ---------- Поддержка ----------

export type TicketCategory = 'tasks' | 'payments' | 'account' | 'verification' | 'plans' | 'other';
export type TicketStatus = 'open' | 'waiting' | 'resolved' | 'closed';
export const TICKET_CATEGORIES: TicketCategory[] = ['tasks', 'payments', 'account', 'other'];

export interface Ticket {
  id: string;
  user_id: string;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  author_id: string | null;
  from_staff: boolean;
  internal: boolean;
  body: string;
  files: FileRef[];
  created_at: string;
}

/** База знаний: ключи статей; тексты — в i18n (kb.<key>.q / kb.<key>.a) */
export const KB_ARTICLES = [
  'take',
  'submit',
  'safe',
  'payment_status',
  'withdraw',
  'restore',
  'dispute',
  'fees',
] as const;
export type KbArticle = (typeof KB_ARTICLES)[number];

export const support = {
  tickets(sb: Client) {
    return unwrap<Ticket[]>(
      sb.from('support_tickets').select('*').order('updated_at', { ascending: false }),
    );
  },
  ticket(sb: Client, id: string) {
    return unwrap<Ticket | null>(sb.from('support_tickets').select('*').eq('id', id).maybeSingle());
  },
  messages(sb: Client, ticketId: string) {
    return unwrap<TicketMessage[]>(
      sb.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at'),
    );
  },
  create(
    sb: Client,
    v: {
      category: TicketCategory;
      subject: string;
      body: string;
      files?: FileRef[];
      taskId?: string | null;
    },
  ) {
    return unwrap<Ticket>(
      sb.rpc('create_ticket', {
        p_category: v.category,
        p_subject: v.subject,
        p_body: v.body,
        p_files: v.files ?? [],
        p_task: v.taskId ?? null,
      }),
    );
  },
  reply(sb: Client, ticketId: string, body: string, files: FileRef[] = [], internal = false) {
    return unwrap<TicketMessage>(
      sb.rpc('ticket_reply', {
        p_ticket: ticketId,
        p_body: body,
        p_files: files,
        p_internal: internal,
      }),
    );
  },
  setStatus(sb: Client, ticketId: string, status: TicketStatus) {
    return unwrap<null>(sb.rpc('ticket_set_status', { p_ticket: ticketId, p_status: status }));
  },
};

// ---------- Споры ----------

export type DisputeReason = 'mismatch' | 'deadline' | 'payment' | 'refund' | 'other';
export type DisputeDesired = 'refund' | 'partial' | 'revision' | 'review';
export const DISPUTE_REASONS: DisputeReason[] = [
  'mismatch',
  'deadline',
  'payment',
  'refund',
  'other',
];
export const DISPUTE_DESIRED: DisputeDesired[] = ['refund', 'partial', 'revision', 'review'];

export interface DisputeRow {
  id: string;
  kind: 'task' | 'account';
  task_id: string | null;
  task_title: string | null;
  reason: string;
  reason_code: DisputeReason | null;
  desired: DisputeDesired | null;
  amount_cents: number | null;
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  decision: 'customer' | 'executor' | 'compromise' | 'rejected' | null;
  executor_cents: number | null;
  resolution: string | null;
  deadline_at: string;
  created_at: string;
  resolved_at: string | null;
  opened_by_me: boolean;
  events: { kind: string; note: string | null; at: string }[];
}

export interface OpenDisputeInput {
  kind: 'task' | 'account';
  taskId?: string | null;
  reason: DisputeReason;
  details: string;
  links?: string[];
  desired: DisputeDesired;
  amountCents?: number | null;
  truthful: boolean;
}

export const disputes = {
  mine(sb: Client) {
    return unwrap<DisputeRow[]>(sb.rpc('my_disputes'));
  },
  open(sb: Client, v: OpenDisputeInput) {
    return unwrap<{ id: string }>(
      sb.rpc('open_dispute', {
        p_kind: v.kind,
        p_task: v.taskId ?? null,
        p_reason_code: v.reason,
        p_details: v.details,
        p_links: v.links ?? [],
        p_desired: v.desired,
        p_amount_cents: v.amountCents ?? null,
        p_truthful: v.truthful,
      }),
    );
  },
};

/** Осталось до решения спора, мс (не меньше 0) */
export function disputeTimeLeft(deadlineAt: string, now = Date.now()): number {
  return Math.max(0, new Date(deadlineAt).getTime() - now);
}

// ---------- Верификация ----------

export type VerificationKind = 'selfie' | 'university' | 'skill';
export interface VerificationRequest {
  id: string;
  user_id: string;
  kind: VerificationKind;
  payload: Record<string, unknown>;
  files: FileRef[];
  status: 'pending' | 'approved' | 'rejected' | 'need_docs';
  note: string | null;
  created_at: string;
  decided_at: string | null;
}

export const verification = {
  mine(sb: Client) {
    return unwrap<VerificationRequest[]>(
      sb.from('verification_requests').select('*').order('created_at', { ascending: false }),
    );
  },
  submit(sb: Client, kind: VerificationKind, payload: Record<string, unknown>, files: FileRef[]) {
    return unwrap<VerificationRequest>(
      sb.rpc('submit_verification', { p_kind: kind, p_payload: payload, p_files: files }),
    );
  },
};

/** Приватные документы (поддержка, проверка личности): {uid}/{support|kyc}/{id}-{name} */
export const privateDocs = {
  path(userId: string, area: 'support' | 'kyc', name: string, id: string) {
    return `${userId}/${area}/${id}-${name.replace(/[^\w.\-а-яА-ЯёЁ]+/g, '_').slice(-80)}`;
  },
  async upload(sb: Client, path: string, body: Blob | ArrayBuffer, contentType: string) {
    const { error } = await sb.storage.from('private-docs').upload(path, body, { contentType });
    if (error) throw new ApiError('errors.upload_failed', error.message);
    return path;
  },
  async signedUrl(sb: Client, path: string) {
    const { data, error } = await sb.storage.from('private-docs').createSignedUrl(path, 300);
    if (error) throw new ApiError('errors.unknown', error.message);
    return data.signedUrl;
  },
};

// ---------- Бот PARRI ----------

export interface BotTask {
  id: string;
  title: string;
  reward_cents: number;
  currency: MoneyCurrency;
  category: string;
  deadline: string;
  kind: TaskKind;
}
export interface BotMessage {
  id: number;
  role: 'user' | 'assistant';
  body: string;
  tasks: BotTask[];
  created_at: string;
}

export const bot = {
  history(sb: Client) {
    return unwrap<BotMessage[]>(sb.from('bot_messages').select('*').order('id'));
  },
  async ask(sb: Client, message: string) {
    const { data, error } = await sb.functions.invoke<{ reply: string; tasks: BotTask[] }>(
      'parri-bot',
      { body: { message } },
    );
    if (error) {
      const ctx = (error as { context?: Response }).context;
      const body =
        ctx && typeof ctx.json === 'function' ? await ctx.json().catch(() => null) : null;
      throw new ApiError(
        body?.error === 'bot_requires_pro' ? 'errors.bot_requires_pro' : 'errors.ai_failed',
        error.message,
      );
    }
    return data!;
  },
  clear(sb: Client) {
    return unwrap<null>(sb.rpc('clear_bot'));
  },
};

export const BOT_PROMPTS = ['p1', 'p2', 'p3', 'p4'] as const;

// ---------- Админка ----------

export interface AdminStats {
  users: number;
  users_week: number;
  tasks_open: number;
  tasks_active: number;
  tasks_completed: number;
  turnover_cents: number;
  revenue_cents: number;
  disputes_open: number;
  kyc_pending: number;
  tickets_open: number;
  payouts_pending: number;
  payments_pending: number;
  complaints_new: number;
}

export interface AdminUser {
  id: string;
  name: string;
  username: string | null;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  plan: 'free' | 'pro';
  banned_at: string | null;
  banned_reason: string | null;
  deactivated_at: string | null;
  deleted_at: string | null;
  available_cents: number;
  usdt_available_cents: number;
  created_at: string;
}

export interface AdminTask {
  id: string;
  title: string;
  status: FullTaskStatus;
  kind: TaskKind;
  reward_cents: number;
  currency: MoneyCurrency;
  customer_id: string;
  customer_name: string;
  hidden_at: string | null;
  hidden_reason: string | null;
  complaints: number;
  created_at: string;
}

export interface AdminComplaint {
  id: string;
  task_id: string;
  task_title: string;
  reporter_name: string;
  reason: string;
  details: string | null;
  status: 'new' | 'in_review' | 'rejected' | 'escalated' | 'resolved';
  created_at: string;
}

export interface AdminDispute {
  id: string;
  kind: 'task' | 'account';
  task_id: string | null;
  account_id: string | null;
  opened_by: string;
  reason: string;
  reason_code: string | null;
  desired: string | null;
  amount_cents: number | null;
  status: DisputeRow['status'];
  decision: DisputeRow['decision'];
  deadline_at: string;
  created_at: string;
}

export interface AdminPayout {
  id: string;
  user_id: string;
  method: 'stripe' | 'usdt';
  currency: MoneyCurrency;
  amount_cents: number;
  status: string;
  created_at: string;
}

export interface AdminPayment {
  id: string;
  user_id: string;
  provider: string;
  provider_ref: string | null;
  amount_cents: number;
  currency: MoneyCurrency;
  status: string;
  created_at: string;
}

export interface AuditRow {
  id: number;
  actor_id: string | null;
  action: string;
  target: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

export const admin = {
  stats(sb: Client) {
    return unwrap<AdminStats>(sb.rpc('admin_stats'));
  },
  users(sb: Client, q: string) {
    return unwrap<AdminUser[]>(sb.rpc('admin_users', { p_query: q || null }));
  },
  adjustBalance(sb: Client, userId: string, cents: number, currency: MoneyCurrency, note: string) {
    return unwrap<null>(
      sb.rpc('admin_adjust_balance', {
        p_user: userId,
        p_cents: cents,
        p_currency: currency,
        p_note: note,
      }),
    );
  },
  restrict(sb: Client, userId: string, on: boolean, reason?: string) {
    return unwrap<null>(
      sb.rpc('admin_restrict_user', { p_user: userId, p_restrict: on, p_reason: reason ?? null }),
    );
  },
  tasks(sb: Client, filter: 'open' | 'hidden' | 'cancelled' | 'reported', q?: string) {
    return unwrap<AdminTask[]>(sb.rpc('admin_tasks', { p_filter: filter, p_query: q || null }));
  },
  hideTask(sb: Client, taskId: string, hide: boolean, reason?: string) {
    return unwrap<null>(
      sb.rpc('admin_hide_task', { p_task: taskId, p_hide: hide, p_reason: reason ?? null }),
    );
  },
  complaints(sb: Client, status?: string | null) {
    return unwrap<AdminComplaint[]>(sb.rpc('admin_complaints', { p_status: status ?? null }));
  },
  decideComplaint(sb: Client, id: string, status: AdminComplaint['status']) {
    return unwrap<null>(sb.rpc('admin_complaint_decide', { p_complaint: id, p_status: status }));
  },
  disputes(sb: Client) {
    return unwrap<AdminDispute[]>(
      sb.from('disputes').select('*').order('created_at', { ascending: false }).limit(200),
    );
  },
  decideDispute(
    sb: Client,
    id: string,
    decision: 'in_progress' | 'customer' | 'executor' | 'compromise' | 'rejected',
    executorCents?: number | null,
    note?: string,
  ) {
    return unwrap<null>(
      sb.rpc('admin_dispute_decide', {
        p_dispute: id,
        p_decision: decision,
        p_executor_cents: executorCents ?? null,
        p_note: note || null,
      }),
    );
  },
  tickets(sb: Client, status?: TicketStatus | null) {
    let q = sb
      .from('support_tickets')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(200);
    if (status) q = q.eq('status', status);
    return unwrap<Ticket[]>(q);
  },
  kyc(sb: Client, status: VerificationRequest['status'] = 'pending') {
    return unwrap<VerificationRequest[]>(
      sb
        .from('verification_requests')
        .select('*')
        .eq('status', status)
        .order('created_at')
        .limit(200),
    );
  },
  decideKyc(sb: Client, id: string, status: 'approved' | 'rejected' | 'need_docs', note?: string) {
    return unwrap<null>(
      sb.rpc('admin_verification_decide', {
        p_request: id,
        p_status: status,
        p_note: note || null,
      }),
    );
  },
  payouts(sb: Client, statuses: string[]) {
    return unwrap<AdminPayout[]>(
      sb
        .from('payouts')
        .select('*')
        .in('status', statuses)
        .order('created_at', { ascending: false })
        .limit(200),
    );
  },
  decidePayout(sb: Client, id: string, decision: 'approve' | 'hold' | 'reject', reason?: string) {
    return unwrap<null>(
      sb.rpc('admin_payout_decide', {
        p_payout: id,
        p_decision: decision,
        p_reason: reason ?? null,
      }),
    );
  },
  payments(sb: Client) {
    return unwrap<AdminPayment[]>(
      sb
        .from('payments')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(200),
    );
  },
  creditPayment(sb: Client, id: string) {
    return unwrap<null>(sb.rpc('admin_payment_credit', { p_payment: id }));
  },
  audit(sb: Client) {
    return unwrap<AuditRow[]>(
      sb.from('admin_audit').select('*').order('id', { ascending: false }).limit(100),
    );
  },
};
