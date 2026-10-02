import {
  Bell,
  Home,
  LayoutGrid,
  ListChecks,
  MessageCircle,
  Shield,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { TranslationKey } from '@parri/shared';

export interface NavItem {
  href: string;
  label: TranslationKey;
  icon: LucideIcon;
  /** Только у модераторов и администраторов */
  staff?: boolean;
  /** Счётчик на пункте меню */
  badge?: 'messages' | 'notifications';
}

/** Боковое меню на компьютере */
export const SIDEBAR_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'nav.dashboard', icon: Home },
  { href: '/feed', label: 'nav.feed', icon: LayoutGrid },
  { href: '/my-tasks', label: 'nav.myTasks', icon: ListChecks },
  { href: '/messages', label: 'nav.messages', icon: MessageCircle, badge: 'messages' },
  { href: '/notifications', label: 'nav.notifications', icon: Bell, badge: 'notifications' },
  { href: '/balance', label: 'nav.balance', icon: Wallet },
  { href: '/people', label: 'nav.people', icon: Users },
  { href: '/account', label: 'nav.profile', icon: User },
  { href: '/admin', label: 'nav.admin', icon: Shield, staff: true },
];

/** Таб-бар на телефоне: четыре вкладки + отдельная круглая кнопка «Создать» */
export const TAB_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'nav.dashboard', icon: Home },
  { href: '/feed', label: 'nav.feed', icon: LayoutGrid },
  { href: '/my-tasks', label: 'nav.tasks', icon: ListChecks },
  { href: '/messages', label: 'nav.messages', icon: MessageCircle, badge: 'messages' },
];

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + '/');
