import { t } from '@parri/shared';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { MeshBackground } from '@/components/glass/MeshBackground';
import { useTheme } from '@/theme/ThemeProvider';

export default function NotFound() {
  const { colors } = useTheme();
  return (
    <View
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 14 }}
      testID="service-screen"
    >
      <MeshBackground />
      <AppText variant="number" style={{ color: colors.accent }}>
        404
      </AppText>
      <AppText variant="title2" style={{ textAlign: 'center' }}>
        {t('service.notFound')}
      </AppText>
      <AppText variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
        {t('service.notFoundText')}
      </AppText>
      <Button label={t('service.home')} onPress={() => router.replace('/home')} />
      <Button variant="glass" label={t('nav.support')} onPress={() => router.push('/support')} />
    </View>
  );
}
