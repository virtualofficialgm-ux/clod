import { ApiError, unwrap, type Client } from './api';
import type { Category, Deadline, TaskKind } from './constants';
import type { MoneyCurrency } from './money';
import type { Experience, FullTaskStatus, PortfolioItem, ProfileLink, WorkLanguage } from './types';

// ---------- Типы ----------

export type PrivacyScope = 'all' | 'me';
export type PrivacyWho = 'all' | 'contacts' | 'clients';
export interface Privacy {
  profile: PrivacyScope;
  city: PrivacyScope;
  online: PrivacyScope;
  activity: PrivacyScope;
  reviews: PrivacyScope;
  portfolio: PrivacyScope;
  history: PrivacyScope;
  who_message: PrivacyWho;
  who_invite: PrivacyWho;
  who_follow: PrivacyWho;
  search_engines: boolean;
  university: boolean;
  recommendations: boolean;
}
export const DEFAULT_PRIVACY: Privacy = {
  profile: 'all',
  city: 'all',
  online: 'all',
  activity: 'all',
  reviews: 'all',
  portfolio: 'all',
  history: 'all',
  who_message: 'all',
  who_invite: 'all',
  who_follow: 'all',
  search_engines: true,
  university: true,
  recommendations: true,
};
export const PRIVACY_SCOPES = [
  'profile',
  'city',
  'online',
  'activity',
  'reviews',
  'portfolio',
  'history',
] as const;
export const PRIVACY_WHO = ['who_message', 'who_invite', 'who_follow'] as const;
export const PRIVACY_FLAGS = ['search_engines', 'university', 'recommendations'] as const;
export const withDefaults = (p: Partial<Privacy> | null | undefined): Privacy => ({
  ...DEFAULT_PRIVACY,
  ...(p ?? {}),
});

export type ContactState = 'none' | 'outgoing' | 'incoming' | 'accepted';

export interface PublicProfile {
  id: string;
  name: string;
  private?: boolean;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  profession: string | null;
  bio: string | null;
  country_code: string | null;
  city: string | null;
  languages: WorkLanguage[];
  links: ProfileLink[];
  platform_role: 'executor' | 'customer' | 'both';
  availability: 'available' | 'busy' | 'hidden';
  response_time: '5m' | '1h' | '3h' | 'day' | null;
  experience_level: 'junior' | 'middle' | 'expert' | null;
  plan: 'free' | 'pro';
  verified: boolean;
  created_at: string;
  last_seen_at: string | null;
  university: { id: number; name: string } | null;
  stats: {
    rating_avg: number | null;
    rating_count: number;
    completed: number;
    earned_cents: number | null;
    customer_completed: number;
    followers: number;
    following: number;
    contacts: number;
  };
  aspects: {
    quality: number | null;
    communication: number | null;
    deadlines: number | null;
    requirements: number | null;
  } | null;
  skills: { slug: string; level: string | null }[];
  custom_skills: string[];
  experience: Omit<Experience, 'profile_id'>[];
  portfolio: Omit<PortfolioItem, 'profile_id'>[];
  open_tasks: {
    id: string;
    title: string;
    reward_cents: number;
    currency: MoneyCurrency;
    category: Category;
    kind: TaskKind;
    deadline: Deadline;
  }[];
  relation: {
    self: boolean;
    following: boolean;
    followed_by: boolean;
    contact: ContactState;
    blocked: boolean;
    can_message: boolean;
    can_invite: boolean;
    can_follow: boolean;
  };
  privacy?: Partial<Privacy>;
  hidden_fields?: string[];
}

export interface PersonCard {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  city: string | null;
  country_code: string | null;
  rating_avg: number | null;
  rating_count: number;
  completed_count: number;
  availability: 'available' | 'busy' | 'hidden';
  platform_role: 'executor' | 'customer' | 'both';
  skills: string[];
  verified: boolean;
  plan: 'free' | 'pro';
}

export interface PeopleQuery {
  query?: string;
  role?: 'all' | 'executors' | 'customers';
  skill?: string | null;
  city?: string | null;
  minRating?: number | null;
  available?: boolean;
  sort?: 'relevance' | 'rating' | 'experience';
}

export type ConnectionKind = 'followers' | 'following' | 'contacts' | 'requests';
export interface Connection {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  headline: string | null;
  city: string | null;
  rating_avg: number | null;
  completed_count: number;
  since: string;
  incoming: boolean;
}

export interface Invitation {
  id: string;
  task_id: string;
  title: string;
  reward_cents: number;
  currency: MoneyCurrency;
  task_status: FullTaskStatus;
  from_id: string;
  from_name: string;
  from_avatar: string | null;
  to_id: string;
  to_name: string;
  message: string | null;
  respond_by: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  created_at: string;
  incoming: boolean;
}

