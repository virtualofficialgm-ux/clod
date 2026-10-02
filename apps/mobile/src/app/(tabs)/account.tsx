import {
  formatMoney,
  languageName,
  profile as profileApi,
  profileCompleteness,
  shortName,
  t,
  type TranslationKey,
} from '@parri/shared';
import { keys, useApiMutation, useMe, useSession, useSignOut } from '@parri/shared/react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import {
  BadgeCheck,
  Bookmark,
  GraduationCap,
  LifeBuoy,
  Link,
  ListChecks,
  PenLine,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  User,
  Users,
  Wallet,
} from '@/components/icons';
import { NotificationBell } from '@/components/social/NotificationBell';
import { Screen } from '@/components/ui/Screen';
import { Avatar, Center, PageTitle, Row } from '@/components/ui/bits';
import {
  Card,
  CardHeader,
  ListGroup,
  ListRow,
  ProgressRing,
  SoonBadge,
  StatTile,
  Toggle,
} from '@/components/ui/kit';
import { useTheme, type ThemePref } from '@/theme/ThemeProvider';

export default function Account() {
  const me = useMe();
  const theme = useTheme();
  const { colors } = theme;
  const { session } = useSession();
  const signOut = useSignOut();
  const notify = useApiMutation(
    (sb, on: boolean) => profileApi.saveData(sb, { notify_skill_tasks: on }),
    { invalidate: () => [keys.me] },
  );
  if (!me.data)
    return (
      <Screen title={t('account.title')} tabBar>
        <Center />
      </Screen>
    );
  const p = me.data.profile;
  const name = shortName(p.first_name, p.last_name);
  const completeness = profileCompleteness(me.data);
  const handle = p.username ?? p.id;
  return (
    <Screen
      title={t('account.title')}
      tabBar
      onRefresh={() => me.refetch()}
      actions={<NotificationBell />}
    >
      <PageTitle>{t('account.title')}</PageTitle>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Avatar name={name} url={p.avatar_url} size={72} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <AppText variant="title3" testID="account-name" numberOfLines={1}>
                {p.display_name || `${p.first_name ?? ''} ${p.last_name ?? ''}`}
              </AppText>
              {p.verified_at ? <BadgeCheck size={18} color={colors.accent} /> : null}
            </View>
            <AppText variant="callout" color="textSecondary" numberOfLines={1}>
              {[p.username ? `@${p.username}` : null, p.city].filter(Boolean).join(' · ')}
            </AppText>
            {session?.user.email ? (
              <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                {session.user.email}
              </AppText>
            ) : null}
            {p.languages.length ? (
              <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                {p.languages.map((l) => languageName(l.code)).join(', ')}
              </AppText>
            ) : null}
            <AppText variant="caption" color="textSecondary">
              {t('profile.parriId')}: {p.id.slice(0, 8).toUpperCase()}
            </AppText>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Button
              block
              icon={<PenLine size={16} color={colors.onAccent} />}
              label={t('profile.edit')}
              onPress={() => router.push('/account-edit')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              variant="glass"
              block
              label={t('profile.viewPublic')}
              onPress={() => router.push(`/u/${handle}`)}
            />
          </View>
        </View>
      </Card>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[
          [p.rating_avg ? Number(p.rating_avg).toFixed(1) : '—', t('profile.rating')],
          [p.completed_count, t('profile.completed')],
          [formatMoney(p.earned_cents, 'ru-RU', { compact: true }), t('profile.earned')],
        ].map(([v, l]) => (
          <View key={String(l)} style={{ flex: 1 }}>
            <StatTile value={v as string} label={l as string} />
          </View>
        ))}
      </View>
      <Card style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ProgressRing value={completeness.percent / 100} size={64} stroke={8}>
          <AppText variant="callout" style={{ fontWeight: '800' }}>
            {completeness.percent}%
          </AppText>
        </ProgressRing>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{t('account.completeness')}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('profile.passportText')}
          </AppText>
        </View>
      </Card>
      <Card>
        <CardHeader title={t('profile.trust')} />
        {(['t1', 't2', 't3'] as const).map((k) => (
          <View key={k} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Shield size={14} color={colors.success} />
            <AppText variant="callout">{t(`profile.trustItems.${k}`)}</AppText>
          </View>
        ))}
      </Card>
      <ListGroup>
        <ListRow
          icon={(c) => <Star size={18} color={c} />}
          title={t('profile.sections.skillsPortfolio')}
          value={String(me.data.skills.length)}
          onPress={() => router.push('/account-edit')}
        />
        <ListRow
          icon={(c) => <GraduationCap size={18} color={c} />}
          title={t('profile.sections.educationExperience')}
          onPress={() => router.push('/account-edit')}
        />
        <ListRow
          icon={(c) => <User size={18} color={c} />}
          title={t('profile.sections.aboutInterests')}
          onPress={() => router.push('/account-edit')}
        />
        <ListRow
          icon={(c) => <Link size={18} color={c} />}
          title={t('profile.sections.linksContacts')}
          onPress={() => router.push('/account-edit')}
        />
        <ListRow
          icon={(c) => <ListChecks size={18} color={c} />}
          title={t('profile.sections.allTasks')}
          onPress={() => router.navigate('/tasks')}
        />
        <ListRow
          icon={(c) => <Star size={18} color={c} />}
          title={t('profile.sections.reviews')}
          onPress={() => router.push(`/u/${handle}?tab=reviews`)}
        />
      </ListGroup>
      <ListGroup>
        <ListRow
          icon={(c) => <Sparkles size={18} color={c} />}
          title={t('profile.sections.subscription')}
          value={t(`account.${p.plan}` as TranslationKey)}
          onPress={() => router.push('/subscription')}
        />
        <ListRow
          icon={(c) => <Users size={18} color={c} />}
          title={t('profile.sections.connections')}
          onPress={() => router.push('/connections')}
        />
        <ListRow
          icon={(c) => <Search size={18} color={c} />}
          title={t('profile.sections.people')}
          onPress={() => router.push('/people')}
        />
        <ListRow
          icon={(c) => <Bookmark size={18} color={c} />}
          title={t('profile.sections.savedSearches')}
          onPress={() => router.navigate('/feed')}
        />
        <ListRow
          icon={(c) => <Wallet size={18} color={c} />}
          title={t('profile.sections.balance')}
          onPress={() => router.push('/balance')}
        />
        <ListRow
          icon={(c) => <Settings size={18} color={c} />}
          title={t('profile.sections.settings')}
          onPress={() => router.push('/settings')}
        />
        <ListRow
          icon={(c) => <LifeBuoy size={18} color={c} />}
          title={t('messages.support')}
          trailing={<SoonBadge />}
        />
      </ListGroup>
      <Card>
        <Toggle
          value={p.notify_skill_tasks}
          onChange={(on) => notify.mutate(on)}
          label={t('profile.skillNotify')}
        />
        <ListRow title={t('settings.language')} value="Русский" />
        <AppText variant="bodyStrong">{t('account.theme')}</AppText>
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
          <Chip
            label={t('showcase.reduceTransparency')}
            selected={theme.forceReduceTransparency}
            onPress={() => theme.setForceReduceTransparency(!theme.forceReduceTransparency)}
          />
          <Chip
            label={t('showcase.reduceMotion')}
            selected={theme.forceReduceMotion}
            onPress={() => theme.setForceReduceMotion(!theme.forceReduceMotion)}
          />
        </Row>
      </Card>
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
