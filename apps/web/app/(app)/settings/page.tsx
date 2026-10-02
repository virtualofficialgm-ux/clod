'use client';

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
  type TranslationKey,
} from '@parri/shared';
import {
  keys,
  useApiMutation,
  useBlocked,
  useMe,
  useSession,
  useSignOut,
} from '@parri/shared/react';
import { KeyRound, LogOut, Mail, MonitorSmartphone, Phone, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { Button } from '@/components/glass/Button';
import { Chip } from '@/components/glass/Chip';
import { Header } from '@/components/glass/Header';
import { Segmented } from '@/components/glass/Segmented';
import { ConfirmSheet } from '@/components/task/ConfirmSheet';
import { LinkButton } from '@/components/ui/LinkButton';
import { FormError, Input, Select } from '@/components/ui/Field';
import { Avatar, CenterSpinner, EmptyState, PageTitle } from '@/components/ui/bits';
import { Card, CardHeader, ListGroup, ListRow, SoonBadge, Toggle } from '@/components/ui/kit';
import { useToast } from '@/components/ui/Toast';

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
  const p = me.data!.profile;
  const [phone, setPhone] = useState(me.data!.private.phone ?? '');
  const save = useApiMutation((sb) => profileApi.saveData(sb, { phone: phone.trim() || null }), {
    invalidate: () => [keys.me],
    onSuccess: () => toast(t('settings.contactsSaved')),
  });
  const currency = useApiMutation(
    (sb, v: string) => profileApi.saveData(sb, { display_currency: v as never }),
    { invalidate: () => [keys.me] },
  );
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <Input label={t('settings.email')} value={session?.user.email ?? ''} readOnly />
        <Input
          label={t('settings.phone')}
          type="tel"
          placeholder="+7…"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <FormError error={save.error?.key} />
        <div>
          <Button onClick={() => save.mutate(undefined)} disabled={save.isPending}>
            {t('settings.saveContacts')}
          </Button>
        </div>
      </Card>
      <ListGroup>
        <ListRow
          title={t('settings.profileVisibility')}
          value={t('settings.configure')}
          href="/settings?tab=privacy"
        />
        <ListRow title={t('settings.language')} value="Русский" />
      </ListGroup>
      <Card className="flex flex-col gap-2">
        <span className="font-bold">{t('settings.currency')}</span>
        <Segmented
          label={t('settings.currency')}
          value={p.display_currency === 'RUB' ? 'RUB' : 'USD'}
          onChange={(v) => currency.mutate(v)}
          options={[
            { value: 'USD', label: 'USD' },
            { value: 'RUB', label: 'RUB' },
          ]}
        />
        <span className="text-caption text-text-2">{t('settings.currencyHint')}</span>
      </Card>
      <ListGroup>
        <ListRow title={t('settings.deactivate')} href="/settings/exit?mode=deactivate" />
        <ListRow title={t('settings.delete')} href="/settings/exit?mode=delete" danger />
      </ListGroup>
    </div>
  );
}

