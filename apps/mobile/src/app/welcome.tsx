import { formatMoney, showcaseTasks, t } from '@parri/shared';
import { router } from 'expo-router';
import { Lock, ListChecks, Scale } from 'lucide-react-native';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/bits';
import { useTheme } from '@/theme/ThemeProvider';

export default function Welcome() {
  const { colors } = useTheme();
  const icon = (I: typeof Lock) => <I size={24} strokeWidth={2.4} color={colors.accentText} />;
  return (
    <Screen title={t('app.name')}>
      <AppText variant="display" accessibilityRole="header">
        {t('landing.heroTitle')}
      </AppText>
      <AppText variant="title3" color="textSecondary">
        {t('landing.heroSubtitle')}
      </AppText>
      <View style={{ gap: 12 }}>
        <Button size="lg" block label={t('landing.start')} onPress={() => router.push('/register')} />
        <Button size="lg" block variant="glass" label={t('landing.login')} onPress={() => router.push('/login')} />
      </View>
      <GlassSurface style={{ padding: 12, gap: 8 }}>
        <AppText variant="caption" color="textSecondary" style={{ paddingHorizontal: 8, paddingTop: 4, textTransform: 'uppercase' }}>
          {t('landing.examples')}
        </AppText>
        {showcaseTasks.slice(0, 3).map((task) => (
          <Card key={task.id} style={{ padding: 14, gap: 4, flexDirection: 'row', alignItems: 'center' }}>
            <AppText variant="title3" color="accentText" tabular style={{ width: 64 }}>
              {formatMoney(task.rewardCents)}
            </AppText>
            <AppText variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>
              {task.title}
            </AppText>
          </Card>
        ))}
      </GlassSurface>
      <AppText variant="title2" accessibilityRole="header">
        {t('landing.safetyTitle')}
      </AppText>
      {[
        [Lock, 'landing.safety1Title', 'landing.safety1'],
        [ListChecks, 'landing.safety2Title', 'landing.safety2'],
        [Scale, 'landing.safety3Title', 'landing.safety3'],
      ].map(([I, title, text]) => (
        <Card key={title as string}>
          {icon(I as typeof Lock)}
          <AppText variant="title3">{t(title as 'landing.safety1Title')}</AppText>
          <AppText variant="body" color="textSecondary">
            {t(text as 'landing.safety1')}
          </AppText>
        </Card>
      ))}
      <AppText variant="callout" color="textSecondary">
        {t('fees.rule')}
      </AppText>
    </Screen>
  );
}
