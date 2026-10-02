import { formatMoney, shortName, t, type TranslationKey } from '@parri/shared';
import { useMe, useSignOut } from '@parri/shared/react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import { Screen } from '@/components/ui/Screen';
import { Avatar, Card, PageTitle, Pill, Row, SectionTitle } from '@/components/ui/bits';
import { ListGroup, ListRow } from '@/components/ui/kit';
import { Sparkles, Wallet } from '@/components/icons';
import { useTheme, type ThemePref } from '@/theme/ThemeProvider';

export default function Account() {
  const me = useMe();
  const theme = useTheme();
  const signOut = useSignOut();
  const p = me.data?.profile;
  return (
    <Screen title={t('account.title')} tabBar>
      <PageTitle>{t('account.title')}</PageTitle>
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar name={shortName(p?.first_name, p?.last_name)} url={p?.avatar_url} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title3">
            {p?.first_name} {p?.last_name}
          </AppText>
          <AppText variant="callout" color="textSecondary">
            {t('account.stats', { n: p?.completed_count ?? 0 })} · {formatMoney(p?.earned_cents ?? 0)} · {t(`account.${p?.plan ?? 'free'}` as TranslationKey)}
          </AppText>
          <AppText variant="callout" color="textSecondary">
            {me.data?.university?.name ?? `${t('account.university')}: ${t('account.noUniversity')}`}
          </AppText>
        </View>
      </Card>
      {!!me.data?.skills.length && (
        <View style={{ gap: 10 }}>
          <SectionTitle>{t('account.skills')}</SectionTitle>
          <Row>
            {me.data.skills.map((s) => (
              <Pill key={s}>{t(`skill.${s}` as TranslationKey)}</Pill>
            ))}
          </Row>
        </View>
      )}
      <ListGroup>
        <ListRow icon={(c) => <Wallet size={18} color={c} />} title={t('balance.title')} onPress={() => router.push('/balance')} />
        <ListRow icon={(c) => <Sparkles size={18} color={c} />} title={t('plans.title')} value={t(`account.${p?.plan ?? 'free'}` as TranslationKey)} onPress={() => router.push('/subscription')} />
      </ListGroup>
      <View style={{ gap: 10 }}>
        <SectionTitle>{t('account.theme')}</SectionTitle>
        <Segmented<ThemePref>
          value={theme.themePref}
          onChange={theme.setThemePref}
          options={[
            { value: 'system', label: t('common.themeSystem') },
            { value: 'light', label: t('common.themeLight') },
            { value: 'dark', label: t('common.themeDark') },
          ]}
        />
        <Row>
          <Chip label={t('showcase.reduceTransparency')} selected={theme.forceReduceTransparency} onPress={() => theme.setForceReduceTransparency(!theme.forceReduceTransparency)} />
          <Chip label={t('showcase.reduceMotion')} selected={theme.forceReduceMotion} onPress={() => theme.setForceReduceMotion(!theme.forceReduceMotion)} />
        </Row>
      </View>
      <Button
        variant="glass"
        label={t('account.logout')}
        onPress={async () => {
          await signOut();
          router.replace('/register');
        }}
      />
    </Screen>
  );
}
