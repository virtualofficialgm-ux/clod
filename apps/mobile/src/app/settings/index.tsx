import {
  ApiError,
  DEFAULT_PRIVACY,
  PRIVACY_FLAGS,
  PRIVACY_SCOPES,
  PRIVACY_WHO,
  account,
  formatDateTime,
  passwordSchema,
  people,
  profile as profileApi,
  t,
  withDefaults,
  type Privacy,
} from '@parri/shared';
import {
  keys,
  useApiMutation,
  useBlocked,
  useMe,
  useSession,
  useSignOut,
} from '@parri/shared/react';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Segmented } from '@/components/glass/Segmented';
import { KeyRound, LogOut, Mail, MonitorSmartphone, Phone, ShieldCheck } from '@/components/icons';
import { ConfirmSheet } from '@/components/task/Sheets';
import { BackButton } from '@/components/ui/BackButton';
import { Screen } from '@/components/ui/Screen';
import { FormError, TextField } from '@/components/ui/TextField';
import { Avatar, Center, EmptyState, Label, PageTitle, Row, useToast } from '@/components/ui/bits';
import { Card, CardHeader, ListGroup, ListRow, SoonBadge, Toggle } from '@/components/ui/kit';
import { useTheme } from '@/theme/ThemeProvider';

const TABS = [
  'account',
  'security',
  'login',
  'notifications',
  'privacy',
  'payments',
  'blocked',
] as const;
type Tab = (typeof TABS)[number];

