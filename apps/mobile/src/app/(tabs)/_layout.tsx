import { useMe, useSession } from '@parri/shared/react';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';
import { View } from 'react-native';
import { AppTabBar } from '@/components/glass/AppTabBar';
import { AccountStateScreen } from '@/components/social/AccountStateScreen';
import { Center } from '@/components/ui/bits';

export default function TabsLayout() {
  const { session, loading } = useSession();
  const me = useMe(!!session);
  if (loading || (session && me.isLoading)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Center />
      </View>
    );
  }
  if (!session) return <Redirect href="/register" />;
  if (me.data?.profile.onboarding !== 'done') return <Redirect href="/register" />;
  if (me.data.profile.banned_at || me.data.profile.deleted_at) return <AccountStateScreen state="blocked" />;
  if (me.data.profile.deactivated_at) return <AccountStateScreen state="deactivated" />;
  return (
    <Tabs tabBar={(props) => <AppTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="balance" />
      <Tabs.Screen name="account" />
    </Tabs>
  );
}