export type NotificationKind =
  | 'new_response'
  | 'response_rejected'
  | 'executor_assigned'
  | 'task_taken'
  | 'work_started'
  | 'work_submitted'
  | 'work_accepted'
  | 'revision_requested'
  | 'dispute_opened'
  | 'executor_refused'
  | 'take_expired'
  | 'extension_requested'
  | 'extension_accepted'
  | 'extension_declined'
  | 'tip_sent'
  | 'new_message'
  | 'direct_message'
  | 'new_follower'
  | 'contact_request'
  | 'contact_accepted'
  | 'task_invitation'
  | 'invitation_declined'
  | 'skill_task';

export interface AppNotification {
  id: number;
  kind: NotificationKind;
  actor_id: string | null;
  actor_name: string | null;
  actor_avatar: string | null;
  task_id: string | null;
  payload: Record<string, unknown> & { title?: string };
  read_at: string | null;
  created_at: string;
}

/** Куда ведёт уведомление: задача, комната, профиль, связи, личная переписка */
export function notificationTarget(
  n: Pick<AppNotification, 'kind' | 'task_id' | 'actor_id'>,
):
  | { to: 'task' | 'room' | 'responses'; id: string }
  | { to: 'profile' | 'direct'; id: string }
  | { to: 'connections'; tab: 'followers' | 'requests' | 'contacts' | 'invitations' }
  | null {
  switch (n.kind) {
    case 'new_response':
      return n.task_id ? { to: 'responses', id: n.task_id } : null;
    case 'new_message':
    case 'work_submitted':
    case 'revision_requested':
    case 'extension_requested':
    case 'extension_accepted':
    case 'extension_declined':
    case 'executor_assigned':
    case 'work_started':
    case 'dispute_opened':
    case 'tip_sent':
      return n.task_id ? { to: 'room', id: n.task_id } : null;
    case 'direct_message':
      return n.actor_id ? { to: 'direct', id: n.actor_id } : null;
    case 'new_follower':
      return { to: 'connections', tab: 'followers' };
    case 'contact_request':
      return { to: 'connections', tab: 'requests' };
    case 'contact_accepted':
      return n.actor_id ? { to: 'profile', id: n.actor_id } : null;
    case 'task_invitation':
      return { to: 'connections', tab: 'invitations' };
    default:
      return n.task_id ? { to: 'task', id: n.task_id } : null;
  }
}

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface DirectThread {
  peer_id: string;
  peer_name: string;
  peer_avatar: string | null;
  peer_username: string | null;
  last_body: string;
  last_sender: string;
  last_at: string;
  unread: number;
  peer_read_at: string | null;
}

export interface PeerState {
  read_at: string | null;
  typing: boolean;
  last_seen_at: string | null;
}

export interface ExitBlockers {
  active_tasks: number;
  open_tasks: number;
  balance_cents: number;
  pending_payouts: number;
}

export interface BlockedUser {
  id: string;
  name: string;
  avatar_url: string | null;
  username: string | null;
  blocked_at: string;
}

export interface ReviewOf {
  id: string;
  rating: number;
  quality: number | null;
  communication: number | null;
  deadlines: number | null;
  requirements: number | null;
  public_text: string | null;
  author_role: 'customer' | 'executor';
  created_at: string;
  author_id: string | null;
  author_name: string | null;
  author_avatar: string | null;
  task_id: string | null;
  task_title: string | null;
}

// ---------- API ----------

export const people = {
  search(sb: Client, q: PeopleQuery, page = 0, size = 30) {
    return unwrap<PersonCard[]>(
      sb.rpc('search_people', {
        p_query: q.query?.trim() || null,
        p_role: q.role ?? 'all',
        p_skill: q.skill ?? null,
        p_city: q.city?.trim() || null,
        p_min_rating: q.minRating ?? null,
        p_available: q.available ?? false,
        p_sort: q.sort ?? 'relevance',
        p_limit: size,
        p_offset: page * size,
      }),
    );
  },
  profile(sb: Client, handle: string) {
    return unwrap<PublicProfile | null>(sb.rpc('public_profile', { p_handle: handle }));
  },
  reviews(sb: Client, userId: string) {
    return unwrap<ReviewOf[]>(sb.rpc('reviews_of', { p_user: userId }));
  },
  follow(sb: Client, userId: string, on: boolean) {
    return unwrap<null>(sb.rpc('follow_user', { p_user: userId, p_on: on }));
  },
  contactRequest(sb: Client, userId: string) {
    return unwrap<'pending' | 'accepted'>(sb.rpc('contact_request', { p_user: userId }));
  },
  contactRespond(sb: Client, userId: string, accept: boolean) {
    return unwrap<null>(sb.rpc('contact_respond', { p_user: userId, p_accept: accept }));
  },
  contactRemove(sb: Client, userId: string) {
    return unwrap<null>(sb.rpc('contact_remove', { p_user: userId }));
  },
  block(sb: Client, userId: string, on: boolean) {
    return unwrap<null>(sb.rpc('block_user', { p_user: userId, p_on: on }));
  },
  blocked(sb: Client) {
    return unwrap<BlockedUser[]>(sb.rpc('my_blocked'));
  },
  connections(sb: Client, kind: ConnectionKind) {
    return unwrap<Connection[]>(sb.rpc('my_connections', { p_kind: kind }));
  },
  invite(sb: Client, taskId: string, userId: string, message: string, days: 1 | 3 | 7) {
    return unwrap<{ id: string }>(
      sb.rpc('invite_to_task', {
        p_task: taskId,
        p_user: userId,
        p_message: message,
        p_days: days,
      }),
    );
  },
  respondInvitation(sb: Client, id: string, accept: boolean) {
    return unwrap<{ id: string; task_id: string }>(
      sb.rpc('respond_invitation', { p_invitation: id, p_accept: accept }),
    );
  },
  invitations(sb: Client) {
    return unwrap<Invitation[]>(sb.rpc('my_invitations'));
  },
};

