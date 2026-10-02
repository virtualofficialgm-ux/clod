import type { Session } from '@supabase/supabase-js';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState } from 'react';
import {
  auth,
  taskExtras,
  profile,
  responses,
  room,
  savedSearches,
  tasks,
  toApiError,
  wallet,
  type ApiError,
  type Client,
} from './api';
import { chats } from './chats';
import { money } from './moneyApi';
import type { FeedParams, Message } from './types';

/**
 * React-хуки поверх API: общие для Next.js и Expo. Кэш — TanStack Query.
 */

const SupabaseContext = createContext<Client | null>(null);

export function SupabaseProvider({ client, children }: { client: Client; children: React.ReactNode }) {
  return <SupabaseContext.Provider value={client}>{children}</SupabaseContext.Provider>;
}

export function useSupabase(): Client {
  const sb = useContext(SupabaseContext);
  if (!sb) throw new Error('useSupabase must be used inside SupabaseProvider');
  return sb;
}

export const keys = {
  me: ['me'] as const,
  skills: ['skills'] as const,
  universities: (q: string) => ['universities', q] as const,
  feed: (p: unknown) => ['feed', p] as const,
  task: (id: string) => ['task', id] as const,
  responses: (id: string) => ['responses', id] as const,
  mine: (role: string) => ['my-tasks', role] as const,
  messages: (id: string) => ['messages', id] as const,
  saved: ['saved-searches'] as const,
  ledger: ['ledger'] as const,
  chats: ['chats'] as const,
  rates: ['fx-rates'] as const,
  payments: ['payments'] as const,
  payouts: ['payouts'] as const,
  refunds: ['refunds'] as const,
  subscription: ['subscription'] as const,
  connect: ['connect'] as const,
  addresses: ['crypto-addresses'] as const,
  questions: (id: string) => ['questions', id] as const,
  drafts: ['task-drafts'] as const,
  reviews: (id: string) => ['reviews', id] as const,
};

/** Текущая сессия; loading=true до первой проверки */
export function useSession(): { session: Session | null; loading: boolean } {
  const sb = useSupabase();
  const [state, setState] = useState<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
  useEffect(() => {
    let alive = true;
    sb.auth.getSession().then(({ data }) => alive && setState({ session: data.session, loading: false }));
    const { data } = sb.auth.onAuthStateChange((_event, session) => setState({ session, loading: false }));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [sb]);
  return state;
}

export function useMe(enabled = true) {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.me, queryFn: () => profile.me(sb), enabled, staleTime: 30_000 });
}

export function useSkills() {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.skills, queryFn: () => profile.skills(sb), staleTime: Infinity });
}

export function useUniversitySearch(query: string) {
  const sb = useSupabase();
  const q = query.trim();
  return useQuery({
    queryKey: keys.universities(q),
    queryFn: () => profile.searchUniversities(sb, q),
    enabled: q.length >= 2,
    staleTime: 5 * 60_000,
  });
}

const PAGE = 20;

export function useFeed(params: FeedParams, coords: { lat: number; lng: number } | null, enabled = true) {
  const sb = useSupabase();
  return useInfiniteQuery({
    queryKey: keys.feed({ ...params, coords }),
    queryFn: ({ pageParam }) =>
      tasks.feed(sb, { ...params, lat: coords?.lat ?? null, lng: coords?.lng ?? null, limit: PAGE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
    enabled,
  });
}

export function useTaskDetail(id: string | undefined) {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.task(id ?? ''), queryFn: () => tasks.detail(sb, id!), enabled: !!id });
}

export function useTaskResponses(id: string | undefined, enabled = true) {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.responses(id ?? ''), queryFn: () => responses.forTask(sb, id!), enabled: !!id && enabled });
}

export function useMyTasks(role: 'customer' | 'executor') {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.mine(role), queryFn: () => tasks.mine(sb, role) });
}

export function useSavedSearches(enabled = true) {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.saved, queryFn: () => savedSearches.list(sb), enabled });
}

export function useLedger() {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.ledger, queryFn: () => wallet.ledger(sb) });
}

