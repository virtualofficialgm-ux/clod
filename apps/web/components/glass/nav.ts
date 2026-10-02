import { Home, ListChecks, Plus, User, Wallet, type LucideIcon } from 'lucide-react';
import type { TranslationKey } from '@parri/shared';

export interface NavItem {
  href: string;
  label: TranslationKey;
  icon: LucideIcon;
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/feed', label: 'nav.feed', icon: Home },
  { href: '/my-tasks', label: 'nav.tasks', icon: ListChecks },
  { href: '/tasks/new', label: 'nav.create', icon: Plus, primary: true },
  { href: '/balance', label: 'nav.balance', icon: Wallet },
  { href: '/account', label: 'nav.account', icon: User },
];