export const notifications = {
  list(sb: Client, limit = 50) {
    return unwrap<AppNotification[]>(sb.rpc('my_notifications', { p_limit: limit }));
  },
  unread(sb: Client) {
    return unwrap<number>(sb.rpc('unread_notifications'));
  },
  markRead(sb: Client, ids?: number[]) {
    return unwrap<null>(sb.rpc('mark_notifications_read', { p_ids: ids ?? null }));
  },
  clear(sb: Client) {
    return unwrap<null>(sb.rpc('clear_notifications'));
  },
  registerPush(sb: Client, token: string, platform: 'ios' | 'android' | 'web') {
    return unwrap<null>(sb.rpc('register_push_token', { p_token: token, p_platform: platform }));
  },
};

export const direct = {
  threads(sb: Client) {
    return unwrap<DirectThread[]>(sb.rpc('my_direct_threads'));
  },
  with(sb: Client, userId: string) {
    return unwrap<DirectMessage[]>(sb.rpc('direct_with', { p_user: userId }));
  },
  send(sb: Client, userId: string, body: string) {
    return unwrap<DirectMessage>(sb.rpc('send_direct', { p_to: userId, p_body: body }));
  },
  markRead(sb: Client, userId: string) {
    return unwrap<null>(sb.rpc('mark_direct_read', { p_user: userId }));
  },
};

export const presence = {
  /** «Печатает»: в чате задачи (taskId) или в личной переписке (peerId) */
  typing(sb: Client, where: { taskId?: string; peerId?: string }) {
    return unwrap<null>(
      sb.rpc('set_typing', { p_task: where.taskId ?? null, p_peer: where.peerId ?? null }),
    );
  },
  peer(sb: Client, where: { taskId?: string; peerId?: string }) {
    return unwrap<PeerState | null>(
      sb.rpc('peer_state', { p_task: where.taskId ?? null, p_peer: where.peerId ?? null }),
    );
  },
};

export const account = {
  savePrivacy(sb: Client, p: Partial<Privacy>) {
    return unwrap<Partial<Privacy>>(sb.rpc('save_privacy', { p }));
  },
  exitBlockers(sb: Client) {
    return unwrap<ExitBlockers>(sb.rpc('account_exit_blockers'));
  },
  deactivate(sb: Client, reason: string, confirm: string) {
    return unwrap<null>(sb.rpc('deactivate_account', { p_reason: reason, p_confirm: confirm }));
  },
  remove(sb: Client, reason: string, confirm: string) {
    return unwrap<null>(sb.rpc('delete_account', { p_reason: reason, p_confirm: confirm }));
  },
  restore(sb: Client) {
    return unwrap<null>(sb.rpc('restore_account'));
  },
  /** Проверка пароля перед опасными действиями: повторный вход тем же паролем */
  async verifyPassword(sb: Client, email: string, password: string) {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw new ApiError('errors.wrong_password', error.message);
  },
  async changePassword(sb: Client, password: string) {
    const { error } = await sb.auth.updateUser({ password });
    if (error)
      throw new ApiError(
        /weak|short/i.test(error.message)
          ? 'errors.weak_password'
          : /same/i.test(error.message)
            ? 'errors.same_password'
            : 'errors.unknown',
        error.message,
      );
  },
  /** Выход на всех устройствах */
  async signOutEverywhere(sb: Client) {
    await sb.auth.signOut({ scope: 'global' });
  },
};

/** «Был в сети 5 минут назад» / «в сети» */
export function isOnline(lastSeen: string | null | undefined, now = Date.now()): boolean {
  return !!lastSeen && now - new Date(lastSeen).getTime() < 3 * 60_000;
}