function AccountTab() {
  const me = useMe();
  const toast = useToast();
  const { session } = useSession();
  const [phone, setPhone] = useState(me.data!.private.phone ?? '');
  const save = useApiMutation((sb) => profileApi.saveData(sb, { phone: phone.trim() || null }), {
    invalidate: () => [keys.me],
    onSuccess: () => toast(t('settings.contactsSaved')),
  });
  const currency = useApiMutation(
    (sb, v: 'USD' | 'RUB') => profileApi.saveData(sb, { display_currency: v }),
    { invalidate: () => [keys.me] },
  );
  return (
    <>
      <Card>
        <TextField label={t('settings.email')} value={session?.user.email ?? ''} editable={false} />
        <TextField
          label={t('settings.phone')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+7…"
        />
        <FormError error={save.error?.key} />
        <Button
          label={t('settings.saveContacts')}
          disabled={save.isPending}
          onPress={() => save.mutate(undefined)}
        />
      </Card>
      <Card>
        <AppText variant="bodyStrong">{t('settings.currency')}</AppText>
        <Segmented
          value={me.data!.profile.display_currency === 'RUB' ? 'RUB' : 'USD'}
          onChange={(v) => currency.mutate(v)}
          options={[
            { value: 'USD', label: 'USD' },
            { value: 'RUB', label: 'RUB' },
          ]}
        />
        <AppText variant="caption" color="textSecondary">
          {t('settings.currencyHint')}
        </AppText>
      </Card>
      <ListGroup>
        <ListRow
          title={t('settings.profileVisibility')}
          value={t('settings.configure')}
          onPress={() => router.setParams({ tab: 'privacy' })}
        />
        <ListRow title={t('settings.language')} value="Русский" />
        <ListRow
          title={t('settings.deactivate')}
          onPress={() => router.push('/settings/exit?mode=deactivate')}
        />
        <ListRow
          title={t('settings.delete')}
          danger
          onPress={() => router.push('/settings/exit?mode=delete')}
        />
      </ListGroup>
    </>
  );
}

function SecurityTab() {
  const toast = useToast();
  const { colors } = useTheme();
  const { session } = useSession();
  const signOut = useSignOut();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const change = useApiMutation(
    async (sb) => {
      const parsed = passwordSchema.safeParse(next);
      if (!parsed.success) throw new ApiError(parsed.error.issues[0]!.message);
      await account.verifyPassword(sb, session!.user.email!, current);
      await account.changePassword(sb, parsed.data);
    },
    {
      onSuccess: () => {
        setCurrent('');
        setNext('');
        toast(t('settings.passwordChanged'));
      },
    },
  );
  const all = useApiMutation((sb) => account.signOutEverywhere(sb), {
    onSuccess: async () => {
      await signOut().catch(() => undefined);
      router.replace('/register');
    },
  });
  return (
    <>
      <Card>
        <CardHeader title={t('settings.changePassword')} />
        <TextField
          label={t('settings.currentPassword')}
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
        />
        <TextField
          label={t('settings.newPassword')}
          value={next}
          onChangeText={setNext}
          secureTextEntry
        />
        <FormError error={change.error?.key} />
        <Button
          label={t('settings.changePassword')}
          disabled={!current || !next || change.isPending}
          onPress={() => change.mutate(undefined)}
        />
      </Card>
      <ListGroup title={t('settings.methods')}>
        <ListRow
          icon={(c) => <Phone size={18} color={c} />}
          title={t('settings.sms')}
          trailing={<SoonBadge />}
        />
        <ListRow
          icon={(c) => <KeyRound size={18} color={c} />}
          title={t('settings.passkey')}
          trailing={<SoonBadge />}
        />
        <ListRow
          icon={(c) => <ShieldCheck size={18} color={c} />}
          title={t('settings.authenticator')}
          value={t('settings.unavailable')}
        />
      </ListGroup>
      <ListGroup title={t('settings.sessions')}>
        <ListRow
          icon={(c) => <MonitorSmartphone size={18} color={c} />}
          title={t('settings.thisDevice')}
        />
      </ListGroup>
      <Button
        variant="glass"
        icon={<LogOut size={18} color={colors.text} />}
        label={t('settings.signOutAll')}
        onPress={() => setConfirmAll(true)}
      />
      <AppText variant="callout" color="textSecondary">
        {t('settings.recovery')}
      </AppText>
      <ConfirmSheet
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title={t('settings.signOutAll')}
        text={t('settings.signOutAllText')}
        confirmLabel={t('settings.signOutAll')}
        onConfirm={() => all.mutate(undefined)}
        busy={all.isPending}
      />
    </>
  );
}

function PrivacyTab() {
  const me = useMe();
  const toast = useToast();
  const [v, setV] = useState<Privacy>(() =>
    withDefaults(me.data?.profile.privacy as Partial<Privacy>),
  );
  const save = useApiMutation((sb, p: Privacy) => account.savePrivacy(sb, p), {
    invalidate: () => [keys.me, ['profile']],
    onSuccess: () => toast(t('settings.privacySaved')),
  });
  return (
    <>
      <Card testID="privacy">
        <CardHeader title={t('settings.privacyTitle')} />
        {PRIVACY_SCOPES.map((k) => (
          <View key={k} style={{ gap: 6 }}>
            <Label>{t(`settings.p.${k}`)}</Label>
            <Segmented
              value={v[k]}
              onChange={(x) => setV((s) => ({ ...s, [k]: x }))}
              options={(['all', 'me'] as const).map((x) => ({
                value: x,
                label: t(`settings.scope.${x}`),
              }))}
            />
          </View>
        ))}
      </Card>
      <Card>
        <CardHeader title={t('settings.whoTitle')} />
        {PRIVACY_WHO.map((k) => (
          <View key={k} style={{ gap: 6 }}>
            <Label>{t(`settings.p.${k}`)}</Label>
            <Row>
              {(['all', 'contacts', 'clients'] as const).map((x) => (
                <Chip
                  key={x}
                  label={t(`settings.who.${x}`)}
                  selected={v[k] === x}
                  onPress={() => setV((s) => ({ ...s, [k]: x }))}
                />
              ))}
            </Row>
          </View>
        ))}
      </Card>
      <Card>
        {PRIVACY_FLAGS.map((k) => (
          <Toggle
            key={k}
            value={v[k]}
            onChange={(on) => setV((s) => ({ ...s, [k]: on }))}
            label={t(`settings.p.${k}`)}
          />
        ))}
      </Card>
      <ListGroup>
        <ListRow
          title={t('settings.downloadData')}
          value={t('settings.request')}
          onPress={() => toast(t('settings.dataRequested'))}
        />
      </ListGroup>
      <FormError error={save.error?.key} />
      <Button
        label={t('settings.savePrivacy')}
        disabled={save.isPending}
        onPress={() => save.mutate(v)}
      />
      <Button
        variant="glass"
        label={t('settings.resetPrivacy')}
        onPress={() => setV(DEFAULT_PRIVACY)}
      />
    </>
  );
}

function BlockedTab() {
  const toast = useToast();
  const { data = [], isLoading } = useBlocked();
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const unblock = useApiMutation((sb, id: string) => people.block(sb, id, false), {
    invalidate: () => [keys.blocked],
    onSuccess: () => {
      setTarget(null);
      toast(t('settings.unblocked'));
    },
  });
  if (isLoading) return <Center />;
  return (
    <>
      {data.length === 0 ? (
        <EmptyState title={t('settings.blockedEmpty')} />
      ) : (
        data.map((b) => (
          <Card key={b.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar name={b.name} url={b.avatar_url} size={40} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">{b.name}</AppText>
              <AppText variant="caption" color="textSecondary">
                {formatDateTime(b.blocked_at)}
              </AppText>
            </View>
            <Button
              variant="glass"
              label={t('profile.unblock')}
              onPress={() => setTarget({ id: b.id, name: b.name })}
            />
          </Card>
        ))
      )}
      <ConfirmSheet
        open={!!target}
        onClose={() => setTarget(null)}
        title={target ? t('settings.unblockTitle', { name: target.name }) : ''}
        confirmLabel={t('profile.unblock')}
        onConfirm={() => target && unblock.mutate(target.id)}
        busy={unblock.isPending}
        error={unblock.error?.key}
      />
    </>
  );
}

export default function Settings() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const me = useMe();
  const { session } = useSession();
  const tab: Tab = params.tab && TABS.includes(params.tab) ? params.tab : 'account';
  const notify = useApiMutation(
    (sb, d: { notify_skill_tasks?: boolean; notifications_enabled?: boolean }) =>
      profileApi.saveData(sb, d),
    { invalidate: () => [keys.me] },
  );
  if (!me.data)
    return (
      <Screen title={t('settings.title')} leading={<BackButton />}>
        <Center />
      </Screen>
    );
  return (
    <Screen title={t('settings.title')} leading={<BackButton />}>
      <PageTitle>{t('settings.title')}</PageTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {TABS.map((x) => (
          <Chip
            key={x}
            label={t(`settings.tabs.${x}`)}
            selected={tab === x}
            onPress={() => router.setParams({ tab: x })}
          />
        ))}
      </ScrollView>
      {tab === 'account' && <AccountTab />}
      {tab === 'security' && <SecurityTab />}
      {tab === 'login' && (
        <>
          <ListGroup title={t('settings.loginMethods')}>
            <ListRow
              icon={(c) => <Mail size={18} color={c} />}
              title={session?.user.email ?? ''}
              value={t('settings.primary')}
            />
            <ListRow
              icon={(c) => <Phone size={18} color={c} />}
              title={me.data.private.phone ?? t('settings.phone')}
              trailing={<SoonBadge />}
            />
          </ListGroup>
          {!me.data.private.phone ? (
            <AppText variant="callout" color="textSecondary">
              {t('settings.addBackup')}
            </AppText>
          ) : null}
        </>
      )}
      {tab === 'notifications' && (
        <Card>
          <Toggle
            value={me.data.private.notifications_enabled}
            onChange={(on) => notify.mutate({ notifications_enabled: on })}
            label={t('settings.notifyAll')}
          />
          <Toggle
            value={me.data.profile.notify_skill_tasks}
            onChange={(on) => notify.mutate({ notify_skill_tasks: on })}
            label={t('settings.notifySkill')}
          />
          <ListRow title={t('settings.notifyPush')} trailing={<SoonBadge />} />
          <AppText variant="callout" color="textSecondary">
            {t('settings.proPriority')}
          </AppText>
        </Card>
      )}
      {tab === 'privacy' && <PrivacyTab />}
      {tab === 'payments' && (
        <Card>
          <AppText variant="body">{t('settings.paymentsText')}</AppText>
          <Button
            label={t('settings.openBalance')}
            onPress={() => router.push('/balance/methods')}
          />
        </Card>
      )}
      {tab === 'blocked' && <BlockedTab />}
    </Screen>
  );
}
