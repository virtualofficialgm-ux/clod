import { unwrap, type Client } from './api';
import type { FullTaskStatus } from './types';

export interface Chat {
  task_id: string;
  title: string;
  status: FullTaskStatus;
  reward_cents: number;
  due_at: string | null;
  role: 'customer' | 'executor';
  counterpart_id: string;
  counterpart_name: string;
  counterpart_avatar: string | null;
  last_body: string | null;
  last_kind: 'text' | 'system' | null;
  last_sender: string | null;
  last_at: string | null;
  unread: number;
  counterpart_read_at: string | null;
}

export const chats = {
  list(sb: Client) {
    return unwrap<Chat[]>(sb.rpc('my_chats'));
  },
  markRead(sb: Client, taskId: string) {
    return unwrap<null>(sb.rpc('mark_chat_read', { p_task: taskId }));
  },
  /** Отметка прочтения собеседником (для «Прочитано») */
  async counterpartReadAt(sb: Client, taskId: string, counterpartId: string) {
    const rows = await unwrap<{ last_read_at: string }[]>(
      sb.from('chat_reads').select('last_read_at').eq('task_id', taskId).eq('user_id', counterpartId),
    );
    return rows[0]?.last_read_at ?? null;
  },
};
