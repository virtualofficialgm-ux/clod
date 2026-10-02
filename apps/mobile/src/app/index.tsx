import { useMe, useSession } from '@parri/shared/react';
import { Redirect } from 'expo-router';
import { View } from 'react-native';
import { Center } from '@/components/ui/bits';

/** Развилка при запуске: гость → приветствие, незаконченная регистрация → регистрация, иначе главная */
export default function Index() {
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
  return <Redirect href="/home" />;
}
