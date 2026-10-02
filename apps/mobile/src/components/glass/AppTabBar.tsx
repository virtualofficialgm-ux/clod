import type { BottomTabBarProps } from 'expo-router/tabs';
import { router } from 'expo-router';
import { TabBar, type TabKey } from './TabBar';

const ROUTES: Record<string, TabKey> = { feed: 'feed', tasks: 'tasks', create: 'create', balance: 'balance', account: 'account' };

/** Адаптер навигатора вкладок к стеклянному таб-бару. «+» открывает создание задачи поверх вкладок. */
export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const current = state.routes[state.index]?.name ?? 'feed';
  return (
    <TabBar
      active={ROUTES[current] ?? 'feed'}
      onChange={(key) => {
        if (key === 'create') return router.push('/task/new');
        navigation.navigate(key);
      }}
    />
  );
}
