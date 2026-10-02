import type { BottomTabBarProps } from 'expo-router/tabs';
import { router } from 'expo-router';
import { TabBar, type TabKey } from './TabBar';

const TAB_KEYS = new Set<string>(['home', 'feed', 'tasks', 'messages']);

/** Адаптер навигатора вкладок к стеклянному таб-бару. «+» открывает создание задачи поверх вкладок. */
export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const current = state.routes[state.index]?.name ?? 'home';
  return (
    <TabBar
      active={TAB_KEYS.has(current) ? (current as TabKey) : null}
      onChange={(key) => navigation.navigate(key)}
      onCreate={() => router.push('/task/new')}
    />
  );
}