/**
 * Сообщения рабочей комнаты: Realtime-подписка; если канал не поднялся за 3 с —
 * опрос раз в 4 с (например, в локальном devstack без Realtime).
 */
export function useRoomMessages(taskId: string | undefined) {
  const sb = useSupabase();
  const qc = useQueryClient();
  const [live, setLive] = useState(false);
  const key = keys.messages(taskId ?? '');

  useEffect(() => {
    if (!taskId) return;
    const unsubscribe = room.subscribe(
      sb,
      taskId,
      (m) => {
        qc.setQueryData<Message[]>(key, (prev) => (prev?.some((x) => x.id === m.id) ? prev : [...(prev ?? []), m]));
        if (m.kind === 'system') void qc.invalidateQueries({ queryKey: keys.task(taskId) });
      },
      setLive,
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb, taskId]);

  return useQuery({
    queryKey: key,
    queryFn: () => room.messages(sb, taskId!),
    enabled: !!taskId,
    refetchInterval: live ? false : 4000,
  });
}

/** Мутация с переводом ошибок в ApiError и инвалидацией связанных запросов */
export function useApiMutation<TVars, TResult>(
  fn: (sb: Client, vars: TVars) => Promise<TResult>,
  opts: { invalidate?: (vars: TVars, result: TResult) => QueryKey[]; onSuccess?: (result: TResult, vars: TVars) => void } = {},
) {
  const sb = useSupabase();
  const qc = useQueryClient();
  return useMutation<TResult, ApiError, TVars>({
    mutationFn: async (vars) => {
      try {
        return await fn(sb, vars);
      } catch (e) {
        throw toApiError(e);
      }
    },
    onSuccess: async (result, vars) => {
      await Promise.all((opts.invalidate?.(vars, result) ?? []).map((k) => qc.invalidateQueries({ queryKey: k })));
      opts.onSuccess?.(result, vars);
    },
  });
}

export function useSignOut() {
  const sb = useSupabase();
  const qc = useQueryClient();
  return async () => {
    await auth.signOut(sb);
    qc.clear();
  };
}

/** Список чатов: обновляется раз в 15 с (и сразу после отправки/прочтения) */
export function useChats(enabled = true) {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.chats, queryFn: () => chats.list(sb), enabled, refetchInterval: 15_000 });
}

/** Общее число непрочитанных сообщений — для значка на вкладке */
export function useUnreadCount(enabled = true) {
  const q = useChats(enabled);
  return q.data?.reduce((s, c) => s + c.unread, 0) ?? 0;
}

// ---------- Деньги ----------
export function useRates() {
  const sb = useSupabase();
  return useQuery({
    queryKey: keys.rates,
    queryFn: () => money.rates(sb),
    staleTime: 10 * 60_000,
    select: (rows) => Object.fromEntries(rows.map((r) => [r.currency, r])) as Record<string, (typeof rows)[number]>,
  });
}
export function usePayments() {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.payments, queryFn: () => money.payments(sb) });
}
export function usePayouts() {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.payouts, queryFn: () => money.payouts(sb) });
}
export function useRefunds() {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.refunds, queryFn: () => money.refunds(sb) });
}
export function useSubscription() {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.subscription, queryFn: () => money.subscription(sb) });
}
export function useConnectAccount() {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.connect, queryFn: () => money.connectAccount(sb) });
}
export function useCryptoAddresses() {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.addresses, queryFn: () => money.cryptoAddresses(sb) });
}

// ---------- Задачи: вопросы, черновики, отзывы ----------
export function useTaskQuestions(taskId: string | undefined) {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.questions(taskId ?? ''), queryFn: () => taskExtras.questions(sb, taskId!), enabled: !!taskId });
}
export function useTaskDrafts(enabled = true) {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.drafts, queryFn: () => taskExtras.drafts(sb), enabled });
}
export function useReviewsFor(userId: string | undefined) {
  const sb = useSupabase();
  return useQuery({ queryKey: keys.reviews(userId ?? ''), queryFn: () => taskExtras.reviewsFor(sb, userId!), enabled: !!userId });
}