function SecurityTab() {
  const toast = useToast();
  const router = useRouter();
  const { session } = useSession();
  const signOut = useSignOut();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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
        setError(null);
        toast(t('settings.passwordChanged'));
      },
    },
  );
  const all = useApiMutation((sb) => account.signOutEverywhere(sb), {
    onSuccess: async () => {
      await signOut().catch(() => undefined);
      router.replace('/login');
    },
  });
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <CardHeader title={t('settings.changePassword')} />
        <Input
          label={t('settings.currentPassword')}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Input
          label={t('settings.newPassword')}
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <FormError error={error ?? change.error?.key} />
        <div>
          <Button
            disabled={!current || !next || change.isPending || busy}
            onClick={() => {
              setBusy(true);
              change.mutate(undefined, { onSettled: () => setBusy(false) });
            }}
          >
            {t('settings.changePassword')}
          </Button>
        </div>
      </Card>
      <ListGroup title={t('settings.methods')}>
        <ListRow icon={<Phone size={18} />} title={t('settings.sms')} trailing={<SoonBadge />} />
        <ListRow
          icon={<KeyRound size={18} />}
          title={t('settings.passkey')}
          trailing={<SoonBadge />}
        />
        <ListRow
          icon={<ShieldCheck size={18} />}
          title={t('settings.authenticator')}
          value={t('settings.unavailable')}
        />
      </ListGroup>
      <ListGroup title={t('settings.sessions')}>
        <ListRow
          icon={<MonitorSmartphone size={18} />}
          title={t('settings.thisDevice')}
          subtitle={
            typeof navigator !== 'undefined'
              ? navigator.userAgent.split(') ')[0]?.replace('(', '')
              : undefined
          }
        />
      </ListGroup>
      <div>
        <Button variant="glass" onClick={() => setConfirmAll(true)}>
          <LogOut size={18} /> {t('settings.signOutAll')}
        </Button>
      </div>
      <p className="text-callout text-text-2">{t('settings.recovery')}</p>
      <ConfirmSheet
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title={t('settings.signOutAll')}
        text={t('settings.signOutAllText')}
        confirmLabel={t('settings.signOutAll')}
        onConfirm={() => all.mutate(undefined)}
        busy={all.isPending}
      />
    </div>
  );
}

function LoginTab() {
  const me = useMe();
  const { session } = useSession();
  return (
    <div className="flex flex-col gap-4">
      <ListGroup title={t('settings.loginMethods')}>
        <ListRow
          icon={<Mail size={18} />}
          title={session?.user.email ?? ''}
          value={t('settings.primary')}
        />
        <ListRow
          icon={<Phone size={18} />}
          title={me.data?.private.phone ?? t('settings.phone')}
          trailing={<SoonBadge />}
        />
      </ListGroup>
      {!me.data?.private.phone && (
        <p className="card p-4 text-callout">{t('settings.addBackup')}</p>
      )}
    </div>
  );
}

function NotificationsTab() {
  const me = useMe();
  const p = me.data!.profile;
  const save = useApiMutation(
    (sb, d: { notify_skill_tasks?: boolean; notifications_enabled?: boolean }) =>
      profileApi.saveData(sb, d),
    {
      invalidate: () => [keys.me],
    },
  );
  return (
    <Card className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold">{t('settings.notifyAll')}</span>
        <Toggle
          checked={me.data!.private.notifications_enabled}
          onChange={(on) => save.mutate({ notifications_enabled: on })}
          label={t('settings.notifyAll')}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold">{t('settings.notifySkill')}</span>
        <Toggle
          checked={p.notify_skill_tasks}
          onChange={(on) => save.mutate({ notify_skill_tasks: on })}
          label={t('settings.notifySkill')}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-bold">{t('settings.notifyPush')}</span>
        <SoonBadge />
      </div>
      <p className="text-callout text-text-2">{t('settings.proPriority')}</p>
    </Card>
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
    <div className="flex flex-col gap-4" data-testid="privacy">
      <Card className="flex flex-col gap-3">
        <CardHeader title={t('settings.privacyTitle')} />
        {PRIVACY_SCOPES.map((k) => (
          <div key={k} className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">{t(`settings.p.${k}`)}</span>
            <Segmented
              label={t(`settings.p.${k}`)}
              value={v[k]}
              onChange={(x) => setV((s) => ({ ...s, [k]: x }))}
              options={(['all', 'me'] as const).map((x) => ({
                value: x,
                label: t(`settings.scope.${x}`),
              }))}
            />
          </div>
        ))}
      </Card>
      <Card className="flex flex-col gap-3">
        <CardHeader title={t('settings.whoTitle')} />
        {PRIVACY_WHO.map((k) => (
          <Select
            key={k}
            label={t(`settings.p.${k}`)}
            value={v[k]}
            onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value as Privacy[typeof k] }))}
            options={(['all', 'contacts', 'clients'] as const).map((x) => ({
              value: x,
              label: t(`settings.who.${x}`),
            }))}
          />
        ))}
      </Card>
      <Card className="flex flex-col gap-4">
        {PRIVACY_FLAGS.map((k) => (
          <div key={k} className="flex items-center justify-between gap-3">
            <span className="font-semibold">{t(`settings.p.${k}`)}</span>
            <Toggle
              checked={v[k]}
              onChange={(on) => setV((s) => ({ ...s, [k]: on }))}
              label={t(`settings.p.${k}`)}
            />
          </div>
        ))}
      </Card>
      <ListGroup>
        <ListRow
          title={t('settings.downloadData')}
          trailing={
            <Chip onClick={() => toast(t('settings.dataRequested'))}>{t('settings.request')}</Chip>
          }
        />
        <ListRow title={t('settings.consent')} value={t('settings.manage')} href="/legal/privacy" />
      </ListGroup>
      <FormError error={save.error?.key} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save.mutate(v)} disabled={save.isPending}>
          {t('settings.savePrivacy')}
        </Button>
        <Button variant="glass" onClick={() => setV(DEFAULT_PRIVACY)}>
          {t('settings.resetPrivacy')}
        </Button>
      </div>
    </div>
  );
}

