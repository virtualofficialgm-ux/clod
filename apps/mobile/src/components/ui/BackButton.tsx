import { t } from '@parri/shared';
import { router, type Href } from 'expo-router';
import { ChevronLeft } from '@/components/icons';
import { Button } from '@/components/glass/Button';
import { useTheme } from '@/theme/ThemeProvider';

export function BackButton({ to }: { to?: Href }) {
  const { colors } = useTheme();
  return (
    <Button
      variant="glass"
      size="icon"
      accessibilityLabel={t('common.back')}
      icon={<ChevronLeft size={22} strokeWidth={2.6} color={colors.text} />}
      onPress={() => (to ? router.replace(to) : router.canGoBack() ? router.back() : router.replace('/'))}
    />
  );
}
