import { SupabaseProvider } from '@parri/shared/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PortalHost } from '@/components/ui/Portal';
import { ToastProvider } from '@/components/ui/bits';
import { DEMO, supabase } from '@/lib/supabase';
import { fontAssets } from '@/theme/fonts';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

function Navigator() {
  const { name, colors } = useTheme();
  return (
    <ToastProvider>
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <PortalHost>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      </PortalHost>
    </ToastProvider>
  );
}

export default function RootLayout() {
  // В демо одной страницей шрифты встроены в саму страницу (@font-face с теми же именами)
  const [loaded] = useFonts(DEMO ? {} : fontAssets);
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }),
  );
  if (!loaded) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SupabaseProvider client={supabase}>
            <QueryClientProvider client={queryClient}>
              <Navigator />
            </QueryClientProvider>
          </SupabaseProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