function BlockedTab() {
  const toast = useToast();
  const { data = [], isLoading } = useBlocked();
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const unblock = useApiMutation((sb, id: string) => people.block(sb, id, false), {
    invalidate: () => [keys.blocked],
    onSuccess: () => {
      setTarget(null);
      toast(t('settings.unblocked'));
    },
  });
  if (isLoading) return <CenterSpinner />;
  const items = data.filter(
    (x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <div className="flex flex-col gap-4">
      {data.length > 0 && (
        <Input label={t('connections.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      {items.length === 0 ? (
        <EmptyState title={t('settings.blockedEmpty')} />
      ) : (
        <ul className="flex flex-col gap-2" data-testid="blocked">
          {items.map((b) => (
            <li key={b.id} className="card flex items-center gap-3 p-4">
              <Avatar name={b.name} url={b.avatar_url} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{b.name}</span>
                <span className="text-caption text-text-2">{formatDateTime(b.blocked_at)}</span>
              </span>
              <Button
                size="md"
                variant="glass"
                onClick={() => setTarget({ id: b.id, name: b.name })}
              >
                {t('profile.unblock')}
              </Button>
            </li>
          ))}
        </ul>
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
    </div>
  );
}

function Settings() {
  const params = useSearchParams();
  const router = useRouter();
  const me = useMe();
  const initial = params.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(initial && TABS.includes(initial) ? initial : 'account');
  useEffect(() => {
    if (initial && TABS.includes(initial)) setTab(initial);
  }, [initial]);
  if (!me.data) return <CenterSpinner />;
  return (
    <>
      <Header title={t('settings.title')} />
      <main className="mx-auto flex max-w-[860px] flex-col gap-5 px-[var(--p-gutter)] pt-2 md:px-8">
        <PageTitle>
          {t('settings.title')}
          <span className="text-accent">.</span>
        </PageTitle>
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label={t('settings.title')}
        >
          {TABS.map((x) => (
            <Chip
              key={x}
              selected={tab === x}
              onClick={() => {
                setTab(x);
                router.replace(`/settings?tab=${x}`);
              }}
            >
              {t(`settings.tabs.${x}` as TranslationKey)}
            </Chip>
          ))}
        </div>
        {tab === 'account' && <AccountTab />}
        {tab === 'security' && <SecurityTab />}
        {tab === 'login' && <LoginTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'privacy' && <PrivacyTab />}
        {tab === 'payments' && (
          <Card className="flex flex-col gap-3">
            <p>{t('settings.paymentsText')}</p>
            <div>
              <LinkButton href="/balance/methods">{t('settings.openBalance')}</LinkButton>
            </div>
          </Card>
        )}
        {tab === 'blocked' && <BlockedTab />}
        <p className="text-caption text-text-2">
          <Link href="/legal/terms" className="underline">
            {t('onb.terms')}
          </Link>
        </p>
      </main>
    </>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<CenterSpinner />}>
      <Settings />
    </Suspense>
  );
}
